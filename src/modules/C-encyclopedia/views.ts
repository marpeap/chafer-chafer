import type { EmbedBuilder } from 'discord.js';
import { baseEmbed, Colors, Emoji, truncate } from '../../views/base.js';
import type { DofusDudeItem, DofusDudeSearchResult, DofusDudeMount, DofusDudeSet } from '../../integrations/dofusdude/client.js';

const DOFUSDUDE_BASE = 'https://www.dofusdu.de/fr';

function formatEffect(effect: { int_minimum: number; int_maximum: number; type: { name: string } }): string {
  const { int_minimum: min, int_maximum: max, type } = effect;
  if (min === max || max === 0) {
    return `**${min}** ${type.name}`;
  }
  return `**${min}** à **${max}** ${type.name}`;
}

export function buildItemEmbed(item: DofusDudeItem, stale: boolean, recipeNames?: Map<number, string>): EmbedBuilder {
  const typeName = item.type?.name ?? 'Objet';
  const title = `${Emoji.BOOK} ${item.name}`;
  const embed = baseEmbed(title, Colors.PRIMARY);

  // Meta line
  const metaParts: string[] = [];
  metaParts.push(`**Type :** ${typeName}`);
  if (item.level !== undefined && item.level !== null) {
    metaParts.push(`**Niveau :** ${item.level}`);
  }
  embed.setDescription(metaParts.join(' | '));

  // Effects
  if (item.effects && item.effects.length > 0) {
    const lines = item.effects.map(formatEffect);
    embed.addFields({
      name: `${Emoji.SWORD} Effets`,
      value: truncate(lines.join('\n'), 1024),
    });
  }

  // Conditions
  if (item.conditions && item.conditions.length > 0) {
    embed.addFields({
      name: `${Emoji.SHIELD} Conditions`,
      value: truncate(item.conditions.join('\n'), 1024),
    });
  }

  // Recipe
  if (item.recipe && item.recipe.length > 0) {
    const lines = item.recipe.map(r => {
      const name = recipeNames?.get(r.item_ankama_id) ?? `#${r.item_ankama_id} *(${r.item_subtype})*`;
      return `${r.quantity}x **${name}**`;
    });
    embed.addFields({
      name: `${Emoji.HAMMER} Recette`,
      value: truncate(lines.join('\n'), 1024),
    });
  }

  // Description
  if (item.description) {
    embed.addFields({
      name: `${Emoji.SCROLL} Description`,
      value: truncate(item.description, 1024),
    });
  }

  // Image
  const imageUrl = item.image_urls?.sd ?? item.image_urls?.icon;
  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  // Link
  embed.setURL(`${DOFUSDUDE_BASE}/items/${item.ankama_id}`);

  // Stale warning
  if (stale) {
    embed.setFooter({
      text: 'Chafer Chafer | Données en cache (API indisponible)',
    });
  }

  return embed;
}

export function buildMountEmbed(mount: DofusDudeMount, stale: boolean): EmbedBuilder {
  const title = `${Emoji.BOOK} ${mount.name}`;
  const embed = baseEmbed(title, Colors.PRIMARY);

  const metaParts: string[] = [];
  if (mount.family_name) {
    metaParts.push(`**Famille :** ${mount.family_name}`);
  }
  if (metaParts.length > 0) {
    embed.setDescription(metaParts.join(' | '));
  }

  if (mount.effects && mount.effects.length > 0) {
    const lines = mount.effects.map(formatEffect);
    embed.addFields({
      name: `${Emoji.SWORD} Effets`,
      value: truncate(lines.join('\n'), 1024),
    });
  }

  const imageUrl = mount.image_urls?.icon;
  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  embed.setURL(`${DOFUSDUDE_BASE}/mounts/${mount.ankama_id}`);

  if (stale) {
    embed.setFooter({
      text: 'Chafer Chafer | Données en cache (API indisponible)',
    });
  }

  return embed;
}

export function buildSetEmbed(set: DofusDudeSet, stale: boolean): EmbedBuilder {
  const title = `${Emoji.BOOK} ${set.name}`;
  const embed = baseEmbed(title, Colors.PRIMARY);

  const metaParts: string[] = [];
  if (set.highest_equipment_level) {
    metaParts.push(`**Niveau max :** ${set.highest_equipment_level}`);
  }
  if (set.items && set.items.length > 0) {
    metaParts.push(`**Pièces :** ${set.items.length}`);
  }
  if (metaParts.length > 0) {
    embed.setDescription(metaParts.join(' | '));
  }

  // Set bonus effects by number of items equipped
  if (set.effects) {
    const entries = Object.entries(set.effects)
      .sort(([a], [b]) => parseInt(a) - parseInt(b));
    for (const [count, effects] of entries) {
      if (effects.length > 0) {
        const lines = effects.map(formatEffect);
        embed.addFields({
          name: `${count} pièce${parseInt(count) > 1 ? 's' : ''} équipée${parseInt(count) > 1 ? 's' : ''}`,
          value: truncate(lines.join('\n'), 1024),
          inline: true,
        });
      }
    }
  }

  embed.setURL(`${DOFUSDUDE_BASE}/sets/${set.ankama_id}`);

  if (stale) {
    embed.setFooter({
      text: 'Chafer Chafer | Données en cache (API indisponible)',
    });
  }

  return embed;
}

export function buildSearchResultsEmbed(results: DofusDudeSearchResult[], query: string): EmbedBuilder {
  const embed = baseEmbed(`${Emoji.SEARCH} Résultats pour « ${query} »`, Colors.INFO);

  if (results.length === 0) {
    embed.setDescription('Aucun résultat trouvé.');
    return embed;
  }

  const lines = results.map((r, i) => {
    const typeName = r.type?.name ?? '';
    const level = r.level !== undefined ? `Niv. ${r.level}` : '';
    const meta = [typeName, level].filter(Boolean).join(' | ');
    return `**${i + 1}.** ${r.name}${meta ? ` *(${meta})*` : ''}`;
  });

  embed.setDescription(truncate(lines.join('\n'), 4096));
  return embed;
}
