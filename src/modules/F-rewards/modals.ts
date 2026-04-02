import { ModalSubmitInteraction, TextChannel } from 'discord.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed, successEmbed } from '../../views/base.js';
import { buildRewardCard } from './views.js';

const log = childLogger('F-rewards:modals');

/** Extract a Discord user ID from a mention string or raw ID */
function parseUserId(input: string): string | null {
  // Match <@123456> or <@!123456>
  const mentionMatch = input.match(/^<@!?(\d{17,20})>$/);
  if (mentionMatch) return mentionMatch[1];

  // Match raw ID
  const idMatch = input.match(/^(\d{17,20})$/);
  if (idMatch) return idMatch[1];

  return null;
}

export async function handleRewardModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== 'recompense_creer') return;

  const guildId = interaction.guildId;
  if (!guildId) return;

  const recipientRaw = interaction.fields.getTextInputValue('recipient').trim();
  const title = interaction.fields.getTextInputValue('title').trim();
  const amount = interaction.fields.getTextInputValue('amount').trim() || null;
  const reason = interaction.fields.getTextInputValue('reason').trim() || null;

  // Parse recipient
  const recipientId = parseUserId(recipientRaw);
  if (!recipientId) {
    await interaction.reply({
      embeds: [errorEmbed('Destinataire invalide. Utilise une mention (@pseudo) ou un ID Discord.')],
      ephemeral: true,
    });
    return;
  }

  // Verify the user exists in the guild
  try {
    await interaction.guild?.members.fetch(recipientId);
  } catch {
    await interaction.reply({
      embeds: [errorEmbed('Ce membre est introuvable sur ce serveur.')],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    // Create reward in DB
    const reward = await db().reward.create({
      data: {
        guildId,
        createdBy: interaction.user.id,
        recipientId,
        title,
        amount,
        reason,
        status: 'claimable',
      },
    });

    // Create ledger entry
    await db().ledgerEntry.create({
      data: {
        guildId,
        rewardId: reward.id,
        actorId: interaction.user.id,
        action: 'created',
        fromStatus: null,
        toStatus: 'claimable',
      },
    });

    // Post reward card to the current channel
    const { embeds, components } = buildRewardCard(reward);
    const message = await interaction.editReply({ embeds, components });

    // Save message reference for future updates
    const messageId = message.id;
    const channelId = interaction.channelId!;

    await db().reward.update({
      where: { id: reward.id },
      data: { messageId, channelId },
    });

    await db().discordMessageMap.create({
      data: {
        guildId,
        channelId,
        messageId,
        entityType: 'reward',
        entityId: reward.id,
      },
    });

    // Audit log
    await audit({
      guildId,
      actorId: interaction.user.id,
      action: 'reward.created',
      targetType: 'reward',
      targetId: String(reward.id),
      details: { title, recipientId, amount, reason },
    });

    log.info({ rewardId: reward.id, guildId, recipientId }, 'Reward created');
  } catch (err) {
    log.error({ err }, 'Failed to create reward');
    await interaction.editReply({
      embeds: [errorEmbed('Une erreur est survenue lors de la creation de la recompense.')],
    });
  }
}
