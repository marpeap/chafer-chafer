/**
 * @module core/audit
 * @description Journalisation d'audit centralisee : persiste en DB et publie dans le salon #logs-bot de la guilde.
 *
 * Chaque action significative (approbation membre, creation recompense, inscription activite, etc.)
 * appelle audit() pour creer une entree tracable.
 *
 * Utilise par : services/member, services/reward, A-members/modals, B-activities/modals, E-professions/modals
 * Depend de : core/database, core/client, views/base (Colors)
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
 * Ecrit une entree d'audit en base de donnees et publie un embed de resume
 * dans le salon de logs configure de la guilde (si existant).
 *
 * Capture silencieusement les erreurs — un echec d'audit ne doit jamais casser le flux principal.
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

    // Publier dans #logs-bot si configure
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
