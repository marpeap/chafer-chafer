import { TextChannel } from 'discord.js';
import { registerJob } from '../../core/scheduler.js';
import { db } from '../../core/database.js';
import { discordClient } from '../../core/client.js';
import { getToday } from '../../integrations/almanax/client.js';
import { buildAlmanaxEmbed } from './views.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('almanax:cron');

export function registerAlmanaxCron(): void {
  registerJob({
    name: 'almanax-daily',
    schedule: '0 6 * * *', // 06:00 every day
    timezone: 'Europe/Paris',
    handler: async () => {
      const { data, stale } = await getToday();
      const embed = buildAlmanaxEmbed(data, stale);

      const client = discordClient();

      // Fetch all guilds that have an almanax channel configured
      const guilds = await db().discordGuild.findMany({
        where: { almanaxChannelId: { not: null } },
      });

      for (const guild of guilds) {
        try {
          const channel = await client.channels.fetch(guild.almanaxChannelId!);

          if (!channel || !(channel instanceof TextChannel)) {
            log.warn({ guildId: guild.guildId, channelId: guild.almanaxChannelId }, 'Almanax channel not found or not a text channel');
            continue;
          }

          await channel.send({ embeds: [embed] });
          log.info({ guildId: guild.guildId, channelId: guild.almanaxChannelId }, 'Daily almanax posted');
        } catch (err) {
          log.error({ err, guildId: guild.guildId, channelId: guild.almanaxChannelId }, 'Failed to post daily almanax');
        }
      }
    },
  });
}
