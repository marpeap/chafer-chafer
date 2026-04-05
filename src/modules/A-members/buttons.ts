/**
 * @module A-members/buttons
 * @description Handles button interactions for member management: join, profile, approve, reject, glandeur.
 *
 * Each handler parses the Discord interaction, delegates business logic to member.service,
 * then handles Discord-specific responses (embeds, DMs, role assignments).
 *
 * Depends on: services/member, core/permissions, A-members/views
 */

import { ButtonInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { db } from '../../core/database.js';
import { childLogger } from '../../core/logger.js';
import { getMemberLevel, requireLevel, PermissionLevel, levelName } from '../../core/permissions.js';
import { successEmbed, errorEmbed, noPermissionEmbed } from '../../views/base.js';
import {
  buildProfileEmbed,
  buildProfileViewButtons,
  buildProfileEditModal,
  buildProfessions200Modal,
} from './views.js';
import {
  getProfileStats,
  approveMember,
  rejectMember,
  toggleGlandeurDispo,
} from '../../services/member.service.js';

const log = childLogger('A-members:buttons');

export async function handleMemberButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  // Format: member:<action>:<id?>
  const action = parts[1];
  const idStr = parts[2];

  switch (action) {
    case 'devenir_chafer':
      return handleDevenirChafer(interaction);
    case 'profile':
      return handleProfile(interaction);
    case 'edit_profile':
      return handleEditProfile(interaction);
    case 'edit_professions200':
      return handleEditProfessions200(interaction);
    case 'approve':
      return handleApprove(interaction, parseInt(idStr, 10));
    case 'reject':
      return handleReject(interaction, parseInt(idStr, 10));
    case 'glandeur_dispo':
      return handleGlandeurDispo(interaction);
    default:
      log.warn({ action }, 'Unknown member button action');
  }
}

// ────────────────── Devenir Chafer ──────────────────

async function handleDevenirChafer(interaction: ButtonInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const existing = await db().playerProfile.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  if (existing) {
    if (existing.status === 'approved') {
      await interaction.reply({
        embeds: [errorEmbed('Tu es d\u00e9j\u00e0 Chafer !')],
        ephemeral: true,
      });
      return;
    }
    if (existing.status === 'pending') {
      await interaction.reply({
        embeds: [errorEmbed('Ta demande est en cours de validation.')],
        ephemeral: true,
      });
      return;
    }
    // rejected -> allow re-application: show create modal
  }

  const modal = buildProfileEditModal('member:profile_create');
  await interaction.showModal(modal);
}

// ────────────────── View profile ──────────────────

async function handleProfile(interaction: ButtonInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const profile = await db().playerProfile.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  if (!profile) {
    await interaction.reply({
      embeds: [errorEmbed('Tu dois d\'abord devenir Chafer !')],
      ephemeral: true,
    });
    return;
  }

  const stats = await getProfileStats(guildId, userId);

  const member = interaction.member as GuildMember;
  const embed = buildProfileEmbed(profile, member, stats);
  const buttons = buildProfileViewButtons();

  await interaction.reply({
    embeds: [embed],
    components: [buttons],
    ephemeral: true,
  });
}

// ────────────────── Edit profile ──────────────────

async function handleEditProfile(interaction: ButtonInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const profile = await db().playerProfile.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  if (!profile) {
    await interaction.reply({
      embeds: [errorEmbed('Tu dois d\'abord devenir Chafer !')],
      ephemeral: true,
    });
    return;
  }

  const modal = buildProfileEditModal('member:profile_edit');
  await interaction.showModal(modal);
}

// ────────────────── Edit professions 200 ──────────────────

async function handleEditProfessions200(interaction: ButtonInteraction): Promise<void> {
  const modal = buildProfessions200Modal();
  await interaction.showModal(modal);
}

// ────────────────── Approve ──────────────────

/** Approve a pending member profile — delegates logic to member.service */
async function handleApprove(interaction: ButtonInteraction, profileId: number): Promise<void> {
  if (isNaN(profileId)) {
    await interaction.reply({ embeds: [errorEmbed('ID de profil invalide.')], ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.OFFICER, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.OFFICER))],
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guildId!;

  // Delegate business logic to service
  const result = await approveMember(guildId, profileId, interaction.user.id);
  if (!result.success) {
    await interaction.reply({ embeds: [errorEmbed(result.error!)], ephemeral: true });
    return;
  }

  // Discord-specific: fetch profile for userId (needed for role + DM)
  const profile = await db().playerProfile.findFirst({ where: { id: profileId, guildId } });

  // Assign guild role if configured
  if (result.memberRoleId && profile) {
    try {
      const targetMember = await interaction.guild?.members.fetch(profile.userId);
      if (targetMember) await targetMember.roles.add(result.memberRoleId);
    } catch (err) {
      log.warn({ err, userId: profile?.userId }, 'Failed to add member role');
    }
  }

  // DM the user
  if (profile) {
    try {
      const user = await interaction.client.users.fetch(profile.userId);
      await user.send('Ta demande a \u00e9t\u00e9 accept\u00e9e ! Bienvenue chez les Chafers \u{1F480}');
    } catch (err) {
      log.warn({ err, userId: profile.userId }, 'Failed to DM user about approval');
    }
  }

  // Update the admin message embed
  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbeds = originalEmbed
    ? [EmbedBuilder.from(originalEmbed)
        .setColor(0x2ecc71)
        .setFooter({ text: `\u2705 Valid\u00e9 par ${interaction.user.displayName}` })]
    : [];

  await interaction.update({ embeds: updatedEmbeds, components: [] });
}

// ────────────────── Reject ──────────────────

/** Reject a pending member profile — delegates logic to member.service */
async function handleReject(interaction: ButtonInteraction, profileId: number): Promise<void> {
  if (isNaN(profileId)) {
    await interaction.reply({ embeds: [errorEmbed('ID de profil invalide.')], ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.OFFICER, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.OFFICER))],
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guildId!;

  // Delegate business logic to service
  const result = await rejectMember(guildId, profileId, interaction.user.id);
  if (!result.success) {
    await interaction.reply({ embeds: [errorEmbed(result.error!)], ephemeral: true });
    return;
  }

  // DM the user
  const profile = await db().playerProfile.findFirst({ where: { id: profileId, guildId } });
  if (profile) {
    try {
      const user = await interaction.client.users.fetch(profile.userId);
      await user.send('Ta demande a \u00e9t\u00e9 refus\u00e9e.');
    } catch (err) {
      log.warn({ err, userId: profile.userId }, 'Failed to DM user about rejection');
    }
  }

  // Update the admin message embed
  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbeds = originalEmbed
    ? [EmbedBuilder.from(originalEmbed)
        .setColor(0xe74c3c)
        .setFooter({ text: `\u274C Refus\u00e9 par ${interaction.user.displayName}` })]
    : [];

  await interaction.update({ embeds: updatedEmbeds, components: [] });
}

/** Toggle "Glandeur Dispo" — delegates logic to member.service */
async function handleGlandeurDispo(interaction: ButtonInteraction): Promise<void> {
  const result = await toggleGlandeurDispo(interaction.guildId!, interaction.user.id);

  if (!result.success) {
    await interaction.reply({ embeds: [errorEmbed(result.error!)], ephemeral: true });
    return;
  }

  const statusText = result.newAvailable
    ? '\u{1F680} Tu es maintenant **Glandeur Dispo** ! (visible et disponible pour tout)'
    : 'Tu n\'es plus Glandeur Dispo.';

  await interaction.reply({ embeds: [successEmbed(statusText)], ephemeral: true });
}
