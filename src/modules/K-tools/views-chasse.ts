import { EmbedBuilder } from 'discord.js';
import { baseEmbed, Colors, Emoji, truncate } from '../../views/base.js';
import type { ChasseResponse } from './chasse.js';

const DIRECTION_ARROWS: Record<string, string> = {
  haut: '⬆️',
  bas: '⬇️',
  gauche: '⬅️',
  droite: '➡️',
};

export function buildChasseEmbed(
  x: number,
  y: number,
  direction: string,
  data: ChasseResponse,
): EmbedBuilder {
  const arrow = DIRECTION_ARROWS[direction] ?? '➡️';
  const embed = baseEmbed(
    `${Emoji.SEARCH} Chasse au trésor`,
    Colors.INFO,
  );

  embed.addFields(
    { name: 'Position', value: `[${x}, ${y}]`, inline: true },
    { name: 'Direction', value: `${arrow} ${direction}`, inline: true },
  );

  const hints = data.hints;
  if (!hints || hints.length === 0) {
    embed.setDescription('Aucun indice trouvé dans cette direction.');
    return embed;
  }

  // Sort by distance
  const sorted = [...hints].sort((a, b) => a.d - b.d);
  const maxShow = 15;
  const shown = sorted.slice(0, maxShow);

  const lines = shown.map((h) => {
    const dist = h.d === 1 ? '1 case' : `${h.d} cases`;
    return `${Emoji.SCROLL} **[${h.x}, ${h.y}]** — ${h.n} *(${dist})*`;
  });

  if (sorted.length > maxShow) {
    lines.push(`*... et ${sorted.length - maxShow} autres*`);
  }

  embed.setDescription(truncate(lines.join('\n'), 4096));
  return embed;
}
