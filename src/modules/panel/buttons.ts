import {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
  GuildMember,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { childLogger } from '../../core/logger.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { getMemberLevel, requireLevel, PermissionLevel, levelName } from '../../core/permissions.js';
import { isEnabled } from '../../core/feature-flags.js';
import { getAllFlags, setFlag } from '../../core/feature-flags.js';
import { MODULE_FLAGS } from '../../core/feature-flags.js';
import { successEmbed, errorEmbed, noPermissionEmbed, disabledModuleEmbed } from '../../views/base.js';
import {
  buildSearchItemModal,
  buildSearchArtisanModal,
  buildSearchBonusModal,
  buildConfigPanelEmbed,
  buildConfigPanelRows,
  buildChannelSelectEmbed,
  buildChannelSelectRows,
  buildRoleSelectEmbed,
  buildRoleSelectRows,
  buildFlagsEmbed,
  buildFlagsSelectRow,
  buildOfficerPanelEmbed,
  buildOfficerPanelRows,
} from './views.js';

// Imports from other modules — reuse their logic
import * as almanaxClient from '../../integrations/almanax/client.js';
import { buildAlmanaxEmbed, buildAlmanaxWeekEmbed } from '../D-almanax/views.js';
import { buildActivityListEmbed } from '../B-activities/views.js';
import { buildProfessionListEmbed, buildCrafterSearchEmbed } from '../E-professions/views.js';
import { buildRewardListEmbed } from '../F-rewards/views.js';

const log = childLogger('panel');

// ── Module flag check helper ──

async function checkModuleEnabled(interaction: ButtonInteraction, moduleName: string): Promise<boolean> {
  const flag = MODULE_FLAGS[moduleName];
  if (!flag) return true;
  const guildId = interaction.guildId!;
  if (!(await isEnabled(guildId, flag))) {
    await interaction.reply({ embeds: [disabledModuleEmbed(moduleName)], ephemeral: true });
    return false;
  }
  return true;
}

// ══════════════════════════════════════════════
//  MAIN BUTTON HANDLER — routes panel:* buttons
// ══════════════════════════════════════════════

export async function handlePanelButton(interaction: ButtonInteraction): Promise<void> {
  const action = interaction.customId.replace('panel:', '');

  switch (action) {
    // ── Almanax ──
    case 'almanax_today':
      if (!(await checkModuleEnabled(interaction, 'D-almanax'))) return;
      return handleAlmanaxToday(interaction);
    case 'almanax_semaine':
      if (!(await checkModuleEnabled(interaction, 'D-almanax'))) return;
      return handleAlmanaxSemaine(interaction);
    case 'almanax_bonus':
      if (!(await checkModuleEnabled(interaction, 'D-almanax'))) return;
      return interaction.showModal(buildSearchBonusModal());

    // ── Activities ──
    case 'sortie_creer': {
      if (!(await checkModuleEnabled(interaction, 'B-activities'))) return;
      return showSortieModal(interaction);
    }
    case 'lfg': {
      if (!(await checkModuleEnabled(interaction, 'B-activities'))) return;
      return showLfgModal(interaction);
    }
    case 'sortie_liste':
      if (!(await checkModuleEnabled(interaction, 'B-activities'))) return;
      return handleSortieListe(interaction);

    // ── Professions ──
    case 'metier_inscrire': {
      if (!(await checkModuleEnabled(interaction, 'E-professions'))) return;
      return showMetierInscrireModal(interaction);
    }
    case 'metier_chercher':
      if (!(await checkModuleEnabled(interaction, 'E-professions'))) return;
      return interaction.showModal(buildSearchArtisanModal());
    case 'craft_demande': {
      if (!(await checkModuleEnabled(interaction, 'E-professions'))) return;
      return showCraftDemandeModal(interaction);
    }
    case 'metier_liste':
      if (!(await checkModuleEnabled(interaction, 'E-professions'))) return;
      return handleMetierListe(interaction);
    case 'metier_dispo':
      if (!(await checkModuleEnabled(interaction, 'E-professions'))) return;
      return handleMetierDispo(interaction);

    // ── Encyclopedia ──
    case 'dofus_chercher':
      if (!(await checkModuleEnabled(interaction, 'C-encyclopedia'))) return;
      return interaction.showModal(buildSearchItemModal());

    // ── Forum ──
    case 'demande_creer': {
      if (!(await checkModuleEnabled(interaction, 'H-forum'))) return;
      return showDemandeModal(interaction);
    }

    // ── Rewards ──
    case 'recompense_liste':
      if (!(await checkModuleEnabled(interaction, 'F-rewards'))) return;
      return handleRecompenseListe(interaction);
    case 'recompense_creer': {
      if (!(await checkModuleEnabled(interaction, 'F-rewards'))) return;
      return showRecompenseModal(interaction);
    }

    // ── Config (admin) ──
    case 'config_salons':
      return handleConfigSalons(interaction);
    case 'config_roles':
      return handleConfigRoles(interaction);
    case 'config_flags':
      return handleConfigFlags(interaction);

    // ── Officer ──
    case 'officer':
      return handleOfficerPanel(interaction);

    default:
      log.warn({ action }, 'Unknown panel button');
  }
}

// ══════════════════════════════════
//  DIRECT RESPONSE HANDLERS
// ══════════════════════════════════

async function handleAlmanaxToday(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  try {
    const { data, stale } = await almanaxClient.getToday();
    const embed = buildAlmanaxEmbed(data, stale);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err }, 'Panel almanax today error');
    await interaction.editReply({ embeds: [errorEmbed('Impossible de récupérer l\'Almanax.')] });
  }
}

