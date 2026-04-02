import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import {
  searchItems,
  searchEquipment,
  searchResources,
  searchMounts,
  getEquipment,
  getResource,
} from '../../integrations/dofusdude/client.js';
import type { DofusDudeSearchResult } from '../../integrations/dofusdude/client.js';
import { buildItemEmbed, buildMountEmbed, buildSearchResultsEmbed } from './views.js';
import { errorEmbed } from '../../views/base.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('encyclopedia');

type SearchFn = (query: string, limit?: number) => Promise<{ data: DofusDudeSearchResult[]; stale: boolean }>;

// Map subcommand to its search function
const SEARCH_FN: Record<string, SearchFn> = {
  chercher: searchItems,
  equip: searchEquipment,
  ressource: searchResources,
};

export async function handleDofus(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  const query = interaction.options.getString('query', true);

  await interaction.deferReply();

  try {
    // If user picked from autocomplete, query is an ankama_id (numeric string)
    const ankamaId = /^\d+$/.test(query) ? parseInt(query, 10) : NaN;

    if (sub === 'monture') {
      await handleMountCommand(interaction, query);
      return;
    }

    const searchFn = SEARCH_FN[sub];
    if (!searchFn) {
      await interaction.editReply({ embeds: [errorEmbed('Sous-commande inconnue.')] });
      return;
    }

    // Direct fetch if ankama_id was provided (autocomplete selection)
    if (!isNaN(ankamaId)) {
      const fetcher = sub === 'ressource' ? getResource : getEquipment;
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
      await interaction.editReply({ embeds: [errorEmbed(`Aucun resultat pour "${query}".`)] });
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
  // Fetch full details based on subcommand type
  const fetcher = sub === 'ressource' ? getResource : getEquipment;

  try {
    const { data: item, stale: detailStale } = await fetcher(result.ankama_id);
    const stale = searchStale || detailStale;
    await interaction.editReply({ embeds: [buildItemEmbed(item, stale)] });
  } catch {
    // Fallback: show search result embed if detail fetch fails
    await interaction.editReply({ embeds: [buildSearchResultsEmbed([result], result.name)] });
  }
}

async function handleMountCommand(
  interaction: ChatInputCommandInteraction,
  query: string,
): Promise<void> {
  const { data: results, stale } = await searchMounts(query, 8);

  if (!results || results.length === 0) {
    await interaction.editReply({ embeds: [errorEmbed(`Aucune monture trouvee pour "${query}".`)] });
    return;
  }

  // Show first mount details (mounts search returns full data)
  const mount = results[0];
  await interaction.editReply({ embeds: [buildMountEmbed(mount, stale)] });
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
