/**
 * @module E-professions/modals
 * @description Handles modal submissions for profession enrollment and craft requests.
 *
 * Flow (inscription): modal → canonicalize profession → upsert DB → reply
 * Flow (craft): modal → create request → enrich from DofusDude API → post to channel → reply
 *
 * Depends on: core/database, validators/profession, integrations/dofusdude, E-professions/views
 */

import { ModalSubmitInteraction, TextChannel } from 'discord.js';
import { db } from '../../core/database.js';
import { childLogger } from '../../core/logger.js';
import { successEmbed, errorEmbed } from '../../views/base.js';
import { buildCraftRequestEmbed, buildCraftRequestRow } from './views.js';
import { searchGlobal } from '../../integrations/dofusdude/client.js';
import { canonicalizeProfession } from '../../validators/profession.validator.js';

const log = childLogger('E-professions:modals');

export async function handleProfessionModal(interaction: ModalSubmitInteraction): Promise<void> {
  switch (interaction.customId) {
    case 'metier_inscrire':
      return handleMetierInscrire(interaction);
    case 'craft_demande':
      return handleCraftDemande(interaction);
    default:
      log.warn({ customId: interaction.customId }, 'Unknown profession modal');
  }
}

async function handleMetierInscrire(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const professionRaw = interaction.fields.getTextInputValue('profession').trim();
  const levelStr = interaction.fields.getTextInputValue('level').trim();
  const note = interaction.fields.getTextInputValue('note')?.trim() || null;

  const level = parseInt(levelStr, 10);
  if (isNaN(level) || level < 1 || level > 200) {
    await interaction.editReply({ embeds: [errorEmbed('Le niveau doit être entre 1 et 200.')] });
    return;
  }

  // Auto-normalize to canonical profession name if possible
  const profession = canonicalizeProfession(professionRaw);

  await db().professionProfile.upsert({
    where: { guildId_userId_profession: { guildId, userId, profession } },
    create: { guildId, userId, profession, level, note },
    update: { level, note },
  });

  await interaction.editReply({
    embeds: [successEmbed(`Métier **${profession}** inscrit au niveau **${level}**.`)],
  });
}

async function handleCraftDemande(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const professionRaw = interaction.fields.getTextInputValue('profession').trim();
  const profession = canonicalizeProfession(professionRaw);
  const itemName = interaction.fields.getTextInputValue('item_name').trim();
  const quantityStr = interaction.fields.getTextInputValue('quantity')?.trim() || '1';
  const description = interaction.fields.getTextInputValue('description')?.trim() || null;

  const quantity = parseInt(quantityStr, 10);
  if (isNaN(quantity) || quantity < 1) {
    await interaction.editReply({ embeds: [errorEmbed('La quantité doit être un nombre positif.')] });
    return;
  }

  let request = await db().craftRequest.create({
    data: {
      guildId,
      requesterId: userId,
      profession,
      itemName,
      quantity,
      description,
    },
  });

  // Try to enrich with encyclopedia data (non-blocking)
  try {
    const { data: searchResults } = await searchGlobal(itemName, 1);
    if (searchResults && searchResults.length > 0) {
      const match = searchResults[0];
      request = await db().craftRequest.update({
        where: { id: request.id },
        data: {
          itemAnkamaId: match.ankama_id,
          itemImageUrl: match.image_urls?.icon ?? null,
        },
      });
    }
  } catch {
    // Non-blocking: if search fails, craft request still works without image
  }

  // Post to metiers channel if configured
  const guild = await db().discordGuild.findUnique({ where: { guildId } });
  if (guild?.metiersChannelId) {
    try {
      const channel = interaction.client.channels.cache.get(guild.metiersChannelId);
      if (channel && channel instanceof TextChannel) {
        const embed = buildCraftRequestEmbed(request);
        const row = buildCraftRequestRow(request);
        const msg = await channel.send({ embeds: [embed], components: [row] });

        await db().craftRequest.update({
          where: { id: request.id },
          data: { messageId: msg.id, channelId: channel.id },
        });
      }
    } catch (err) {
      log.warn({ err }, 'Failed to post craft request to channel');
    }
  }

  await interaction.editReply({
    embeds: [successEmbed(`Demande de craft #${request.id} créée : **${quantity}x ${itemName}** (${profession}).`)],
  });
}
