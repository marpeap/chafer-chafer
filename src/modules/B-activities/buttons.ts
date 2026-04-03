import {
  ButtonInteraction,
  TextChannel,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  GuildMember,
} from 'discord.js';
import { db } from '../../core/database.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed, successEmbed, noPermissionEmbed, Emoji } from '../../views/base.js';
import { audit } from '../../core/audit.js';
import { buildActivityEmbed, buildQuickCallEmbed, buildSearchCancelledEmbed } from './views.js';
import { getMemberLevel, requireLevel, PermissionLevel, levelName } from '../../core/permissions.js';

const log = childLogger('activities:buttons');

export async function handleActivityButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

  // 2-step type selection buttons: activity:type_select:{flowType}:{type}
  if (customId.startsWith('activity:type_select:')) {
    return handleTypeSelect(interaction);
  }

  // Cancel search button: activity:cancel_search:{id}
  if (customId.startsWith('activity:cancel_search:')) {
    return handleCancelSearch(interaction);
  }

  // Release rewards button: activity:release_rewards:{id}
  if (customId.startsWith('activity:release_rewards:')) {
    return handleReleaseRewards(interaction);
  }

  if (customId.startsWith('activity:')) {
    return handleActivitySignup(interaction);
  }
  if (customId.startsWith('lfg:')) {
    return handleLfgResponse(interaction);
  }

  log.warn({ customId }, 'Unknown activity button');
}

async function handleTypeSelect(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  // activity:type_select:{flowType}:{type}
  if (parts.length !== 4) return;

  const flowType = parts[2]; // 'sortie' | 'lfg'
  const activityType = parts[3];

  if (flowType === 'sortie') {
    // Permission check — sortie creation requires OFFICER
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
      .setCustomId(`sortie_creer:${activityType}`)
      .setTitle('Cr\u00E9er une sortie')
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
            .setCustomId('date_heure')
            .setLabel('Date et heure (JJ/MM/AAAA HH:MM)')
            .setPlaceholder('15/04/2026 20:30')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(20),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('duree_max')
            .setLabel('Dur\u00E9e (min) / Max joueurs (optionnel)')
            .setPlaceholder('120/8')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(20),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description / R\u00F4les (optionnel)')
            .setPlaceholder('Ex: 2 Tank, 2 Heal, 4 DPS\nD\u00E9tails de la sortie...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('recompense')
            .setLabel('R\u00E9compense (optionnel)')
            .setPlaceholder('Ex: Butin raid | 500k kamas')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(150),
        ),
      );

    await interaction.showModal(modal);
  } else if (flowType === 'lfg') {
    const modal = new ModalBuilder()
      .setCustomId(`lfg_creer:${activityType}`)
      .setTitle('LFG \u2014 Appel rapide')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('joueurs')
            .setLabel('Joueurs recherch\u00E9s')
            .setPlaceholder('ex: 3')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(3),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('duree')
            .setLabel('Dur\u00E9e en heures (0.5 \u00E0 6)')
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
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('D\u00E9tails suppl\u00E9mentaires...')
            .setRequired(false)
            .setMaxLength(500),
        ),
      );

    await interaction.showModal(modal);
  }
}

async function handleActivitySignup(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  // Format: activity:<action>:<id>  OR  activity:role:<roleName>:<id>
  let action: string;
  let activityId: number;
  let selectedRole: string | null = null;

  if (parts.length === 4 && parts[1] === 'role') {
    // Role-specific button: activity:role:tank:123
    action = 'role';
    selectedRole = parts[2]; // tank, heal, dps
    activityId = parseInt(parts[3], 10);
  } else if (parts.length === 3) {
    // Standard button: activity:join:123
    action = parts[1];
    activityId = parseInt(parts[2], 10);
  } else {
    return;
  }

  if (isNaN(activityId)) return;

  await interaction.deferUpdate();

  const activity = await db().activity.findFirst({
    where: { id: activityId, guildId: interaction.guildId! },
    include: { signups: true },
  });

  if (!activity) {
    await interaction.followUp({ embeds: [errorEmbed('Sortie introuvable.')], ephemeral: true });
    return;
  }

  if (activity.status === 'cancelled' || activity.status === 'closed') {
    await interaction.followUp({ embeds: [errorEmbed('Cette sortie est terminée.')], ephemeral: true });
    return;
  }

  // Map button action to signup status
  const statusMap: Record<string, string> = {
    join: 'confirmed',
    maybe: 'maybe',
    unavailable: 'unavailable',
    role: 'confirmed', // role buttons auto-confirm with a role
  };
  const signupStatus = statusMap[action];
  if (!signupStatus) return;

  // For non-role buttons, clear any existing role assignment
  const roleToSet = action === 'role' ? selectedRole : null;

  // Check if user already has this exact status + role (toggle off)
  const existing = activity.signups.find((s) => s.userId === interaction.user.id);
  const isToggleOff = existing && existing.status === signupStatus && existing.role === roleToSet;

  // Enforce maxPlayers when user is trying to confirm (not toggle off)
  if (!isToggleOff && (signupStatus === 'confirmed') && activity.maxPlayers) {
    const confirmedCount = activity.signups.filter((s) => s.status === 'confirmed').length;
    const alreadyConfirmed = existing?.status === 'confirmed';
    if (!alreadyConfirmed && confirmedCount >= activity.maxPlayers) {
      await interaction.followUp({
        embeds: [errorEmbed(`La sortie est complete (${confirmedCount}/${activity.maxPlayers}).`)],
        ephemeral: true,
      });
      return;
    }
  }

  if (isToggleOff) {
    // Remove signup (toggle)
    await db().activitySignup.delete({ where: { id: existing.id } });
  } else {
    // Upsert signup with role
    await db().activitySignup.upsert({
      where: {
        activityId_userId: {
          activityId,
          userId: interaction.user.id,
        },
      },
      create: {
        activityId,
        userId: interaction.user.id,
        status: signupStatus,
        role: roleToSet,
      },
      update: {
        status: signupStatus,
        role: roleToSet,
      },
    });
  }

  // Refresh and update embed
  const updated = await db().activity.findFirst({
    where: { id: activityId, guildId: interaction.guildId! },
    include: { signups: true },
  });

  if (updated) {
    const card = buildActivityEmbed(updated, updated.signups);
    try {
      await interaction.editReply({ embeds: card.embeds, components: card.components });
    } catch (err) {
      log.warn({ err, activityId }, 'Failed to update activity embed');
    }
  }
}

