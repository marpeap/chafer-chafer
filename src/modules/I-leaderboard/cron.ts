import { TextChannel } from 'discord.js';
import { registerJob } from '../../core/scheduler.js';
import { db } from '../../core/database.js';
import { discordClient } from '../../core/client.js';
import { buildRecapData } from './commands.js';
import { buildWeeklyRecapEmbed } from './views.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('leaderboard:cron');

export function registerLeaderboardCrons(): void {
  registerJob({
    name: 'weekly-recap',
    schedule: '0 20 * * 0', // Sunday 20:00 Europe/Paris
    timezone: 'Europe/Paris',
    handler: async () => {
      const client = discordClient();

      const guilds = await db().discordGuild.findMany({
        where: { sortiesChannelId: { not: null } },
      });

      for (const guild of guilds) {
        try {
          const channelId = guild.annoncesChannelId ?? guild.sortiesChannelId;
          if (!channelId) continue;

          const channel = await client.channels.fetch(channelId);
          if (!channel || !(channel instanceof TextChannel)) continue;

          const data = await buildRecapData(guild.guildId, 7);

          // Skip if nothing happened this week
          if (data.totalActivities === 0 && data.totalCrafts === 0 && data.newMembers === 0) continue;

          const embed = buildWeeklyRecapEmbed(data);
          await channel.send({ embeds: [embed] });

          log.info({ guildId: guild.guildId }, 'Weekly recap posted');
        } catch (err) {
          log.error({ err, guildId: guild.guildId }, 'Failed to post weekly recap');
        }
      }
    },
  });
}
