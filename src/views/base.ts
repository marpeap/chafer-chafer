import { EmbedBuilder } from 'discord.js';

// Design system colors
export const Colors = {
  PRIMARY: 0x1abc9c,    // Turquoise — brand
  SUCCESS: 0x2ecc71,    // Green
  WARNING: 0xf39c12,    // Orange
  ERROR: 0xe74c3c,      // Red
  INFO: 0x3498db,       // Blue
  ALMANAX: 0x9b59b6,    // Purple
  ACTIVITY: 0xe67e22,   // Dark orange
  LFG: 0x1abc9c,        // Turquoise
  CRAFT: 0x27ae60,      // Green
  REWARD: 0xf1c40f,     // Gold
  FORUM: 0x2980b9,      // Blue
  NEUTRAL: 0x95a5a6,    // Gray
} as const;

// Emojis used across the bot
export const Emoji = {
  CHECK: '✅',
  CROSS: '❌',
  CLOCK: '⏰',
  CALENDAR: '📅',
  STAR: '⭐',
  SWORD: '⚔️',
  SCROLL: '📜',
  HAMMER: '🔨',
  COIN: '🪙',
  PEOPLE: '👥',
  SEARCH: '🔍',
  BELL: '🔔',
  SHIELD: '🛡️',
  FIRE: '🔥',
  MAYBE: '🤔',
  UNAVAILABLE: '🚫',
  TROPHY: '🏆',
  BOOK: '📖',
  WRENCH: '🔧',
} as const;

export function baseEmbed(title: string, color: number = Colors.PRIMARY): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(truncate(title, 256))
    .setTimestamp()
    .setFooter({ text: 'Chafer Chafer — Par Marpeap · marpeap.com' });
}

export function errorEmbed(message: string): EmbedBuilder {
  return baseEmbed(`${Emoji.CROSS} Erreur`, Colors.ERROR).setDescription(message);
}

export function successEmbed(message: string): EmbedBuilder {
  return baseEmbed(`${Emoji.CHECK} Succès`, Colors.SUCCESS).setDescription(message);
}

export function infoEmbed(title: string, message: string): EmbedBuilder {
  return baseEmbed(title, Colors.INFO).setDescription(message);
}

export function disabledModuleEmbed(moduleName: string): EmbedBuilder {
  return baseEmbed('Module désactivé', Colors.NEUTRAL)
    .setDescription(`Le module **${moduleName}** est actuellement désactivé sur ce serveur.`);
}

export function noPermissionEmbed(requiredLevel: string): EmbedBuilder {
  return baseEmbed('Permission insuffisante', Colors.ERROR)
    .setDescription(`Cette commande nécessite le niveau **${requiredLevel}** minimum.`);
}

/** Truncate text to fit Discord limits */
export function truncate(text: string, max: number = 1024): string {
  return text.length > max ? text.slice(0, max - 3) + '...' : text;
}

/** Format a Date for display in French */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
}

/** Discord timestamp format */
export function discordTimestamp(date: Date, style: 'R' | 'F' | 'f' | 'D' | 'd' | 'T' | 't' = 'F'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}