async function handleLfgResponse(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  // Format: lfg:<action>:<id>
  if (parts.length !== 3) return;

  const action = parts[1]; // partant, lead, pass
  const quickCallId = parseInt(parts[2], 10);
  if (isNaN(quickCallId)) return;

  await interaction.deferUpdate();

  const quickCall = await db().quickCall.findFirst({
    where: { id: quickCallId, guildId: interaction.guildId! },
    include: { responses: true },
  });

  if (!quickCall) {
    await interaction.followUp({ embeds: [errorEmbed('LFG introuvable.')], ephemeral: true });
    return;
  }

  if (quickCall.status !== 'open' && quickCall.status !== 'filled') {
    await interaction.followUp({ embeds: [errorEmbed('Ce LFG n\'est plus actif.')], ephemeral: true });
    return;
  }

  // Map button action to response status
  const statusMap: Record<string, string> = {
    partant: 'partant',
    lead: 'lead',
    pass: 'pas_ce_soir',
  };
  const responseStatus = statusMap[action];
  if (!responseStatus) return;

  // Check if user already has this status (toggle off)
  const existing = quickCall.responses.find((r) => r.userId === interaction.user.id);
  if (existing && existing.status === responseStatus) {
    // Remove response (toggle)
    await db().quickCallResponse.delete({ where: { id: existing.id } });
  } else {
    // Upsert response
    await db().quickCallResponse.upsert({
      where: {
        quickCallId_userId: {
          quickCallId,
          userId: interaction.user.id,
        },
      },
      create: {
        quickCallId,
        userId: interaction.user.id,
        status: responseStatus,
      },
      update: {
        status: responseStatus,
      },
    });
  }

  // Check if LFG is now filled
  const updatedCall = await db().quickCall.findFirst({
    where: { id: quickCallId, guildId: interaction.guildId! },
    include: { responses: true },
  });

  if (updatedCall) {
    const activeResponders = updatedCall.responses.filter(
      (r) => r.status === 'partant' || r.status === 'lead',
    ).length;

    // Auto-fill if enough players, revert to open if below threshold
    if (activeResponders >= updatedCall.playersNeeded && updatedCall.status === 'open') {
      await db().quickCall.update({
        where: { id: quickCallId },
        data: { status: 'filled' },
      });
      updatedCall.status = 'filled';
    } else if (activeResponders < updatedCall.playersNeeded && updatedCall.status === 'filled') {
      await db().quickCall.update({
        where: { id: quickCallId },
        data: { status: 'open' },
      });
      updatedCall.status = 'open';
    }

    const card = buildQuickCallEmbed(updatedCall, updatedCall.responses);
    try {
      await interaction.editReply({ embeds: card.embeds, components: card.components });
    } catch (err) {
      log.warn({ err, quickCallId }, 'Failed to update LFG embed');
    }
  }
}

// ────────────────── Release Rewards ──────────────────

