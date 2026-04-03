import { EmbedBuilder } from 'discord.js';
import { baseEmbed, Colors, Emoji, truncate, discordTimestamp } from '../../views/base.js';

export interface LeaderboardEntry {
  userId: string;
  count: number;
}

export interface WeeklyRecapData {
  totalActivities: number;
  totalParticipants: number;
  totalCrafts: number;
  totalRewards: number;
  newMembers: number;
  mvpUserId: string | null;
  mvpCount: number;
  nextActivity: { title: string; scheduledAt: Date } | null;
}

const PERIOD_LABELS: Record<string, string> = {
  semaine: 'cette semaine',
  mois: 'ce mois',
  trimestre: 'ce trimestre',
  tout: 'depuis toujours',
};

const MEDALS = ['🥇', '🥈', '🥉'];

export function buildLeaderboardEmbed(
  title: string,
  entries: LeaderboardEntry[],
  periode: string,
  unit: string,
): EmbedBuilder {
  const periodLabel = PERIOD_LABELS[periode] ?? periode;
  const embed = baseEmbed(`${Emoji.TROPHY} ${title}`, Colors.REWARD);

  if (entries.length === 0) {
    embed.setDescription(`Aucune donnée ${periodLabel}.`);
    return embed;
  }

  const lines = entries.map((e, i) => {
    const medal = i < 3 ? MEDALS[i] : `**${i + 1}.**`;
    return `${medal} <@${e.userId}> — **${e.count}** ${unit}`;
  });

  embed.setDescription(
    `Classement ${periodLabel}\n\n` + truncate(lines.join('\n'), 4000),
  );

  return embed;
}

export function buildWeeklyRecapEmbed(data: WeeklyRecapData): EmbedBuilder {
  const embed = baseEmbed(`${Emoji.CALENDAR} Résumé de la semaine`, Colors.INFO);

  const lines: string[] = [];
  lines.push(`${Emoji.SWORD} **${data.totalActivities}** sortie(s) organisée(s)`);
  lines.push(`${Emoji.PEOPLE} **${data.totalParticipants}** participant(s) unique(s)`);
  lines.push(`${Emoji.HAMMER} **${data.totalCrafts}** craft(s) complété(s)`);
  lines.push(`${Emoji.TROPHY} **${data.totalRewards}** récompense(s) distribuée(s)`);
  lines.push(`${Emoji.STAR} **${data.newMembers}** nouveau(x) membre(s)`);

  if (data.mvpUserId) {
    lines.push('');
    lines.push(`${MEDALS[0]} **MVP de la semaine** : <@${data.mvpUserId}> (${data.mvpCount} participations)`);
  }

  if (data.nextActivity) {
    lines.push('');
    lines.push(`${Emoji.BELL} **Prochaine sortie** : ${data.nextActivity.title} — ${discordTimestamp(data.nextActivity.scheduledAt, 'R')}`);
  }

  embed.setDescription(lines.join('\n'));
  return embed;
}
