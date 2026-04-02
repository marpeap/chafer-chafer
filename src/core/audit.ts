import { TextChannel, EmbedBuilder } from 'discord.js';
import { db } from './database.js';
import { discordClient } from './client.js';
import { childLogger } from './logger.js';
import { Colors } from '../views/base.js';

const log = childLogger('audit');

interface AuditEntry {
  guildId: string;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await db().auditLog.create({
      data: {
        guildId: entry.guildId,
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        details: entry.details ? JSON.stringify(entry.details) : null,
      },
    });

    // Post to #logs-bot if configured
    const guild = await db().discordGuild.findUnique({
      where: { guildId: entry.guildId },
    });

    if (guild?.logChannelId) {
      const channel = discordClient().channels.cache.get(guild.logChannelId);
      if (channel && channel instanceof TextChannel) {
        const embed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle(`Audit: ${entry.action}`)
          .addFields(
            { name: 'Acteur', value: `<@${entry.actorId}>`, inline: true },
            ...(entry.targetType
              ? [{ name: 'Cible', value: `${entry.targetType}:${entry.targetId ?? '?'}`, inline: true }]
              : []),
          )
          .setTimestamp();

        if (entry.details) {
          embed.addFields({
            name: 'Détails',
            value: '```json\n' + JSON.stringify(entry.details, null, 2).slice(0, 900) + '\n```',
          });
        }

        await channel.send({ embeds: [embed] }).catch((err) => {
          log.warn({ err }, 'Failed to post audit to log channel');
        });
      }
    }
  } catch (err) {
    log.error({ err, entry }, 'Failed to write audit log');
  }
}
