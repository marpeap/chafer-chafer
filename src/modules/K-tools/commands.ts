import { ChatInputCommandInteraction } from 'discord.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed } from '../../views/base.js';
import { buildXpEmbed, buildXpMetierEmbed } from './views.js';

const log = childLogger('K-tools');

export async function handleXp(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'personnage':
      return handleXpPerso(interaction);
    case 'metier':
      return handleXpMetier(interaction);
    default:
      log.warn({ sub }, 'Unknown /xp subcommand');
  }
}

// ────────────────── /xp personnage <actuel> <cible> ──────────────────

async function handleXpPerso(interaction: ChatInputCommandInteraction): Promise<void> {
  const current = interaction.options.getInteger('actuel', true);
  const target = interaction.options.getInteger('cible', true);

  if (current < 1 || current > 200 || target < 1 || target > 200) {
    await interaction.reply({
      embeds: [errorEmbed('Les niveaux doivent être entre 1 et 200.')],
      ephemeral: true,
    });
    return;
  }

  if (target <= current) {
    await interaction.reply({
      embeds: [errorEmbed('Le niveau cible doit être supérieur au niveau actuel.')],
      ephemeral: true,
    });
    return;
  }

  const xpNeeded = getCharacterXpBetween(current, target);
  const embed = buildXpEmbed(current, target, xpNeeded);
  await interaction.reply({ embeds: [embed] });
}

// ────────────────── /xp metier <actuel> <cible> ──────────────────

async function handleXpMetier(interaction: ChatInputCommandInteraction): Promise<void> {
  const current = interaction.options.getInteger('actuel', true);
  const target = interaction.options.getInteger('cible', true);

  if (current < 1 || current > 200 || target < 1 || target > 200) {
    await interaction.reply({
      embeds: [errorEmbed('Les niveaux doivent être entre 1 et 200.')],
      ephemeral: true,
    });
    return;
  }

  if (target <= current) {
    await interaction.reply({
      embeds: [errorEmbed('Le niveau cible doit être supérieur au niveau actuel.')],
      ephemeral: true,
    });
    return;
  }

  const xpNeeded = getProfessionXpBetween(current, target);
  const embed = buildXpMetierEmbed(current, target, xpNeeded);
  await interaction.reply({ embeds: [embed] });
}

// ────────────────── XP Formulas ──────────────────

/**
 * Character XP formula (Dofus 3):
 * XP to reach level N = floor(N^2.4 * 10)
 * Total XP between two levels = sum of individual level requirements
 */
function getCharacterXpForLevel(level: number): number {
  return Math.floor(Math.pow(level, 2.4) * 10);
}

function getCharacterXpBetween(from: number, to: number): number {
  let total = 0;
  for (let l = from + 1; l <= to; l++) {
    total += getCharacterXpForLevel(l);
  }
  return total;
}

/**
 * Profession XP formula:
 * XP to reach level N from N-1 = 10 * N * (N-1)
 * Total from level 1 to 200 = 398,000 XP
 */
function getProfessionXpForLevel(level: number): number {
  return 10 * level * (level - 1);
}

function getProfessionXpBetween(from: number, to: number): number {
  let total = 0;
  for (let l = from + 1; l <= to; l++) {
    total += getProfessionXpForLevel(l);
  }
  return total;
}
