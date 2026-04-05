/**
 * @module core/audit
 * @description Centralized audit logging: persists to DB and posts to the guild's #logs-bot channel.
 *
 * Every significant user action (member approval, reward creation, activity signup, etc.)
 * calls audit() to create a traceable log entry.
 *
 * Used by: services/member, services/reward, A-members/modals, B-activities/modals, E-professions/modals
 * Depends on: core/database, core/client, views/base (Colors)
 */

import { TextChannel, EmbedBuilder } from 'discord.js';
import { db } from './database.js';
import { discordClient } from './client.js';
import { childLogger } from './logger.js';
import { Colors } from '../views/base.js';

const log = childLogger('audit');

export interface AuditEntry {
  guildId: string;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

/**
 * Write an audit log entry to the database and post a summary embed
 * to the guild's configured log channel (if any).
 *
 * Silently catches errors — audit failures should never break the main flow.
 */
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
      let channel = discordClient().channels.cache.get(guild.logChannelId);
      if (!channel) {
        try {
          channel = await discordClient().channels.fetch(guild.logChannelId) ?? undefined;
        } catch (err) {
          log.warn({ err, channelId: guild.logChannelId }, 'Failed to fetch audit log channel');
        }
      }
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
