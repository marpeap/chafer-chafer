import { ButtonInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { childLogger } from '../../core/logger.js';
import { getMemberLevel, requireLevel, PermissionLevel, levelName } from '../../core/permissions.js';
import { successEmbed, errorEmbed, noPermissionEmbed } from '../../views/base.js';
import {
  buildProfileEmbed,
  buildProfileViewButtons,
  buildProfileEditModal,
  buildProfessions200Modal,
  type ProfileStats,
} from './views.js';

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

  const [activityCount, quickCallCount, craftsMade, craftsFulfilled, rewardsPaid] = await Promise.all([
    db().activitySignup.count({ where: { userId, activity: { guildId } } }),
    db().quickCallResponse.count({ where: { userId, quickCall: { guildId } } }),
    db().craftRequest.count({ where: { guildId, requesterId: userId } }),
    db().craftRequest.count({ where: { guildId, crafterId: userId } }),
    db().reward.count({ where: { guildId, recipientId: userId, status: 'paid' } }),
  ]);

  const stats: ProfileStats = {
    activityCount,
    quickCallCount,
    craftsMade,
    craftsFulfilled,
    rewardsPaid,
  };

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
  const profile = await db().playerProfile.findFirst({
    where: { id: profileId, guildId },
  });

  if (!profile) {
    await interaction.reply({ embeds: [errorEmbed('Profil introuvable.')], ephemeral: true });
    return;
  }

  if (profile.status === 'approved') {
    await interaction.reply({ embeds: [errorEmbed('Ce profil est d\u00e9j\u00e0 valid\u00e9.')], ephemeral: true });
    return;
  }

  await db().playerProfile.update({
    where: { id: profileId },
    data: {
      status: 'approved',
      approvedBy: interaction.user.id,
      approvedAt: new Date(),
    },
  });

  // Try to give the Chafer member role
  const guildConfig = await db().discordGuild.findUnique({
    where: { guildId },
  });

  if (guildConfig?.memberRoleId) {
    try {
      const targetMember = await interaction.guild?.members.fetch(profile.userId);
      if (targetMember) {
        await targetMember.roles.add(guildConfig.memberRoleId);
      }
    } catch (err) {
      log.warn({ err, userId: profile.userId }, 'Failed to add member role');
    }
  }

  // DM the user
  try {
    const user = await interaction.client.users.fetch(profile.userId);
    await user.send('Ta demande a \u00e9t\u00e9 accept\u00e9e ! Bienvenue chez les Chafers \u{1F480}');
  } catch (err) {
    log.warn({ err, userId: profile.userId }, 'Failed to DM user about approval');
  }

  // Audit
  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'member.approved',
    targetType: 'player_profile',
    targetId: String(profileId),
    details: { userId: profile.userId },
  });

  // Update the admin message
  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbeds = originalEmbed
    ? [EmbedBuilder.from(originalEmbed)
        .setColor(0x2ecc71)
        .setFooter({ text: `\u2705 Valid\u00e9 par ${interaction.user.displayName}` })]
    : [];

  await interaction.update({
    embeds: updatedEmbeds,
    components: [],
  });
}

// ────────────────── Reject ──────────────────

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
  const profile = await db().playerProfile.findFirst({
    where: { id: profileId, guildId },
  });

  if (!profile) {
    await interaction.reply({ embeds: [errorEmbed('Profil introuvable.')], ephemeral: true });
    return;
  }

  if (profile.status === 'rejected') {
    await interaction.reply({ embeds: [errorEmbed('Ce profil est d\u00e9j\u00e0 refus\u00e9.')], ephemeral: true });
    return;
  }

  await db().playerProfile.update({
    where: { id: profileId },
    data: { status: 'rejected' },
  });

  // DM the user
  try {
    const user = await interaction.client.users.fetch(profile.userId);
    await user.send('Ta demande a \u00e9t\u00e9 refus\u00e9e.');
  } catch (err) {
    log.warn({ err, userId: profile.userId }, 'Failed to DM user about rejection');
  }

  // Audit
  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'member.rejected',
    targetType: 'player_profile',
    targetId: String(profileId),
    details: { userId: profile.userId },
  });

  // Update the admin message
  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbeds = originalEmbed
    ? [EmbedBuilder.from(originalEmbed)
        .setColor(0xe74c3c)
        .setFooter({ text: `\u274C Refus\u00e9 par ${interaction.user.displayName}` })]
    : [];

  await interaction.update({
    embeds: updatedEmbeds,
    components: [],
  });
}

// ────────────────── Glandeur Dispo (stub for Phase 2) ──────────────────

async function handleGlandeurDispo(interaction: ButtonInteraction): Promise<void> {
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

  if (profile.status !== 'approved') {
    await interaction.reply({
      embeds: [errorEmbed('Ton profil doit \u00eatre valid\u00e9 pour utiliser cette fonctionnalit\u00e9.')],
      ephemeral: true,
    });
    return;
  }

  const newAvailable = !profile.globalAvailable;

  await db().playerProfile.update({
    where: { id: profile.id },
    data: { globalAvailable: newAvailable },
  });

  // Also toggle CrafterAvailability
  await db().crafterAvailability.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId, available: newAvailable },
    update: { available: newAvailable },
  });

  // Also toggle all profession profiles
  await db().professionProfile.updateMany({
    where: { guildId, userId },
    data: { available: newAvailable },
  });

  const statusText = newAvailable
    ? '\u{1F680} Tu es maintenant **Glandeur Dispo** ! (visible et disponible pour tout)'
    : 'Tu n\'es plus Glandeur Dispo.';

  await interaction.reply({
    embeds: [successEmbed(statusText)],
    ephemeral: true,
  });
}
