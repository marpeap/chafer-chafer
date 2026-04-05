/**
 * @module F-rewards/commands
 * @description Handlers des commandes slash /recompense : creer, liste, payer, annuler.
 *
 * "creer" ouvre un modal (gere par F-rewards/modals.ts).
 * "liste" est une requete en lecture seule.
 * "payer" et "annuler" deleguent les transitions d'etat a reward.service.
 *
 * Depend de : services/reward, core/database (pour les requetes lecture), F-rewards/views
 */

import {
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
} from 'discord.js';
import { db } from '../../core/database.js';
import { childLogger } from '../../core/logger.js';
import { successEmbed, errorEmbed } from '../../views/base.js';
import { buildRewardListEmbed, buildRewardEmbed } from './views.js';
import { payReward, cancelReward } from '../../services/reward.service.js';

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

/** Payer une recompense — delegue la transition d'etat a reward.service */
async function handlePayer(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const rewardId = interaction.options.getInteger('id', true);

  const result = await payReward(guildId, rewardId, interaction.user.id);

  if (!result.success) {
    await interaction.reply({ embeds: [errorEmbed(result.error!)], ephemeral: true });
    return;
  }

  // Mettre a jour l'embed du message Discord original s'il existe
  const reward = result.reward!;
  if (reward.channelId && reward.messageId) {
    try {
      const channel = interaction.guild?.channels.cache.get(reward.channelId);
      if (channel && 'messages' in channel) {
        const msg = await (channel as import('discord.js').TextChannel).messages.fetch(reward.messageId);
        const embed = buildRewardEmbed(reward);
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

/** Annuler une recompense — delegue la transition d'etat a reward.service */
async function handleAnnuler(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const rewardId = interaction.options.getInteger('id', true);

  const result = await cancelReward(guildId, rewardId, interaction.user.id);

  if (!result.success) {
    await interaction.reply({ embeds: [errorEmbed(result.error!)], ephemeral: true });
    return;
  }

  // Mettre a jour l'embed du message Discord original s'il existe
  const reward = result.reward!;
  if (reward.channelId && reward.messageId) {
    try {
      const channel = interaction.guild?.channels.cache.get(reward.channelId);
      if (channel && 'messages' in channel) {
        const msg = await (channel as import('discord.js').TextChannel).messages.fetch(reward.messageId);
        const embed = buildRewardEmbed(reward);
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