async function handleAlmanaxSemaine(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  try {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 6);
    const { data, stale } = await almanaxClient.getRange(from, to);
    const embed = buildAlmanaxWeekEmbed(data, stale);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err }, 'Panel almanax semaine error');
    await interaction.editReply({ embeds: [errorEmbed('Impossible de récupérer la semaine.')] });
  }
}

async function handleSortieListe(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  try {
    const guildId = interaction.guildId!;
    const activities = await db().activity.findMany({
      where: { guildId, status: 'published', scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: 'asc' },
      take: 15,
      include: { signups: true },
    });
    const embed = buildActivityListEmbed(activities);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err }, 'handleSortieListe error');
    await interaction.editReply({ embeds: [errorEmbed('Erreur lors de la récupération des sorties.')] });
  }
}

async function handleMetierListe(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  try {
    const profiles = await db().professionProfile.findMany({
      where: { guildId: interaction.guildId!, userId: interaction.user.id },
      orderBy: { profession: 'asc' },
    });
    const embed = buildProfessionListEmbed(profiles, interaction.user.displayName);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err }, 'handleMetierListe error');
    await interaction.editReply({ embeds: [errorEmbed('Erreur lors de la récupération de tes métiers.')] });
  }
}

async function handleMetierDispo(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  try {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    const current = await db().crafterAvailability.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    const newAvailable = !(current?.available ?? true);

    await db().crafterAvailability.upsert({
      where: { guildId_userId: { guildId, userId } },
      create: { guildId, userId, available: newAvailable },
      update: { available: newAvailable },
    });

    await db().professionProfile.updateMany({
      where: { guildId, userId },
      data: { available: newAvailable },
    });

    const status = newAvailable ? 'disponible' : 'indisponible';
    await interaction.editReply({
      embeds: [successEmbed(`Tu es maintenant marqué comme **${status}** pour tes métiers.`)],
    });
  } catch (err) {
    log.error({ err }, 'handleMetierDispo error');
    await interaction.editReply({ embeds: [errorEmbed('Erreur lors du changement de disponibilité.')] });
  }
}

async function handleRecompenseListe(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  try {
    const rewards = await db().reward.findMany({
      where: {
        recipientId: interaction.user.id,
        guildId: interaction.guildId!,
        status: { in: ['pending', 'claimable', 'claimed'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const embed = buildRewardListEmbed(rewards);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err }, 'handleRecompenseListe error');
    await interaction.editReply({ embeds: [errorEmbed('Erreur lors de la récupération des récompenses.')] });
  }
}

// ══════════════════════════════════
//  MODAL OPENERS (reuse existing modal IDs)
// ══════════════════════════════════

async function showSortieModal(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.OFFICER, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.OFFICER))],
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('sortie_creer')
    .setTitle('Créer une sortie')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('titre')
          .setLabel('Titre de la sortie')
          .setPlaceholder('Ex: Donjon Comte Harebourg')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('type')
          .setLabel('Type (donjon/koli/songe/quete/farm/pvp/autre)')
          .setPlaceholder('donjon')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('date_heure')
          .setLabel('Date et heure (JJ/MM/AAAA HH:MM)')
          .setPlaceholder('15/04/2026 20:30')
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('duree_max')
          .setLabel('Durée (min) / Max joueurs (optionnel)')
          .setPlaceholder('120/8')
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description (optionnel)')
          .setPlaceholder('Infos supplémentaires...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500),
      ),
    );

  await interaction.showModal(modal);
}

