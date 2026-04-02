import {
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
} from 'discord.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { childLogger } from '../../core/logger.js';
import { successEmbed, errorEmbed } from '../../views/base.js';
import { buildRewardListEmbed, buildRewardEmbed } from './views.js';

const log = childLogger('F-rewards:commands');

export async function handleRecompense(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'creer':
      return handleCreer(interaction);
    case 'liste':
      return handleListe(interaction);
    case 'payer':
      return handlePayer(interaction);
    case 'annuler':
      return handleAnnuler(interaction);
    default:
      log.warn({ sub }, 'Unknown recompense subcommand');
  }
}

// ────────────────── /recompense creer ──────────────────

async function handleCreer(interaction: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('recompense_creer')
    .setTitle('Creer une recompense');

  const recipientInput = new TextInputBuilder()
    .setCustomId('recipient')
    .setLabel('Destinataire (mention ou ID)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('@pseudo ou 123456789012345678')
    .setRequired(true);

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Titre')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  const amountInput = new TextInputBuilder()
    .setCustomId('amount')
    .setLabel('Montant (ex: 500k kamas, 1x Dofus)')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(false);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Raison')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(recipientInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(titleInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(amountInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonInput),
  );

  await interaction.showModal(modal);
}

// ────────────────── /recompense liste ──────────────────

async function handleListe(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const rewards = await db().reward.findMany({
    where: {
      guildId,
      recipientId: userId,
      status: { in: ['pending', 'claimable', 'claimed', 'disputed'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  const embed = buildRewardListEmbed(rewards);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ────────────────── /recompense payer <id> ──────────────────

async function handlePayer(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const rewardId = interaction.options.getInteger('id', true);

  const reward = await db().reward.findFirst({
    where: { id: rewardId, guildId },
  });

  if (!reward) {
    await interaction.reply({ embeds: [errorEmbed(`Recompense #${rewardId} introuvable.`)], ephemeral: true });
    return;
  }

  if (reward.status !== 'claimed') {
    await interaction.reply({
      embeds: [errorEmbed(`Cette recompense ne peut pas etre payee (statut actuel : ${reward.status}). Le destinataire doit d'abord la reclamer.`)],
      ephemeral: true,
    });
    return;
  }

  const previousStatus = reward.status;

  const updated = await db().reward.update({
    where: { id: rewardId },
    data: { status: 'paid', paidAt: new Date() },
  });

  await db().ledgerEntry.create({
    data: {
      guildId,
      rewardId: reward.id,
      actorId: interaction.user.id,
      action: 'paid',
      fromStatus: previousStatus,
      toStatus: 'paid',
    },
  });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'reward.paid',
    targetType: 'reward',
    targetId: String(rewardId),
    details: { title: reward.title, recipientId: reward.recipientId, amount: reward.amount },
  });

  // Update original message if exists
  if (reward.channelId && reward.messageId) {
    try {
      const channel = interaction.guild?.channels.cache.get(reward.channelId);
      if (channel && 'messages' in channel) {
        const msg = await (channel as import('discord.js').TextChannel).messages.fetch(reward.messageId);
        const embed = buildRewardEmbed(updated);
        await msg.edit({ embeds: [embed], components: [] });
      }
    } catch (err) {
      log.warn({ err, rewardId }, 'Failed to update reward message');
    }
  }

  await interaction.reply({
    embeds: [successEmbed(`Recompense **${reward.title}** marquee comme payee.`)],
    ephemeral: true,
  });
}

// ────────────────── /recompense annuler <id> ──────────────────

async function handleAnnuler(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const rewardId = interaction.options.getInteger('id', true);

  const reward = await db().reward.findFirst({
    where: { id: rewardId, guildId },
  });

  if (!reward) {
    await interaction.reply({ embeds: [errorEmbed(`Recompense #${rewardId} introuvable.`)], ephemeral: true });
    return;
  }

  if (reward.status !== 'pending' && reward.status !== 'claimable') {
    await interaction.reply({
      embeds: [errorEmbed(`Cette recompense ne peut pas etre annulee (statut actuel : ${reward.status}).`)],
      ephemeral: true,
    });
    return;
  }

  const previousStatus = reward.status;

  const updated = await db().reward.update({
    where: { id: rewardId },
    data: { status: 'cancelled' },
  });

  await db().ledgerEntry.create({
    data: {
      guildId,
      rewardId: reward.id,
      actorId: interaction.user.id,
      action: 'cancelled',
      fromStatus: previousStatus,
      toStatus: 'cancelled',
    },
  });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'reward.cancelled',
    targetType: 'reward',
    targetId: String(rewardId),
    details: { title: reward.title, recipientId: reward.recipientId },
  });

  // Update original message if exists
  if (reward.channelId && reward.messageId) {
    try {
      const channel = interaction.guild?.channels.cache.get(reward.channelId);
      if (channel && 'messages' in channel) {
        const msg = await (channel as import('discord.js').TextChannel).messages.fetch(reward.messageId);
        const embed = buildRewardEmbed(updated);
        await msg.edit({ embeds: [embed], components: [] });
      }
    } catch (err) {
      log.warn({ err, rewardId }, 'Failed to update reward message');
    }
  }

  await interaction.reply({
    embeds: [successEmbed(`Recompense **${reward.title}** annulee.`)],
    ephemeral: true,
  });
}
