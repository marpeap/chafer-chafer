import {
  ChatInputCommandInteraction,
} from 'discord.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed, successEmbed } from '../../views/base.js';
import { buildActivityListEmbed, buildTypeSelectMessage } from './views.js';

const log = childLogger('activities:commands');

export async function handleSortie(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'creer':
      return handleSortieCreer(interaction);
    case 'liste':
      return handleSortieListe(interaction);
    case 'annuler':
      return handleSortieAnnuler(interaction);
    case 'cloturer':
      return handleSortieCloturer(interaction);
    default:
      log.warn({ sub }, 'Unknown sortie subcommand');
  }
}

export async function handleLfg(interaction: ChatInputCommandInteraction): Promise<void> {
  const msg = buildTypeSelectMessage('lfg');
  await interaction.reply({ ...msg, ephemeral: true });
}

// --- Subcommand handlers ---

async function handleSortieCreer(interaction: ChatInputCommandInteraction): Promise<void> {
  const msg = buildTypeSelectMessage('sortie');
  await interaction.reply({ ...msg, ephemeral: true });
}

async function handleSortieListe(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const activities = await db().activity.findMany({
    where: {
      guildId,
      status: 'published',
      scheduledAt: { gte: new Date() },
    },
    include: { signups: true },
    orderBy: { scheduledAt: 'asc' },
    take: 15,
  });

  const embed = buildActivityListEmbed(activities);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSortieAnnuler(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const id = interaction.options.getInteger('id', true);

  const activity = await db().activity.findFirst({
    where: { id, guildId },
  });

  if (!activity) {
    await interaction.reply({ embeds: [errorEmbed('Sortie introuvable.')], ephemeral: true });
    return;
  }

  if (activity.status === 'cancelled') {
    await interaction.reply({ embeds: [errorEmbed('Cette sortie est déjà annulée.')], ephemeral: true });
    return;
  }

  await db().activity.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'activity.cancel',
    targetType: 'activity',
    targetId: String(id),
    details: { title: activity.title },
  });

  // Update the original message if it exists
  if (activity.messageId && activity.channelId) {
    try {
      const channel = interaction.client.channels.cache.get(activity.channelId);
      if (channel && 'messages' in channel) {
        const message = await (channel as import('discord.js').TextChannel).messages.fetch(activity.messageId);
        const updatedActivity = await db().activity.findUnique({
          where: { id },
          include: { signups: true },
        });
        if (updatedActivity) {
          const { buildActivityEmbed } = await import('./views.js');
          const card = buildActivityEmbed(updatedActivity, updatedActivity.signups);
          await message.edit({ embeds: card.embeds, components: card.components });
        }
      }
    } catch (err) {
      log.warn({ err, activityId: id }, 'Failed to update activity message after cancel');
    }
  }

  await interaction.reply({ embeds: [successEmbed(`Sortie **${activity.title}** (ID: ${id}) annulée.`)], ephemeral: true });
}

async function handleSortieCloturer(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const id = interaction.options.getInteger('id', true);

  const activity = await db().activity.findFirst({
    where: { id, guildId },
  });

  if (!activity) {
    await interaction.reply({ embeds: [errorEmbed('Sortie introuvable.')], ephemeral: true });
    return;
  }

  if (activity.status === 'closed' || activity.status === 'cancelled') {
    await interaction.reply({ embeds: [errorEmbed('Cette sortie est déjà clôturée ou annulée.')], ephemeral: true });
    return;
  }

  await db().activity.update({
    where: { id },
    data: { status: 'closed', closedAt: new Date() },
  });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'activity.close',
    targetType: 'activity',
    targetId: String(id),
    details: { title: activity.title },
  });

  // Update the original message if it exists
  if (activity.messageId && activity.channelId) {
    try {
      const channel = interaction.client.channels.cache.get(activity.channelId);
      if (channel && 'messages' in channel) {
        const message = await (channel as import('discord.js').TextChannel).messages.fetch(activity.messageId);
        const updatedActivity = await db().activity.findUnique({
          where: { id },
          include: { signups: true },
        });
        if (updatedActivity) {
          const { buildActivityEmbed } = await import('./views.js');
          const card = buildActivityEmbed(updatedActivity, updatedActivity.signups);
          await message.edit({ embeds: card.embeds, components: card.components });
        }
      }
    } catch (err) {
      log.warn({ err, activityId: id }, 'Failed to update activity message after close');
    }
  }

  await interaction.reply({ embeds: [successEmbed(`Sortie **${activity.title}** (ID: ${id}) clôturée.`)], ephemeral: true });
}