async function showLfgModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('lfg_creer')
    .setTitle('Chercher un groupe')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('activite')
          .setLabel('Activité')
          .setPlaceholder('Ex: Donjon Tal Kasha, Koli 3v3...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('joueurs')
          .setLabel('Nombre de joueurs recherchés')
          .setPlaceholder('3')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(2),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('duree')
          .setLabel('Durée en heures (0.5 à 6)')
          .setPlaceholder('1 (ou 0.5 pour 30min)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('niveau')
          .setLabel('Niveau minimum (optionnel)')
          .setPlaceholder('Ex: 100')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(3),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('commentaire')
          .setLabel('Commentaire (optionnel)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(200),
      ),
    );

  await interaction.showModal(modal);
}

async function showMetierInscrireModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('metier_inscrire')
    .setTitle('Inscrire un métier')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('profession')
          .setLabel('Métier')
          .setPlaceholder('Ex: Bijoutier, Cordonnier, Forgeur de Dagues...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('level')
          .setLabel('Niveau (1-200)')
          .setPlaceholder('200')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('note')
          .setLabel('Note (optionnel)')
          .setPlaceholder('Ex: spécialisé forgemagie')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(200),
      ),
    );

  await interaction.showModal(modal);
}

async function showCraftDemandeModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('craft_demande')
    .setTitle('Demande de craft')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('profession')
          .setLabel('Métier nécessaire')
          .setPlaceholder('Ex: Bijoutier')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('item_name')
          .setLabel('Nom de l\'objet')
          .setPlaceholder('Ex: Gelano')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('quantity')
          .setLabel('Quantité')
          .setPlaceholder('1')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(4),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description (optionnel)')
          .setPlaceholder('Précisions, matériaux fournis, etc.')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(300),
      ),
    );

  await interaction.showModal(modal);
}

async function showDemandeModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('demande_creer')
    .setTitle('Créer une demande')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Titre')
          .setPlaceholder('Ex: Besoin d\'aide pour quête Dofus Ocre')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setPlaceholder('Décris ta demande en détail...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('tag')
          .setLabel('Tag (aide/donjon/craft/koli/songes/question/guilde)')
          .setPlaceholder('aide')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(30),
      ),
    );

  await interaction.showModal(modal);
}

async function showRecompenseModal(interaction: ButtonInteraction): Promise<void> {
  // Check officer permission
  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.OFFICER, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.OFFICER))],
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('recompense_creer')
    .setTitle('Créer une récompense')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('recipient')
          .setLabel('Destinataire (@mention ou ID)')
          .setPlaceholder('Ex: @Joueur ou 123456789012345678')
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Titre de la récompense')
          .setPlaceholder('Ex: Participation raid de guilde')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Montant (optionnel)')
          .setPlaceholder('Ex: 500k kamas, 1x Dofus Turquoise')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Raison (optionnel)')
          .setPlaceholder('Détails supplémentaires...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(300),
      ),
    );

  await interaction.showModal(modal);
}

// ══════════════════════════════════
//  CONFIG HANDLERS (admin only)
// ══════════════════════════════════

async function requireAdmin(interaction: ButtonInteraction): Promise<boolean> {
  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.ADMIN, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.ADMIN))],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

async function handleConfigSalons(interaction: ButtonInteraction): Promise<void> {
  if (!(await requireAdmin(interaction))) return;
  try {
    const embed = buildChannelSelectEmbed();
    const rows = buildChannelSelectRows();
    await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  } catch (err) {
    log.error({ err }, 'handleConfigSalons error');
    await interaction.reply({ embeds: [errorEmbed('Erreur lors du chargement de la configuration des salons.')], ephemeral: true }).catch(() => {});
  }
}

