import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { getToday, getDate, getRange, getNextBonus, searchBonusTypes } from '../../integrations/almanax/client.js';
import { buildAlmanaxEmbed, buildAlmanaxWeekEmbed } from './views.js';
import { errorEmbed } from '../../views/base.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('almanax:cmd');

export async function handleAlmanax(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand(false);

  switch (sub) {
    case 'date':
      return handleDate(interaction);
    case 'bonus':
      return handleBonus(interaction);
    case 'semaine':
      return handleSemaine(interaction);
    case 'today':
    default:
      return handleToday(interaction);
  }
}

export async function handleAlmanaxAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);

  if (focused.name === 'type') {
    const query = focused.value.trim();

    if (!query || query.length < 2) {
      await interaction.respond([]);
      return;
    }

    try {
      const results = await searchBonusTypes(query);
      const choices = results.slice(0, 25).map((b) => ({
        name: b.name.length > 100 ? b.name.slice(0, 99) + '\u2026' : b.name,
        value: b.id,
      }));
      await interaction.respond(choices);
    } catch (err) {
      log.warn({ err, query }, 'Almanax bonus autocomplete failed');
      await interaction.respond([]);
    }
  } else {
    await interaction.respond([]);
  }
}

async function handleToday(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const { data, stale } = await getToday();
    const embed = buildAlmanaxEmbed(data, stale);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err }, 'Failed to fetch today almanax');
    await interaction.editReply({
      embeds: [errorEmbed('Impossible de récupérer l\'almanax du jour. Réessaie plus tard.')],
    });
  }
}

async function handleDate(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const dateStr = interaction.options.getString('date', true);
  const parsed = new Date(dateStr);

  if (isNaN(parsed.getTime())) {
    await interaction.editReply({
      embeds: [errorEmbed('Date invalide. Utilise le format **AAAA-MM-JJ** (ex: 2026-04-15).')],
    });
    return;
  }

  try {
    const { data, stale } = await getDate(parsed);
    const embed = buildAlmanaxEmbed(data, stale);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err, date: dateStr }, 'Failed to fetch almanax for date');
    await interaction.editReply({
      embeds: [errorEmbed(`Impossible de récupérer l'almanax pour le **${dateStr}**.`)],
    });
  }
}

async function handleBonus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const bonusType = interaction.options.getString('type', true);

  try {
    const { data, stale } = await getNextBonus(bonusType);

    if (!data) {
      await interaction.editReply({
        embeds: [errorEmbed(`Aucun bonus **${bonusType}** trouvé dans les 60 prochains jours.`)],
      });
      return;
    }

    const embed = buildAlmanaxEmbed(data, stale)
      .setTitle(`🔍 Prochain bonus : ${bonusType}`);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err, bonusType }, 'Failed to search next bonus');
    await interaction.editReply({
      embeds: [errorEmbed(`Impossible de chercher le prochain bonus **${bonusType}**.`)],
    });
  }
}

async function handleSemaine(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 6);

  try {
    const { data, stale } = await getRange(from, to);
    const embed = buildAlmanaxWeekEmbed(data, stale);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    log.error({ err }, 'Failed to fetch weekly almanax');
    await interaction.editReply({
      embeds: [errorEmbed('Impossible de récupérer l\'almanax de la semaine.')],
    });
  }
}
