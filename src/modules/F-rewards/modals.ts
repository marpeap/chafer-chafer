/**
 * @module F-rewards/modals
 * @description Gere le modal de creation de recompense. Parse la saisie, resout le destinataire,
 * delegue la creation a reward.service, puis publie la carte recompense.
 *
 * Flux : parse des champs → resolution du membre → service.createReward → envoi embed → sauvegarde ref message
 *
 * Depend de : services/reward, core/resolve-member, core/permissions, F-rewards/views
 */

import { ModalSubmitInteraction, TextChannel, GuildMember } from 'discord.js';
import { childLogger } from '../../core/logger.js';
import { getMemberLevel, requireLevel, PermissionLevel, levelName } from '../../core/permissions.js';
import { errorEmbed, noPermissionEmbed } from '../../views/base.js';
import { buildRewardCard } from './views.js';
import { resolveMember } from '../../core/resolve-member.js';
import { createReward, saveRewardMessageRef } from '../../services/reward.service.js';

const log = childLogger('F-rewards:modals');

/** Handle the "recompense_creer" modal submission */
export async function handleRewardModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== 'recompense_creer') return;

  const guildId = interaction.guildId;
  if (!guildId) return;

  // Permission check: officers only
  const member = interaction.member as GuildMember;
  const level = await getMemberLevel(member);
  if (!requireLevel(PermissionLevel.OFFICER, level)) {
    await interaction.reply({ embeds: [noPermissionEmbed(levelName(PermissionLevel.OFFICER))], ephemeral: true });
    return;
  }

  await interaction.deferReply();

  // Parse modal fields
  const recipientRaw = interaction.fields.getTextInputValue('recipient').trim();
  const title = interaction.fields.getTextInputValue('title').trim();
  const amount = interaction.fields.getTextInputValue('amount').trim() || null;
  const reason = interaction.fields.getTextInputValue('reason').trim() || null;

  // Resolve recipient by @pseudo, raw ID, or <@id>
  const recipient = interaction.guild
    ? await resolveMember(interaction.guild, recipientRaw)
    : null;
  if (!recipient) {
    await interaction.editReply({
      embeds: [errorEmbed('Membre introuvable. Tape un pseudo exact (@pseudo) ou un ID Discord.')],
    });
    return;
  }

  try {
    // Delegate creation to service (DB + ledger + audit)
    const result = await createReward({
      guildId,
      createdBy: interaction.user.id,
      recipientId: recipient.id,
      title,
      amount,
      reason,
    });

    if (!result.success || !result.reward) {
      await interaction.editReply({ embeds: [errorEmbed(result.error ?? 'Erreur inconnue.')] });
      return;
    }

    // Post reward card to Discord
    const { embeds, components } = buildRewardCard(result.reward);
    const message = await interaction.editReply({ embeds, components });

    // Save Discord message reference for future updates
    await saveRewardMessageRef(guildId, result.reward.id, interaction.channelId!, message.id);

    log.info({ rewardId: result.reward.id, guildId, recipientId: recipient.id }, 'Reward created');
  } catch (err) {
    log.error({ err }, 'Failed to create reward');
    await interaction.editReply({
      embeds: [errorEmbed('Une erreur est survenue lors de la creation de la recompense.')],
    });
  }
}
