import { ChatInputCommandInteraction } from 'discord.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed } from '../../views/base.js';
import { buildChasseEmbed } from './views-chasse.js';

const log = childLogger('K-tools:chasse');

const VALID_DIRECTIONS = ['haut', 'bas', 'gauche', 'droite'] as const;

const DIRECTION_MAP: Record<string, number> = {
  haut: 0,
  bas: 2,
  droite: 1,
  gauche: 3,
};

export async function handleChasse(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const x = interaction.options.getInteger('x', true);
  const y = interaction.options.getInteger('y', true);
  const dirRaw = interaction.options.getString('direction', true).toLowerCase();

  // Normalize direction
  const dir = VALID_DIRECTIONS.find((d) => d.startsWith(dirRaw));
  if (!dir) {
    await interaction.editReply({
      embeds: [errorEmbed(`Direction invalide : \`${dirRaw}\`. Valeurs : haut, bas, gauche, droite.`)],
    });
    return;
  }

  const directionCode = DIRECTION_MAP[dir];

  try {
    const response = await fetch(
      `https://dofus-map.com/huntTool/getData.php?x=${x}&y=${y}&direction=${directionCode}&world=0&language=fr`,
      { signal: AbortSignal.timeout(8000) },
    );

    if (!response.ok) {
      await interaction.editReply({
        embeds: [errorEmbed('Erreur lors de la requête à dofus-map.com.')],
      });
      return;
    }

    const data = await response.json() as ChasseResponse;
    const embed = buildChasseEmbed(x, y, dir, data);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err, x, y, direction: dir }, 'Treasure hunt API failed');
    await interaction.editReply({
      embeds: [errorEmbed('Impossible de contacter dofus-map.com. Réessaie plus tard.')],
    });
  }
}

export interface ChasseHint {
  d: number; // distance
  x: number;
  y: number;
  n: string; // map name
}

export interface ChasseResponse {
  hints?: ChasseHint[];
  [key: string]: unknown;
}
