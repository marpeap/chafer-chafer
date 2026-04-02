import { ButtonInteraction, TextChannel } from 'discord.js';
import { db } from '../../core/database.js';
import { childLogger } from '../../core/logger.js';
import { successEmbed, errorEmbed } from '../../views/base.js';
import { buildCraftRequestEmbed, buildCraftRequestRow } from './views.js';

const log = childLogger('E-professions:buttons');

export async function handleCraftButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  // Format: craft:<action>:<id>
  const action = parts[1];
  const id = parseInt(parts[2], 10);

  if (isNaN(id)) {
    await interaction.reply({ embeds: [errorEmbed('ID de demande invalide.')], ephemeral: true });
    return;
  }

  switch (action) {
    case 'prendre': return handlePrendre(interaction, id);
    case 'cloturer': return handleCloturer(interaction, id);
    case 'annuler': return handleAnnuler(interaction, id);
    default:
      log.warn({ action, id }, 'Unknown craft button action');
  }
}

// ────────────────── Prendre ──────────────────

async function handlePrendre(interaction: ButtonInteraction, id: number): Promise<void> {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  const request = await db().craftRequest.findFirst({
    where: { id, guildId },
  });

  if (!request) {
    await interaction.reply({ embeds: [errorEmbed('Demande introuvable.')], ephemeral: true });
    return;
  }

  if (request.status !== 'open') {
    await interaction.reply({ embeds: [errorEmbed('Cette demande n\'est plus ouverte.')], ephemeral: true });
    return;
  }

  if (request.requesterId === userId) {
    await interaction.reply({ embeds: [errorEmbed('Tu ne peux pas prendre ta propre demande.')], ephemeral: true });
    return;
  }

  const updated = await db().craftRequest.update({
    where: { id },
    data: { crafterId: userId, status: 'taken' },
  });

  const embed = buildCraftRequestEmbed(updated);
  const row = buildCraftRequestRow(updated);

  // Update the message in-place
  await interaction.update({ embeds: [embed], components: [row] });

  // Send ephemeral confirmation
  await interaction.followUp({
    embeds: [successEmbed(`Tu as pris la demande de craft #${id}. Contacte <@${request.requesterId}> !`)],
    ephemeral: true,
  });
}

// ────────────────── Cloturer ──────────────────

async function handleCloturer(interaction: ButtonInteraction, id: number): Promise<void> {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  const request = await db().craftRequest.findFirst({
    where: { id, guildId },
  });

  if (!request) {
    await interaction.reply({ embeds: [errorEmbed('Demande introuvable.')], ephemeral: true });
    return;
  }

  if (request.status !== 'taken') {
    await interaction.reply({ embeds: [errorEmbed('Seule une demande en cours peut être clôturée.')], ephemeral: true });
    return;
  }

  if (request.requesterId !== userId && request.crafterId !== userId) {
    await interaction.reply({
      embeds: [errorEmbed('Seul le demandeur ou l\'artisan peut clôturer cette demande.')],
      ephemeral: true,
    });
    return;
  }

  const updated = await db().craftRequest.update({
    where: { id },
    data: { status: 'completed' },
  });

  const embed = buildCraftRequestEmbed(updated);

  // Update the message — remove buttons for completed requests
  await interaction.update({ embeds: [embed], components: [] });

  await interaction.followUp({
    embeds: [successEmbed(`Demande de craft #${id} terminée !`)],
    ephemeral: true,
  });
}

// ────────────────── Annuler ──────────────────

async function handleAnnuler(interaction: ButtonInteraction, id: number): Promise<void> {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  const request = await db().craftRequest.findFirst({
    where: { id, guildId },
  });

  if (!request) {
    await interaction.reply({ embeds: [errorEmbed('Demande introuvable.')], ephemeral: true });
    return;
  }

  if (request.status !== 'open' && request.status !== 'taken') {
    await interaction.reply({ embeds: [errorEmbed('Cette demande ne peut plus être annulée.')], ephemeral: true });
    return;
  }

  if (request.requesterId !== userId) {
    await interaction.reply({
      embeds: [errorEmbed('Seul le demandeur peut annuler cette demande.')],
      ephemeral: true,
    });
    return;
  }

  const updated = await db().craftRequest.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  const embed = buildCraftRequestEmbed(updated);

  // Update the message — remove buttons for cancelled requests
  await interaction.update({ embeds: [embed], components: [] });

  await interaction.followUp({
    embeds: [successEmbed(`Demande de craft #${id} annulée.`)],
    ephemeral: true,
  });
}
