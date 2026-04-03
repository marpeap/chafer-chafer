import { ChatInputCommandInteraction } from 'discord.js';
import { childLogger } from '../../core/logger.js';
import { getMemberLevel, requireLevel, PermissionLevel, levelName } from '../../core/permissions.js';
import { noPermissionEmbed, successEmbed } from '../../views/base.js';
import {
  buildMainPanelEmbed,
  buildMainPanelRows,
  buildConfigPanelEmbed,
  buildConfigPanelRows,
  buildOfficerPanelEmbed,
  buildOfficerPanelRows,
  buildOutilsPanelEmbed,
  buildOutilsPanelRows,
} from './views.js';
import type { GuildMember } from 'discord.js';

const log = childLogger('panel:commands');

export async function handlePanneau(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand(false);

  switch (sub) {
    case 'principal':
    case null:
      return handlePanneauPrincipal(interaction);
    case 'config':
      return handlePanneauConfig(interaction);
    case 'officier':
      return handlePanneauOfficier(interaction);
    case 'outils':
      return handlePanneauOutils(interaction);
    default:
      log.warn({ sub }, 'Unknown panneau subcommand');
  }
}

async function handlePanneauPrincipal(interaction: ChatInputCommandInteraction): Promise<void> {
  // Admin only — this posts a persistent public message
  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.ADMIN, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.ADMIN))],
      ephemeral: true,
    });
    return;
  }

  // Post the panel as a public message (not ephemeral)
  const embed = buildMainPanelEmbed();
  const rows = buildMainPanelRows();

  await interaction.reply({
    embeds: [embed],
    components: rows,
  });
}

async function handlePanneauConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.ADMIN, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.ADMIN))],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [buildConfigPanelEmbed()],
    components: buildConfigPanelRows(),
    ephemeral: true,
  });
}

async function handlePanneauOfficier(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.OFFICER, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.OFFICER))],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [buildOfficerPanelEmbed()],
    components: buildOfficerPanelRows(),
    ephemeral: true,
  });
}

async function handlePanneauOutils(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    embeds: [buildOutilsPanelEmbed()],
    components: buildOutilsPanelRows(),
    ephemeral: true,
  });
}