async function handleReleaseRewards(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  // Format: activity:release_rewards:<id>
  if (parts.length !== 3) return;

  const activityId = parseInt(parts[2], 10);
  if (isNaN(activityId)) return;

  // OFFICER permission check
  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.OFFICER, level)) {
    await interaction.reply({
      embeds: [noPermissionEmbed(levelName(PermissionLevel.OFFICER))],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  const guildId = interaction.guildId!;

  const activity = await db().activity.findFirst({
    where: { id: activityId, guildId },
    include: { signups: true },
  });

  if (!activity) {
    await interaction.followUp({ embeds: [errorEmbed('Sortie introuvable.')], ephemeral: true });
    return;
  }

  if (!activity.rewardTitle) {
    await interaction.followUp({ embeds: [errorEmbed('Cette sortie n\'a pas de récompense associée.')], ephemeral: true });
    return;
  }

  if (activity.rewardsReleased) {
    await interaction.followUp({ embeds: [errorEmbed('Les récompenses ont déjà été libérées pour cette sortie.')], ephemeral: true });
    return;
  }

  const confirmedSignups = activity.signups.filter((s) => s.status === 'confirmed');

  if (confirmedSignups.length === 0) {
    await interaction.followUp({ embeds: [errorEmbed('Aucun participant confirmé pour cette sortie.')], ephemeral: true });
    return;
  }

  // Create rewards in transaction (prevents double-release)
  await db().$transaction(async (tx) => {
    await tx.activity.update({
      where: { id: activityId },
      data: { rewardsReleased: true },
    });

    for (const signup of confirmedSignups) {
      const reward = await tx.reward.create({
        data: {
          guildId,
          createdBy: interaction.user.id,
          recipientId: signup.userId,
          title: activity.rewardTitle!,
          amount: activity.rewardAmount,
          reason: `Participation à la sortie : ${activity.title}`,
          status: 'claimable',
          activityId,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          guildId,
          rewardId: reward.id,
          actorId: interaction.user.id,
          action: 'created',
          fromStatus: null,
          toStatus: 'claimable',
          note: `Auto-créé depuis la sortie #${activityId}`,
        },
      });
    }
  });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'activity.release_rewards',
    targetType: 'activity',
    targetId: String(activityId),
    details: {
      title: activity.title,
      rewardTitle: activity.rewardTitle,
      rewardAmount: activity.rewardAmount,
      participantCount: confirmedSignups.length,
    },
  });

  // Refresh embed (removes release button)
  const updated = await db().activity.findFirst({
    where: { id: activityId, guildId },
    include: { signups: true },
  });

  if (updated) {
    const card = buildActivityEmbed(updated, updated.signups);
    try {
      await interaction.editReply({ embeds: card.embeds, components: card.components });
    } catch (err) {
      log.warn({ err, activityId }, 'Failed to update activity embed after reward release');
    }
  }

  await interaction.followUp({
    embeds: [successEmbed(
      `${Emoji.TROPHY} **${confirmedSignups.length}** récompenses libérées pour **${activity.title}** !\n` +
      `Chaque participant confirmé recevra : **${activity.rewardTitle}**` +
      (activity.rewardAmount ? ` (${activity.rewardAmount})` : '') +
      `.\nLes récompenses sont réclamables depuis \`/recompense liste\`.`,
    )],
  });

  log.info({ activityId, guildId, rewardCount: confirmedSignups.length }, 'Rewards released for activity');
}

async function handleCancelSearch(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  // Format: activity:cancel_search:{id}
  if (parts.length !== 3) return;

  const searchId = parseInt(parts[2], 10);
  if (isNaN(searchId)) return;

  await interaction.deferUpdate();

  try {
    const searchEntry = await db().searchQueue.findFirst({
      where: {
        id: searchId,
        guildId: interaction.guildId!,
      },
    });

    if (!searchEntry) {
      await interaction.followUp({
        embeds: [errorEmbed('Recherche introuvable.')],
        ephemeral: true,
      });
      return;
    }

    // Only the user who created the search can cancel it
    if (searchEntry.userId !== interaction.user.id) {
      await interaction.followUp({
        embeds: [errorEmbed('Tu ne peux annuler que ta propre recherche.')],
        ephemeral: true,
      });
      return;
    }

    if (searchEntry.matched) {
      await interaction.followUp({
        embeds: [errorEmbed('Cette recherche a déjà trouvé un groupe.')],
        ephemeral: true,
      });
      return;
    }

    // Delete the search entry
    await db().searchQueue.delete({ where: { id: searchId } });

    // Update the message to show cancelled
    const cancelledEmbed = buildSearchCancelledEmbed();
    try {
      await interaction.editReply({
        embeds: [cancelledEmbed],
        components: [], // remove buttons
      });
    } catch (err) {
      log.warn({ err, searchId }, 'Failed to update cancelled search message');
    }

    log.info({ searchId, userId: interaction.user.id }, 'Search cancelled');
  } catch (err) {
    log.error({ err, searchId }, 'Failed to cancel search');
    await interaction.followUp({
      embeds: [errorEmbed('Erreur lors de l\'annulation de la recherche.')],
      ephemeral: true,
    });
  }
}
