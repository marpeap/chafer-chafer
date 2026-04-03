import { EmbedBuilder } from 'discord.js';
import { baseEmbed, Colors, Emoji, truncate } from '../../views/base.js';
import { DUNGEONS, getDungeonsByCategory, type DungeonInfo } from './data.js';

export function buildDungeonProgressEmbed(
  completed: Set<string>,
  displayName: string,
): EmbedBuilder {
  const total = DUNGEONS.length;
  const done = completed.size;
  const pct = Math.round((done / total) * 100);

  const embed = baseEmbed(
    `${Emoji.SWORD} Progression donjons — ${displayName}`,
    Colors.ACTIVITY,
  );

  const bar = buildProgressBar(pct);
  embed.setDescription(`${bar} **${done}/${total}** donjons (${pct}%)`);

  const byCategory = getDungeonsByCategory();
  for (const [category, dungeons] of byCategory) {
    const catDone = dungeons.filter((d) => completed.has(d.name)).length;
    const lines = dungeons.map((d) => {
      const icon = completed.has(d.name) ? Emoji.CHECK : '⬜';
      return `${icon} ${d.name} (${d.level})`;
    });

    embed.addFields({
      name: `${category} (${catDone}/${dungeons.length})`,
      value: truncate(lines.join('\n'), 1024),
      inline: false,
    });
  }

  return embed;
}

export function buildDungeonGuildEmbed(
  dungeon: DungeonInfo,
  userIds: string[],
): EmbedBuilder {
  const embed = baseEmbed(
    `${Emoji.SWORD} ${dungeon.name} — Niveau ${dungeon.level}`,
    Colors.ACTIVITY,
  );

  if (userIds.length === 0) {
    embed.setDescription('Aucun membre n\'a marqué ce donjon comme complété.');
  } else {
    const list = userIds.map((id) => `${Emoji.CHECK} <@${id}>`).join('\n');
    embed.setDescription(
      `**${userIds.length}** membre(s) ont complété ce donjon :\n\n${truncate(list, 4000)}`,
    );
  }

  return embed;
}

function buildProgressBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return '`[' + '█'.repeat(filled) + '░'.repeat(empty) + ']`';
}
