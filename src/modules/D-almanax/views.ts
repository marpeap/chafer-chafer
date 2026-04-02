import { EmbedBuilder } from 'discord.js';
import { baseEmbed, Colors, Emoji, discordTimestamp, formatDate } from '../../views/base.js';
import type { AlmanaxEntry } from '../../integrations/almanax/client.js';

/**
 * Build an embed for a single almanax entry.
 */
export function buildAlmanaxEmbed(entry: AlmanaxEntry, stale = false): EmbedBuilder {
  const date = new Date(entry.date);
  const embed = baseEmbed(`${Emoji.CALENDAR} Almanax — ${formatDate(date)}`, Colors.ALMANAX)
    .addFields(
      {
        name: `${Emoji.STAR} Bonus`,
        value: `**${entry.bonus.type.name}**\n${entry.bonus.description}`,
      },
      {
        name: `${Emoji.COIN} Offrande`,
        value: `**${entry.tribute.quantity}x** ${entry.tribute.item.name}`,
        inline: true,
      },
    )
    .setDescription(`${discordTimestamp(date, 'D')}`);

  const imageUrl = entry.tribute.item.image_urls?.icon ?? entry.tribute.item.image_urls?.sd;
  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  if (stale) {
    embed.setFooter({
      text: '⚠ Données potentiellement obsolètes — Chafer Chafer',
    });
  }

  return embed;
}

/**
 * Build an embed showing the almanax for the next 7 days.
 */
export function buildAlmanaxWeekEmbed(entries: AlmanaxEntry[], stale = false): EmbedBuilder {
  const embed = baseEmbed(`${Emoji.CALENDAR} Almanax — Semaine à venir`, Colors.ALMANAX);

  const lines = entries.map((entry) => {
    const date = new Date(entry.date);
    const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
    return `**${dayName}** — ${entry.bonus.type.name}\n${Emoji.COIN} ${entry.tribute.quantity}x ${entry.tribute.item.name}`;
  });

  embed.setDescription(lines.join('\n\n'));

  if (stale) {
    embed.setFooter({
      text: '⚠ Données potentiellement obsolètes — Chafer Chafer',
    });
  }

  return embed;
}