async function handleConfigRoles(interaction: ButtonInteraction): Promise<void> {
  if (!(await requireAdmin(interaction))) return;
  try {
    const embed = buildRoleSelectEmbed();
    const rows = buildRoleSelectRows();
    await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  } catch (err) {
    log.error({ err }, 'handleConfigRoles error');
    await interaction.reply({ embeds: [errorEmbed('Erreur lors du chargement de la configuration des rôles.')], ephemeral: true }).catch(() => {});
  }
}

async function handleConfigFlags(interaction: ButtonInteraction): Promise<void> {
  if (!(await requireAdmin(interaction))) return;
  try {
    const guildId = interaction.guildId!;
    const flags = await getAllFlags(guildId);
    const embed = buildFlagsEmbed(flags);
    const rows = buildFlagsSelectRow(flags);
    await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  } catch (err) {
    log.error({ err }, 'handleConfigFlags error');
    await interaction.reply({ embeds: [errorEmbed('Erreur lors du chargement des feature flags.')], ephemeral: true }).catch(() => {});
  }
}

async function handleOfficerPanel(interaction: ButtonInteraction): Promise<void> {
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

// ══════════════════════════════════
//  SELECT MENU HANDLERS
// ══════════════════════════════════

const CHANNEL_DB_MAP: Record<string, string> = {
  sorties: 'sortiesChannelId',
  almanax: 'almanaxChannelId',
  metiers: 'metiersChannelId',
  forum: 'forumChannelId',
  logs: 'logChannelId',
  officers: 'officersChannelId',
  annonces: 'annoncesChannelId',
};

const ROLE_DB_MAP: Record<string, string> = {
  admin: 'adminRoleId',
  officier: 'officerRoleId',
  veteran: 'veteranRoleId',
  membre: 'memberRoleId',
};

export async function handlePanelChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.ADMIN, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.ADMIN))],
      ephemeral: true,
    });
    return;
  }

  const parts = interaction.customId.split(':');
  const channelType = parts[2]; // panel:select_channel:sorties
  const dbField = CHANNEL_DB_MAP[channelType];
  if (!dbField) return;

  const guildId = interaction.guildId!;
  const channelId = interaction.values[0] ?? null;

  await db().discordGuild.upsert({
    where: { guildId },
    create: { guildId, [dbField]: channelId },
    update: { [dbField]: channelId },
  });

  const channelMention = channelId ? `<#${channelId}>` : 'aucun';
  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'config.salon',
    details: { [channelType]: channelMention },
  });

  await interaction.reply({
    embeds: [successEmbed(`Salon **${channelType}** configuré : ${channelMention}`)],
    ephemeral: true,
  });
}

export async function handlePanelRoleSelect(interaction: RoleSelectMenuInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.ADMIN, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.ADMIN))],
      ephemeral: true,
    });
    return;
  }

  const parts = interaction.customId.split(':');
  const roleType = parts[2]; // panel:select_role:admin
  const dbField = ROLE_DB_MAP[roleType];
  if (!dbField) return;

  const guildId = interaction.guildId!;
  const roleId = interaction.values[0] ?? null;

  await db().discordGuild.upsert({
    where: { guildId },
    create: { guildId, [dbField]: roleId },
    update: { [dbField]: roleId },
  });

  const roleMention = roleId ? `<@&${roleId}>` : 'aucun';
  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'config.role',
    details: { [roleType]: roleMention },
  });

  await interaction.reply({
    embeds: [successEmbed(`Rôle **${roleType}** configuré : ${roleMention}`)],
    ephemeral: true,
  });
}

export async function handlePanelFlagToggle(interaction: StringSelectMenuInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.ADMIN, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.ADMIN))],
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guildId!;
  const flag = interaction.values[0];
  if (!flag) return;

  const flags = await getAllFlags(guildId);
  const currentValue = flags[flag] ?? false;
  const newValue = !currentValue;

  await setFlag(guildId, flag, newValue);

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'config.flag',
    details: { flag, from: currentValue, to: newValue },
  });

  // Refresh the flags view
  const updatedFlags = await getAllFlags(guildId);
  const embed = buildFlagsEmbed(updatedFlags);
  const rows = buildFlagsSelectRow(updatedFlags);

  await interaction.update({ embeds: [embed], components: rows });
}
