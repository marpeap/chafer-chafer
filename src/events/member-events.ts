import { Client, GuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import { db } from '../core/database.js';
import { childLogger } from '../core/logger.js';
import { Colors, Emoji } from '../views/base.js';

const log = childLogger('event:members');

export function registerMemberEvents(client: Client): void {
  client.on('guildMemberAdd', async (member) => {
    log.info({ userId: member.id, guild: member.guild.id }, 'Member joined');

    try {
      await db().discordMember.upsert({
        where: {
          guildId_userId: { guildId: member.guild.id, userId: member.id },
        },
        create: {
          guildId: member.guild.id,
          userId: member.id,
          username: member.user.username,
          joinedAt: member.joinedAt,
        },
        update: {
          username: member.user.username,
          joinedAt: member.joinedAt,
        },
      });
    } catch (err) {
      log.error({ err, userId: member.id, guild: member.guild.id }, 'Failed to upsert member on join');
    }
  });

  client.on('guildMemberRemove', async (member) => {
    log.info({ userId: member.id, guild: member.guild.id }, 'Member left');
  });
}
