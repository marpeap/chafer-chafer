import { TextChannel } from 'discord.js';
import { db } from '../../core/database.js';
import { discordClient } from '../../core/client.js';
import { registerJob } from '../../core/scheduler.js';
import { childLogger } from '../../core/logger.js';
import { baseEmbed, Colors, Emoji, discordTimestamp } from '../../views/base.js';
import { buildQuickCallEmbed } from './views.js';

const log = childLogger('activities:cron');

const REMINDER_LABELS: Record<string, string> = {
  '24h': 'dans 24 heures',
  '1h': 'dans 1 heure',
  '10min': 'dans 10 minutes',
};

export function registerActivityCrons(): void {
  registerJob({
    name: 'check-reminders',
    schedule: '*/5 * * * *', // Every 5 minutes
    handler: handleCheckReminders,
  });

  registerJob({
    name: 'expire-lfg',
    schedule: '*/10 * * * *', // Every 10 minutes
    handler: handleExpireLfg,
  });

  registerJob({
    name: 'cleanup-search-queue',
    schedule: '*/10 * * * *', // Every 10 minutes
    handler: handleCleanupSearchQueue,
  });
}

async function handleCheckReminders(): Promise<void> {
  const now = new Date();

  const reminders = await db().activityReminder.findMany({
    where: {
      sent: false,
      remindAt: { lte: now },
    },
    include: {
      activity: {
        include: { signups: true },
      },
    },
    take: 50,
  });

  if (reminders.length === 0) return;

  log.info({ count: reminders.length }, 'Processing activity reminders');

  for (const reminder of reminders) {
    const { activity } = reminder;

    // Skip cancelled/closed activities
    if (activity.status === 'cancelled' || activity.status === 'closed') {
      await db().activityReminder.update({
        where: { id: reminder.id },
        data: { sent: true },
      });
      continue;
    }

    // Find the channel to send the reminder
    const channelId = activity.channelId;
    if (!channelId) {
      log.warn({ activityId: activity.id }, 'Activity has no channel, skipping reminder');
      await db().activityReminder.update({
        where: { id: reminder.id },
        data: { sent: true },
      });
      continue;
    }

    try {
      const client = discordClient();
      const channel = client.channels.cache.get(channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        log.warn({ channelId, activityId: activity.id }, 'Reminder channel not found');
        await db().activityReminder.update({
          where: { id: reminder.id },
          data: { sent: true },
        });
        continue;
      }

      const timeLabel = REMINDER_LABELS[reminder.type] ?? reminder.type;
      const confirmed = activity.signups.filter((s) => s.status === 'confirmed');
      const mentionList = confirmed.map((s) => `<@${s.userId}>`).join(' ');

      const embed = baseEmbed(`${Emoji.BELL} Rappel — ${activity.title}`, Colors.ACTIVITY)
        .setDescription(
          `La sortie **${activity.title}** commence **${timeLabel}** !\n\n` +
          `${Emoji.CALENDAR} ${discordTimestamp(activity.scheduledAt, 'F')}\n` +
          `${Emoji.PEOPLE} ${confirmed.length} confirmé(s)`,
        );

      // Reply to original message if possible
      const sendOptions: { embeds: import('discord.js').EmbedBuilder[]; content?: string; reply?: { messageReference: string } } = {
        embeds: [embed],
      };

      if (mentionList) {
        sendOptions.content = mentionList;
      }

      if (activity.messageId) {
        sendOptions.reply = { messageReference: activity.messageId };
      }

      await channel.send(sendOptions);

      await db().activityReminder.update({
        where: { id: reminder.id },
        data: { sent: true },
      });

      log.info({ activityId: activity.id, type: reminder.type }, 'Reminder sent');
    } catch (err) {
      log.error({ err, activityId: activity.id, reminderId: reminder.id }, 'Failed to send reminder');
      // Mark as sent to avoid retrying indefinitely
      await db().activityReminder.update({
        where: { id: reminder.id },
        data: { sent: true },
      });
    }
  }
}

async function handleExpireLfg(): Promise<void> {
  const now = new Date();

  const expiredCalls = await db().quickCall.findMany({
    where: {
      status: 'open',
      expiresAt: { lte: now },
    },
    include: { responses: true },
    take: 50,
  });

  if (expiredCalls.length === 0) return;

  log.info({ count: expiredCalls.length }, 'Expiring LFG calls');

  for (const call of expiredCalls) {
    await db().quickCall.update({
      where: { id: call.id },
      data: { status: 'expired' },
    });

    // Update the message embed
    if (call.messageId && call.channelId) {
      try {
        const client = discordClient();
        const channel = client.channels.cache.get(call.channelId);
        if (channel && channel instanceof TextChannel) {
          const message = await channel.messages.fetch(call.messageId);
          const updatedCall = { ...call, status: 'expired' };
          const card = buildQuickCallEmbed(updatedCall, call.responses);
          await message.edit({ embeds: card.embeds, components: card.components });
        }
      } catch (err) {
        log.warn({ err, quickCallId: call.id }, 'Failed to update expired LFG message');
      }
    }

    log.info({ quickCallId: call.id }, 'LFG expired');
  }
}

async function handleCleanupSearchQueue(): Promise<void> {
  const now = new Date();

  try {
    const result = await db().searchQueue.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { matched: true },
        ],
      },
    });

    if (result.count > 0) {
      log.info({ deleted: result.count }, 'Cleaned up expired/matched search queue entries');
    }
  } catch (err) {
    log.error({ err }, 'Failed to cleanup search queue');
  }
}
