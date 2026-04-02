import { ModalSubmitInteraction } from 'discord.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed } from '../../views/base.js';

// Reuse existing module logic
import * as dofusdude from '../../integrations/dofusdude/client.js';
import * as almanaxApi from '../../integrations/almanax/client.js';
import { buildItemEmbed, buildSearchResultsEmbed } from '../C-encyclopedia/views.js';
import { resolveRecipeNames } from '../C-encyclopedia/commands.js';
import { buildAlmanaxEmbed } from '../D-almanax/views.js';
import { buildCrafterSearchEmbed } from '../E-professions/views.js';
import { db } from '../../core/database.js';

const log = childLogger('panel:modals');

export async function handlePanelModal(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;

  switch (customId) {
    case 'panel:modal_dofus_chercher':
      return handleDofusChercher(interaction);
    case 'panel:modal_metier_chercher':
      return handleMetierChercher(interaction);
    case 'panel:modal_almanax_bonus':
      return handleAlmanaxBonus(interaction);
    default:
      log.warn({ customId }, 'Unknown panel modal');
  }
}

async function handleDofusChercher(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const query = interaction.fields.getTextInputValue('query').trim();
  if (!query) {
    await interaction.editReply({ embeds: [errorEmbed('Requête vide.')] });
    return;
  }

  try {
    const { data: results, stale } = await dofusdude.searchGlobal(query, 8);

    if (!results || results.length === 0) {
      await interaction.editReply({
        embeds: [errorEmbed(`Aucun résultat pour « ${query} ».`)],
      });
      return;
    }

    // If single result, fetch full details
    if (results.length === 1) {
      try {
        const { data: item, stale: itemStale } = await dofusdude.getEquipment(results[0].ankama_id);
        const recipeNames = await resolveRecipeNames(item.recipe);
        const embed = buildItemEmbed(item, itemStale, recipeNames);
        await interaction.editReply({ embeds: [embed] });
        return;
      } catch {
        // Fall through to search results
      }
    }

    const embed = buildSearchResultsEmbed(results, query);
    if (stale) {
      embed.setFooter({ text: '⚠️ Données potentiellement anciennes (cache) | Chafer Chafer' });
    }
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err, query }, 'Dofus search error');
    await interaction.editReply({
      embeds: [errorEmbed('Erreur lors de la recherche. L\'API est peut-être indisponible.')],
    });
  }
}

async function handleMetierChercher(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const profession = interaction.fields.getTextInputValue('profession').trim();
  if (!profession) {
    await interaction.editReply({ embeds: [errorEmbed('Métier vide.')] });
    return;
  }

  const guildId = interaction.guildId!;

  // Fuzzy match: case-insensitive contains
  const profiles = await db().professionProfile.findMany({
    where: {
      guildId,
      profession: { contains: profession, mode: 'insensitive' },
      available: true,
    },
    orderBy: { level: 'desc' },
  });

  const embed = buildCrafterSearchEmbed(profiles, profession);
  await interaction.editReply({ embeds: [embed] });
}

async function handleAlmanaxBonus(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const bonusType = interaction.fields.getTextInputValue('bonus_type').trim();
  if (!bonusType) {
    await interaction.editReply({ embeds: [errorEmbed('Type de bonus vide.')] });
    return;
  }

  try {
    const { data, stale } = await almanaxApi.getNextBonus(bonusType);

    if (!data) {
      await interaction.editReply({
        embeds: [errorEmbed(`Aucun bonus « ${bonusType} » trouvé dans les 60 prochains jours.`)],
      });
      return;
    }

    const embed = buildAlmanaxEmbed(data, stale);
    embed.setTitle(`📅 Prochain bonus : ${bonusType}`);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err, bonusType }, 'Almanax bonus search error');
    await interaction.editReply({
      embeds: [errorEmbed('Erreur lors de la recherche.')],
    });
  }
}
