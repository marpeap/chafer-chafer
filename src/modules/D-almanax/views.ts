import { EmbedBuilder } from 'discord.js';
import { baseEmbed, Colors, Emoji, discordTimestamp, truncate } from '../../views/base.js';
import type { AlmanaxEntry } from '../../integrations/almanax/client.js';

// ══════════════════════════════════════════
//  BONUS TYPE → EMBED COLOR
// ══════════════════════════════════════════

const BONUS_COLORS: Record<string, number> = {
  // Combat / stats
  'Prospection': 0xF1C40F,       // gold
  'Sagesse': 0x3498DB,           // blue
  'Force': 0xE74C3C,             // red
  'Intelligence': 0x9B59B6,      // purple
  'Chance': 0x1ABC9C,            // turquoise
  'Agilité': 0x2ECC71,           // green
  'Vitalité': 0xE91E63,          // pink
  'Puissance': 0xE67E22,         // orange
  'Dommages': 0xC0392B,          // dark red
  'Soins': 0x2ECC71,             // green
  'Pods': 0x95A5A6,              // gray
  'Initiative': 0xF39C12,        // orange

  // XP / progression
  'XP': 0x3498DB,                // blue
  'Étoiles': 0xF1C40F,           // gold

  // Craft / harvest / economy
  'Récolte': 0x27AE60,           // green
  'Craft': 0x27AE60,             // green

  // Drops
  'Butin': 0xF1C40F,             // gold
  'Drop': 0xF1C40F,              // gold
};

const DEFAULT_BONUS_COLOR = Colors.ALMANAX;

function getBonusColor(bonusTypeName: string): number {
  // Exact match first
  if (BONUS_COLORS[bonusTypeName]) return BONUS_COLORS[bonusTypeName];
  // Partial match (e.g. "Bonus de Prospection" contains "Prospection")
  const lowerName = bonusTypeName.toLowerCase();
  for (const [key, color] of Object.entries(BONUS_COLORS)) {
    if (lowerName.includes(key.toLowerCase())) return color;
  }
  return DEFAULT_BONUS_COLOR;
}

// ══════════════════════════════════════════
//  HIGHLIGHT "INTERESTING" BONUSES
// ══════════════════════════════════════════

const HIGHLIGHT_KEYWORDS = ['xp', 'prospection', 'drop', 'butin', 'craft', 'récolte', 'sagesse', 'étoile'];

function isHighlightBonus(bonusTypeName: string): boolean {
  const lower = bonusTypeName.toLowerCase();
  return HIGHLIGHT_KEYWORDS.some((kw) => lower.includes(kw));
}

function highlightEmoji(bonusTypeName: string): string {
  const lower = bonusTypeName.toLowerCase();
  if (lower.includes('xp') || lower.includes('sagesse')) return Emoji.STAR;
  if (lower.includes('prospection') || lower.includes('drop') || lower.includes('butin')) return Emoji.COIN;
  if (lower.includes('craft') || lower.includes('récolte')) return Emoji.HAMMER;
  if (lower.includes('étoile')) return Emoji.TROPHY;
  return '';
}

// ══════════════════════════════════════════
//  FRENCH DATE FORMATTING
// ══════════════════════════════════════════

function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z'); // noon to avoid timezone issues
  const formatted = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });
  // Capitalize first letter
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

const SHORT_DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function shortDayFr(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  return SHORT_DAYS_FR[date.getUTCDay()];
}

function shortDateFr(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Paris',
  });
}

// ══════════════════════════════════════════
//  SINGLE DAY EMBED
// ══════════════════════════════════════════

/**
 * Build an embed for a single almanax entry.
 */
export function buildAlmanaxEmbed(entry: AlmanaxEntry, stale = false): EmbedBuilder {
  const date = new Date(entry.date);
  const color = getBonusColor(entry.bonus.type.name);
  const frenchDate = formatDateFr(entry.date);

  const embed = baseEmbed(`${Emoji.CALENDAR} Almanax — ${frenchDate}`, color)
    .setDescription(
      `${discordTimestamp(date, 'D')}\n\n` +
      `### ${Emoji.STAR} ${entry.bonus.type.name}\n` +
      `>>> ${entry.bonus.description}`,
    )
    .addFields(
      {
        name: `${Emoji.COIN} Offrande`,
        value: `**${entry.tribute.quantity}x** ${entry.tribute.item.name}`,
        inline: true,
      },
      {
        name: `${Emoji.SCROLL} Type d'objet`,
        value: entry.tribute.item.subtype || 'Inconnu',
        inline: true,
      },
    );

  const imageUrl = entry.tribute.item.image_urls?.icon ?? entry.tribute.item.image_urls?.sd;
  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  if (stale) {
    embed.setFooter({
      text: '\u26A0 Données potentiellement obsolètes — Chafer Chafer',
    });
  }

  return embed;
}

// ══════════════════════════════════════════
//  TOMORROW PREVIEW (compact, for cron)
// ══════════════════════════════════════════

/**
 * Build a compact embed previewing tomorrow's almanax bonus.
 */
export function buildAlmanaxTomorrowPreview(entry: AlmanaxEntry): EmbedBuilder {
  const frenchDate = formatDateFr(entry.date);
  const color = getBonusColor(entry.bonus.type.name);

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${Emoji.SEARCH} Demain — ${frenchDate}`)
    .setDescription(
      `**${entry.bonus.type.name}**\n` +
      `${truncate(entry.bonus.description, 200)}\n\n` +
      `${Emoji.COIN} ${entry.tribute.quantity}x ${entry.tribute.item.name}`,
    )
    .setFooter({ text: 'Aperçu du lendemain — Chafer Chafer' });
}

// ══════════════════════════════════════════
//  WEEKLY EMBED
// ══════════════════════════════════════════

/**
 * Build an embed showing the almanax for the next 7 days.
 */
export function buildAlmanaxWeekEmbed(entries: AlmanaxEntry[], stale = false): EmbedBuilder {
  const embed = baseEmbed(`${Emoji.CALENDAR} Almanax — Semaine à venir`, Colors.ALMANAX);

  const lines = entries.map((entry) => {
    const day = shortDayFr(entry.date);
    const dateLabel = shortDateFr(entry.date);
    const bonusName = entry.bonus.type.name;
    const marker = isHighlightBonus(bonusName) ? ` ${highlightEmoji(bonusName)}` : '';

    return (
      `**${day} ${dateLabel}**${marker}\n` +
      `${bonusName} — ${Emoji.COIN} ${entry.tribute.quantity}x ${entry.tribute.item.name}`
    );
  });

  embed.setDescription(lines.join('\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'));

  if (stale) {
    embed.setFooter({
      text: '\u26A0 Données potentiellement obsolètes — Chafer Chafer',
    });
  }

  return embed;
}
