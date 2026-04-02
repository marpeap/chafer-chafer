import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import {
  searchGlobal,
  searchEquipment,
  searchResources,
  searchMounts,
  searchConsumables,
  searchQuestItems,
  searchCosmetics,
  searchSets,
  getEquipment,
  getResource,
  getConsumable,
  getQuestItem,
  getCosmetic,
  getMount,
  getSet,
} from '../../integrations/dofusdude/client.js';
import type { DofusDudeSearchResult, DofusDudeMount } from '../../integrations/dofusdude/client.js';
import { buildItemEmbed, buildMountEmbed, buildSetEmbed, buildSearchResultsEmbed } from './views.js';
import { errorEmbed } from '../../views/base.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('encyclopedia');

type SearchFn = (query: string, limit?: number) => Promise<{ data: DofusDudeSearchResult[]; stale: boolean }>;

// Map subcommand to its search function and detail fetcher
const SEARCH_FN: Record<string, SearchFn> = {
  chercher: searchGlobal,
  equip: searchEquipment,
  ressource: searchResources,
  consommable: searchConsumables,
  quete: searchQuestItems,
  cosmetique: searchCosmetics,
};

// Map subcommand to item detail fetcher
const DETAIL_FN: Record<string, (id: number) => Promise<{ data: any; stale: boolean }>> = {
  equip: getEquipment,
  ressource: getResource,
  consommable: getConsumable,
  quete: getQuestItem,
  cosmetique: getCosmetic,
  chercher: getEquipment, // fallback for global search
};

export async function handleDofus(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  const query = interaction.options.getString('query', true);

  await interaction.deferReply();

  try {
    const ankamaId = /^\d+$/.test(query) ? parseInt(query, 10) : NaN;

    // Mount handling
    if (sub === 'monture') {
      await handleMountCommand(interaction, query, ankamaId);
      return;
    }

    // Set/panoplie handling
    if (sub === 'panoplie') {
      await handleSetCommand(interaction, query, ankamaId);
      return;
    }

    const searchFn = SEARCH_FN[sub];
    if (!searchFn) {
      await interaction.editReply({ embeds: [errorEmbed('Sous-commande inconnue.')] });
      return;
    }

    // Direct fetch if ankama_id was provided (autocomplete selection)
    if (!isNaN(ankamaId)) {
      const fetcher = DETAIL_FN[sub] ?? getEquipment;
      try {
        const { data: item, stale } = await fetcher(ankamaId);
        await interaction.editReply({ embeds: [buildItemEmbed(item, stale)] });
        return;
      } catch {
        log.warn({ ankamaId, sub }, 'Direct fetch by ID failed, falling back to search');
      }
    }

    // Text search
    const { data: results, stale } = await searchFn(query, 8);

    if (!results || results.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed(`Aucun résultat pour « ${query} ».`)] });
      return;
    }

    // Single result — show full details
    if (results.length === 1) {
      await showItemDetails(interaction, results[0], sub, stale);
      return;
    }

    // Multiple results — show list
    await interaction.editReply({ embeds: [buildSearchResultsEmbed(results, query)] });
  } catch (err) {
    log.error({ err, sub, query }, 'Encyclopedia command failed');
    await interaction.editReply({ embeds: [errorEmbed('Impossible de contacter l\'API DofusDude.')] });
  }
}

async function showItemDetails(
  interaction: ChatInputCommandInteraction,
  result: DofusDudeSearchResult,
  sub: string,
  searchStale: boolean,
): Promise<void> {
  const fetcher = DETAIL_FN[sub] ?? getEquipment;

  try {
    const { data: item, stale: detailStale } = await fetcher(result.ankama_id);
    const stale = searchStale || detailStale;
    await interaction.editReply({ embeds: [buildItemEmbed(item, stale)] });
  } catch {
    await interaction.editReply({ embeds: [buildSearchResultsEmbed([result], result.name)] });
  }
}

