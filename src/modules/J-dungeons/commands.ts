import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { db } from '../../core/database.js';
import { childLogger } from '../../core/logger.js';
import { successEmbed, errorEmbed } from '../../views/base.js';
import { buildDungeonProgressEmbed, buildDungeonGuildEmbed } from './views.js';
import { DUNGEONS } from './data.js';

const log = childLogger('J-dungeons');

export async function handleDonjon(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'fait':
      return handleFait(interaction);
    case 'progression':
      return handleProgression(interaction);
    case 'guilde':
      return handleGuilde(interaction);
    case 'retirer':
      return handleRetirer(interaction);
    default:
      log.warn({ sub }, 'Unknown /donjon subcommand');
  }
}

export async function handleDonjonAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);

  if (focused.name === 'nom') {
    const search = focused.value.toLowerCase();
    const filtered = DUNGEONS
      .filter((d) => d.name.toLowerCase().includes(search))
      .slice(0, 25)
      .map((d) => ({ name: `${d.name} (Niv. ${d.level})`, value: d.name }));

    await interaction.respond(filtered);
    return;
  }

  await interaction.respond([]);
}

// ── /donjon fait <nom> ──

async function handleFait(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const name = interaction.options.getString('nom', true);

  // Validate dungeon name
  const dungeon = DUNGEONS.find((d) => d.name.toLowerCase() === name.toLowerCase());
  if (!dungeon) {
    await interaction.reply({
      embeds: [errorEmbed(`Donjon inconnu : \`${name}\`. Utilise l'autocomplétion.`)],
      ephemeral: true,
    });
    return;
  }

  await db().dungeonProgress.upsert({
    where: { guildId_userId_dungeonName: { guildId, userId, dungeonName: dungeon.name } },
    create: { guildId, userId, dungeonName: dungeon.name },
    update: { completedAt: new Date() },
  });

  await interaction.reply({
    embeds: [successEmbed(`Donjon **${dungeon.name}** marqué comme complété !`)],
    ephemeral: true,
  });
}

// ── /donjon retirer <nom> ──

async function handleRetirer(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const name = interaction.options.getString('nom', true);

  const result = await db().dungeonProgress.deleteMany({
    where: { guildId, userId, dungeonName: { equals: name, mode: 'insensitive' } },
  });

  if (result.count === 0) {
    await interaction.reply({
      embeds: [errorEmbed(`Tu n'as pas marqué **${name}** comme complété.`)],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [successEmbed(`Donjon **${name}** retiré de ta progression.`)],
    ephemeral: true,
  });
}

// ── /donjon progression ──

async function handleProgression(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const completed = await db().dungeonProgress.findMany({
    where: { guildId, userId },
    select: { dungeonName: true },
  });

  const completedNames = new Set(completed.map((d) => d.dungeonName));
  const embed = buildDungeonProgressEmbed(completedNames, interaction.user.displayName);
  await interaction.editReply({ embeds: [embed] });
}

// ── /donjon guilde <nom> ──

async function handleGuilde(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const name = interaction.options.getString('nom', true);

  const dungeon = DUNGEONS.find((d) => d.name.toLowerCase() === name.toLowerCase());
  if (!dungeon) {
    await interaction.editReply({
      embeds: [errorEmbed(`Donjon inconnu : \`${name}\`.`)],
    });
    return;
  }

  const completions = await db().dungeonProgress.findMany({
    where: { guildId, dungeonName: dungeon.name },
    select: { userId: true },
  });

  const embed = buildDungeonGuildEmbed(dungeon, completions.map((c) => c.userId));
  await interaction.editReply({ embeds: [embed] });
}
