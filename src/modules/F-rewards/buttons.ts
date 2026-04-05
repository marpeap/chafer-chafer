/**
 * @module F-rewards/buttons
 * @description Handles reward button interactions: claim and dispute.
 *
 * Each handler validates ownership, delegates state transition to reward.service,
 * then updates the Discord embed.
 *
 * Depends on: services/reward, F-rewards/views
 */

import { ButtonInteraction, TextChannel } from 'discord.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed, successEmbed } from '../../views/base.js';
import { buildRewardEmbed } from './views.js';
import { claimReward, disputeReward } from '../../services/reward.service.js';

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

/** Claim a reward — delegates validation + state transition to reward.service */
async function handleClaim(interaction: ButtonInteraction, rewardId: number): Promise<void> {
  const result = await claimReward(interaction.guildId!, rewardId, interaction.user.id);

  if (!result.success) {
    await interaction.reply({ embeds: [errorEmbed(result.error!)], ephemeral: true });
    return;
  }

  try {
    const embed = buildRewardEmbed(result.reward!);
    await interaction.update({ embeds: [embed], components: [] });
  } catch (err) {
    log.warn({ err, rewardId }, 'Failed to update reward message on claim');
    await interaction.reply({
      embeds: [successEmbed(`Recompense **${result.reward!.title}** reclamee avec succes.`)],
      ephemeral: true,
    });
  }
}

// ────────────────── reward:dispute:<id> ──────────────────

/** Dispute a reward — delegates validation + state transition to reward.service */
async function handleDispute(interaction: ButtonInteraction, rewardId: number): Promise<void> {
  const result = await disputeReward(interaction.guildId!, rewardId, interaction.user.id);

  if (!result.success) {
    await interaction.reply({ embeds: [errorEmbed(result.error!)], ephemeral: true });
    return;
  }

  try {
    const embed = buildRewardEmbed(result.reward!);
    await interaction.update({ embeds: [embed], components: [] });
  } catch (err) {
    log.warn({ err, rewardId }, 'Failed to update reward message on dispute');
    await interaction.reply({
      embeds: [successEmbed(`Recompense **${result.reward!.title}** contestee. Un officier sera notifie.`)],
      ephemeral: true,
    });
  }
}