async function handleMountCommand(
  interaction: ChatInputCommandInteraction,
  query: string,
  ankamaId: number,
): Promise<void> {
  // Direct fetch by ID
  if (!isNaN(ankamaId)) {
    try {
      const { data: mount, stale } = await getMount(ankamaId);
      await interaction.editReply({ embeds: [buildMountEmbed(mount, stale)] });
      return;
    } catch {
      log.warn({ ankamaId }, 'Mount direct fetch failed, falling back to search');
    }
  }

  const { data: results, stale } = await searchMounts(query, 8);

  if (!results || results.length === 0) {
    await interaction.editReply({ embeds: [errorEmbed(`Aucune monture trouvée pour « ${query} ».`)] });
    return;
  }

  const mount = results[0];
  await interaction.editReply({ embeds: [buildMountEmbed(mount, stale)] });
}

async function handleSetCommand(
  interaction: ChatInputCommandInteraction,
  query: string,
  ankamaId: number,
): Promise<void> {
  // Direct fetch by ID
  if (!isNaN(ankamaId)) {
    try {
      const { data: set, stale } = await getSet(ankamaId);
      await interaction.editReply({ embeds: [buildSetEmbed(set, stale)] });
      return;
    } catch {
      log.warn({ ankamaId }, 'Set direct fetch failed, falling back to search');
    }
  }

  const { data: results, stale } = await searchSets(query, 8);

  if (!results || results.length === 0) {
    await interaction.editReply({ embeds: [errorEmbed(`Aucune panoplie trouvée pour « ${query} ».`)] });
    return;
  }

  // Single result — fetch full details
  if (results.length === 1) {
    try {
      const { data: set, stale: detailStale } = await getSet(results[0].ankama_id);
      await interaction.editReply({ embeds: [buildSetEmbed(set, stale || detailStale)] });
      return;
    } catch {
      // fallback below
    }
  }

  // Multiple results — show list
  const lines = results.map((r, i) => {
    const level = r.highest_equipment_level ? `Niv. ${r.highest_equipment_level}` : '';
    return `**${i + 1}.** ${r.name}${level ? ` *(${level})*` : ''}`;
  });
  const embed = buildSearchResultsEmbed(
    results.map(r => ({ ankama_id: r.ankama_id, name: r.name })),
    query,
  );
  await interaction.editReply({ embeds: [embed] });
}

export async function handleDofusAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const sub = interaction.options.getSubcommand();
  const query = focused.value;

  if (!query || query.length < 2) {
    await interaction.respond([]);
    return;
  }

  try {
    let choices: Array<{ name: string; value: string }> = [];

    if (sub === 'monture') {
      const { data: results } = await searchMounts(query, 25);
      choices = (results ?? []).slice(0, 25).map((r) => ({
        name: truncateChoice(`${r.name}${r.family_name ? ` (${r.family_name})` : ''}`, 100),
        value: String(r.ankama_id),
      }));
    } else if (sub === 'panoplie') {
      const { data: results } = await searchSets(query, 25);
      choices = (results ?? []).slice(0, 25).map((r) => ({
        name: truncateChoice(`${r.name}${r.highest_equipment_level ? ` (Niv.${r.highest_equipment_level})` : ''}`, 100),
        value: String(r.ankama_id),
      }));
    } else {
      const searchFn = SEARCH_FN[sub];
      if (!searchFn) {
        await interaction.respond([]);
        return;
      }

      const { data: results } = await searchFn(query, 25);
      choices = (results ?? []).slice(0, 25).map((r) => {
        const typeName = r.type?.name ?? '';
        const level = r.level !== undefined ? `Niv.${r.level}` : '';
        const meta = [typeName, level].filter(Boolean).join(' ');
        const label = meta ? `${r.name} (${meta})` : r.name;
        return {
          name: truncateChoice(label, 100),
          value: String(r.ankama_id),
        };
      });
    }

    await interaction.respond(choices);
  } catch (err) {
    log.warn({ err, sub, query }, 'Autocomplete failed');
    await interaction.respond([]);
  }
}

function truncateChoice(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
}
