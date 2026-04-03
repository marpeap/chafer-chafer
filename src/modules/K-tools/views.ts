import { EmbedBuilder } from 'discord.js';
import { baseEmbed, Colors, Emoji } from '../../views/base.js';

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'G';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toLocaleString('fr-FR');
}

export function buildXpEmbed(
  current: number,
  target: number,
  xpNeeded: number,
): EmbedBuilder {
  const embed = baseEmbed(`${Emoji.STAR} Calculateur XP Personnage`, Colors.INFO);

  const lines: string[] = [];
  lines.push(`**Niveau actuel** : ${current}`);
  lines.push(`**Niveau cible** : ${target}`);
  lines.push(`**Niveaux à gagner** : ${target - current}`);
  lines.push('');
  lines.push(`${Emoji.FIRE} **XP nécessaire** : **${formatNumber(xpNeeded)}** XP`);

  embed.setDescription(lines.join('\n'));
  return embed;
}

export function buildXpMetierEmbed(
  current: number,
  target: number,
  xpNeeded: number,
): EmbedBuilder {
  const embed = baseEmbed(`${Emoji.HAMMER} Calculateur XP Métier`, Colors.CRAFT);

  // Estimate crafts: average XP per craft ~ 10 * (current + target) / 2
  const avgLevel = (current + target) / 2;
  const xpPerCraft = Math.max(10, Math.floor(avgLevel * 2));
  const estimatedCrafts = Math.ceil(xpNeeded / xpPerCraft);

  const lines: string[] = [];
  lines.push(`**Niveau actuel** : ${current}`);
  lines.push(`**Niveau cible** : ${target}`);
  lines.push(`**Niveaux à gagner** : ${target - current}`);
  lines.push('');
  lines.push(`${Emoji.FIRE} **XP nécessaire** : **${formatNumber(xpNeeded)}** XP`);
  lines.push(`${Emoji.HAMMER} **Crafts estimés** : ~**${formatNumber(estimatedCrafts)}** (à ~${xpPerCraft} XP/craft)`);
  lines.push('');
  lines.push(`*Estimation basée sur des crafts de niveau moyen (${Math.round(avgLevel)}). Adapter selon les recettes utilisées.*`);

  embed.setDescription(lines.join('\n'));
  return embed;
}
