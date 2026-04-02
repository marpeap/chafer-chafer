import { Client } from 'discord.js';
import { childLogger } from '../core/logger.js';
import { db } from '../core/database.js';

const log = childLogger('event:ready');

export function registerReadyEvent(client: Client): void {
  client.once('ready', async (readyClient) => {
    log.info(
      {
        user: readyClient.user.tag,
        guilds: readyClient.guilds.cache.size,
      },
      'Bot is ready',
    );

    // Sync guilds to DB
    for (const [guildId, guild] of readyClient.guilds.cache) {
      try {
        await db().discordGuild.upsert({
          where: { guildId },
          create: { guildId, name: guild.name },
          update: { name: guild.name },
        });
        log.info({ guildId, name: guild.name }, 'Guild synced');
      } catch (err) {
        log.error({ err, guildId, name: guild.name }, 'Failed to sync guild');
      }
    }
  });
}
