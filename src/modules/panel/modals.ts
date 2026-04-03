import { ModalSubmitInteraction } from 'discord.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed } from '../../views/base.js';

// Reuse existing module logic
import * as dofusdude from '../../integrations/dofusdude/client.js';
import * as almanaxApi from '../../integrations/almanax/client.js';
import { buildItemEmbed, buildSearchResultsEmbed } from '../C-encyclopedia/views.js';
import { resolveRecipeNames } from '../C-encyclopedia/commands.js';
import { buildAlmanaxEmbed } from '../D-almanax/views.js';
import { buildCrafterAvailableEmbed, buildCrafterUnavailableEmbed } from '../E-professions/views.js';
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
  await interaction.deferReply();

  const profession = interaction.fields.getTextInputValue('profession').trim();
  if (!profession) {
    await interaction.editReply({ embeds: [errorEmbed('Métier vide.')] });
    return;
  }

  const guildId = interaction.guildId!;

  // 1. Find ALL crafters with this profession (fuzzy match)
  const allCrafters = await db().professionProfile.findMany({
    where: {
      guildId,
      profession: { contains: profession, mode: 'insensitive' },
    },
    orderBy: { level: 'desc' },
  });

  // 2. Find "Glandeur Dispo" players who listed this profession
  const glandeurs = await db().playerProfile.findMany({
    where: {
      guildId,
      status: 'approved',
      globalAvailable: true,
      professions200: { contains: profession, mode: 'insensitive' },
    },
  });

  // 3. Build set of available user IDs
  const availableUserIds = new Set<string>();
  for (const c of allCrafters) {
    if (c.available) availableUserIds.add(c.userId);
  }
  for (const g of glandeurs) {
    availableUserIds.add(g.userId);
  }

  // 4. Split into available vs unavailable
  const availableProfiles = allCrafters.filter((c) => availableUserIds.has(c.userId));

  // Include glandeurs without a ProfessionProfile entry (level 200 assumed)
  const existingUserIds = new Set(allCrafters.map((c) => c.userId));
  for (const g of glandeurs) {
    if (!existingUserIds.has(g.userId)) {
      availableProfiles.push({
        userId: g.userId,
        level: 200,
        note: 'Glandeur Dispo',
      } as typeof allCrafters[number]);
    }
  }

  if (availableProfiles.length > 0) {
    // Case 1: Available crafters found — GREEN embed + ping in content
    const mentions = availableProfiles.map((p) => `<@${p.userId}>`).join(' ');
    const embed = buildCrafterAvailableEmbed(availableProfiles, profession);
    await interaction.editReply({
      content: `${mentions} — on cherche un **${profession}** !`,
      embeds: [embed],
    });
  } else {
    // Case 2: No available crafters — ORANGE embed, no ping
    const embed = buildCrafterUnavailableEmbed(allCrafters, profession);
    await interaction.editReply({ embeds: [embed] });
  }
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
