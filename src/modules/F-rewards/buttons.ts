import { ButtonInteraction, TextChannel } from 'discord.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed, successEmbed } from '../../views/base.js';
import { buildRewardEmbed } from './views.js';

const log = childLogger('F-rewards:buttons');

export async function handleRewardButton(interaction: ButtonInteraction): Promise<void> {
  const [, action, idStr] = interaction.customId.split(':');
  const rewardId = parseInt(idStr, 10);

  if (isNaN(rewardId)) {
    await interaction.reply({ embeds: [errorEmbed('ID de recompense invalide.')], ephemeral: true });
    return;
  }

  switch (action) {
    case 'claim':
      return handleClaim(interaction, rewardId);
    case 'dispute':
      return handleDispute(interaction, rewardId);
    default:
      log.warn({ action }, 'Unknown reward button action');
  }
}

// ────────────────── reward:claim:<id> ──────────────────

async function handleClaim(interaction: ButtonInteraction, rewardId: number): Promise<void> {
  const reward = await db().reward.findFirst({ where: { id: rewardId, guildId: interaction.guildId! } });

  if (!reward) {
    await interaction.reply({ embeds: [errorEmbed('Recompense introuvable.')], ephemeral: true });
    return;
  }

  // Only the recipient can claim
  if (reward.recipientId !== interaction.user.id) {
    await interaction.reply({
      embeds: [errorEmbed('Seul le destinataire peut reclamer cette recompense.')],
      ephemeral: true,
    });
    return;
  }

  if (reward.status !== 'claimable') {
    await interaction.reply({
      embeds: [errorEmbed(`Cette recompense ne peut pas etre reclamee (statut : ${reward.status}).`)],
      ephemeral: true,
    });
    return;
  }

  const previousStatus = reward.status;

  const updated = await db().reward.update({
    where: { id: rewardId },
    data: { status: 'claimed', claimedAt: new Date() },
  });

  await db().rewardClaim.create({
    data: {
      rewardId,
      userId: interaction.user.id,
      action: 'claim',
    },
  });

  await db().ledgerEntry.create({
    data: {
      guildId: reward.guildId,
      rewardId: reward.id,
      actorId: interaction.user.id,
      action: 'claimed',
      fromStatus: previousStatus,
      toStatus: 'claimed',
    },
  });

  await audit({
    guildId: reward.guildId,
    actorId: interaction.user.id,
    action: 'reward.claimed',
    targetType: 'reward',
    targetId: String(rewardId),
    details: { title: reward.title, amount: reward.amount },
  });

  // Update the message embed
  try {
    const embed = buildRewardEmbed(updated);
    await interaction.update({ embeds: [embed], components: [] });
  } catch (err) {
    log.warn({ err, rewardId }, 'Failed to update reward message on claim');
    await interaction.reply({
      embeds: [successEmbed(`Recompense **${reward.title}** reclamee avec succes.`)],
      ephemeral: true,
    });
  }
}

// ────────────────── reward:dispute:<id> ──────────────────

async function handleDispute(interaction: ButtonInteraction, rewardId: number): Promise<void> {
  const reward = await db().reward.findFirst({ where: { id: rewardId, guildId: interaction.guildId! } });

  if (!reward) {
    await interaction.reply({ embeds: [errorEmbed('Recompense introuvable.')], ephemeral: true });
    return;
  }

  // Only the recipient can dispute
  if (reward.recipientId !== interaction.user.id) {
    await interaction.reply({
      embeds: [errorEmbed('Seul le destinataire peut contester cette recompense.')],
      ephemeral: true,
    });
    return;
  }

  if (reward.status !== 'claimable') {
    await interaction.reply({
      embeds: [errorEmbed(`Cette recompense ne peut pas etre contestee (statut : ${reward.status}).`)],
      ephemeral: true,
    });
    return;
  }

  const previousStatus = reward.status;

  const updated = await db().reward.update({
    where: { id: rewardId },
    data: { status: 'disputed' },
  });

  await db().rewardClaim.create({
    data: {
      rewardId,
      userId: interaction.user.id,
      action: 'dispute',
    },
  });

  await db().ledgerEntry.create({
    data: {
      guildId: reward.guildId,
      rewardId: reward.id,
      actorId: interaction.user.id,
      action: 'disputed',
      fromStatus: previousStatus,
      toStatus: 'disputed',
    },
  });

  await audit({
    guildId: reward.guildId,
    actorId: interaction.user.id,
    action: 'reward.disputed',
    targetType: 'reward',
    targetId: String(rewardId),
    details: { title: reward.title, amount: reward.amount },
  });

  // Update the message embed
  try {
    const embed = buildRewardEmbed(updated);
    await interaction.update({ embeds: [embed], components: [] });
  } catch (err) {
    log.warn({ err, rewardId }, 'Failed to update reward message on dispute');
    await interaction.reply({
      embeds: [successEmbed(`Recompense **${reward.title}** contestee. Un officier sera notifie.`)],
      ephemeral: true,
    });
  }
}
