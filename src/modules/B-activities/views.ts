import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { baseEmbed, Colors, Emoji, discordTimestamp, truncate } from '../../views/base.js';

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  donjon: 'Donjon',
  koli: 'Kolizéum',
  songe: 'Songe',
  quete: 'Quête',
  farm: 'Farm',
  pvp: 'PvP',
  autre: 'Autre',
};

const ACTIVITY_TYPE_EMOJI: Record<string, string> = {
  donjon: Emoji.SWORD,
  koli: Emoji.SHIELD,
  songe: Emoji.STAR,
  quete: Emoji.SCROLL,
  farm: Emoji.COIN,
  pvp: Emoji.FIRE,
  autre: Emoji.HAMMER,
};

interface ActivityData {
  id: number;
  title: string;
  activityType: string;
  description: string | null;
  scheduledAt: Date;
  estimatedDuration: number | null;
  maxPlayers: number | null;
  createdBy: string;
  status: string;
}

interface SignupData {
  userId: string;
  status: string; // confirmed, maybe, unavailable
}

interface QuickCallData {
  id: number;
  activityType: string;
  description: string | null;
  playersNeeded: number;
  expiresAt: Date;
  createdBy: string;
  status: string;
}

interface QuickCallResponseData {
  userId: string;
  status: string; // partant, lead, pas_ce_soir
}

export function buildActivityEmbed(
  activity: ActivityData,
  signups: SignupData[],
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const typeLabel = ACTIVITY_TYPE_LABELS[activity.activityType] ?? activity.activityType;
  const typeEmoji = ACTIVITY_TYPE_EMOJI[activity.activityType] ?? Emoji.SWORD;

  const confirmed = signups.filter((s) => s.status === 'confirmed');
  const maybe = signups.filter((s) => s.status === 'maybe');
  const unavailable = signups.filter((s) => s.status === 'unavailable');

  const embed = baseEmbed(`${typeEmoji} ${activity.title}`, Colors.ACTIVITY)
    .addFields(
      { name: 'Type', value: typeLabel, inline: true },
      { name: 'Date', value: discordTimestamp(activity.scheduledAt, 'F'), inline: true },
      { name: 'Compte à rebours', value: discordTimestamp(activity.scheduledAt, 'R'), inline: true },
    );

  if (activity.estimatedDuration) {
    const hours = Math.floor(activity.estimatedDuration / 60);
    const mins = activity.estimatedDuration % 60;
    const durationStr = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}min` : ''}` : `${mins}min`;
    embed.addFields({ name: 'Durée estimée', value: durationStr, inline: true });
  }

  if (activity.maxPlayers) {
    embed.addFields({
      name: 'Places',
      value: `${confirmed.length}/${activity.maxPlayers}`,
      inline: true,
    });
  }

  embed.addFields({ name: 'Organisateur', value: `<@${activity.createdBy}>`, inline: true });

  if (activity.description) {
    embed.addFields({ name: 'Description', value: truncate(activity.description, 1024) });
  }

  // Signup lists
  const confirmedList = confirmed.length > 0
    ? confirmed.map((s) => `${Emoji.CHECK} <@${s.userId}>`).join('\n')
    : '*Aucun*';
  const maybeList = maybe.length > 0
    ? maybe.map((s) => `${Emoji.MAYBE} <@${s.userId}>`).join('\n')
    : '*Aucun*';
  const unavailableList = unavailable.length > 0
    ? unavailable.map((s) => `${Emoji.UNAVAILABLE} <@${s.userId}>`).join('\n')
    : '*Aucun*';

  embed.addFields(
    { name: `${Emoji.CHECK} Confirmés (${confirmed.length})`, value: truncate(confirmedList, 1024), inline: true },
    { name: `${Emoji.MAYBE} Peut-être (${maybe.length})`, value: truncate(maybeList, 1024), inline: true },
    { name: `${Emoji.UNAVAILABLE} Indisponibles (${unavailable.length})`, value: truncate(unavailableList, 1024), inline: true },
  );

  if (activity.status !== 'published') {
    embed.setFooter({ text: `Chafer Chafer — Statut : ${activity.status}` });
  }

  // Buttons
  const isClosed = activity.status === 'closed' || activity.status === 'cancelled';
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`activity:join:${activity.id}`)
      .setLabel('Présent')
      .setEmoji(Emoji.CHECK)
      .setStyle(ButtonStyle.Success)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`activity:maybe:${activity.id}`)
      .setLabel('Peut-être')
      .setEmoji(Emoji.MAYBE)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`activity:unavailable:${activity.id}`)
      .setLabel('Indisponible')
      .setEmoji(Emoji.UNAVAILABLE)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(isClosed),
  );

  return { embeds: [embed], components: [row] };
}

export function buildQuickCallEmbed(
  call: QuickCallData,
  responses: QuickCallResponseData[],
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const typeLabel = ACTIVITY_TYPE_LABELS[call.activityType] ?? call.activityType;
  const typeEmoji = ACTIVITY_TYPE_EMOJI[call.activityType] ?? Emoji.FIRE;

  const partants = responses.filter((r) => r.status === 'partant');
  const leads = responses.filter((r) => r.status === 'lead');
  const pass = responses.filter((r) => r.status === 'pas_ce_soir');

  const embed = baseEmbed(`${Emoji.FIRE} LFG — ${typeLabel}`, Colors.LFG)
    .addFields(
      { name: 'Joueurs recherchés', value: `${partants.length + leads.length}/${call.playersNeeded}`, inline: true },
      { name: 'Expire', value: discordTimestamp(call.expiresAt, 'R'), inline: true },
      { name: 'Lancé par', value: `<@${call.createdBy}>`, inline: true },
    );

  if (call.description) {
    embed.addFields({ name: 'Commentaire', value: truncate(call.description, 1024) });
  }

  // Response lists
  const partantList = partants.length > 0
    ? partants.map((r) => `${Emoji.CHECK} <@${r.userId}>`).join('\n')
    : '*Aucun*';
  const leadList = leads.length > 0
    ? leads.map((r) => `${Emoji.STAR} <@${r.userId}>`).join('\n')
    : '*Aucun*';
  const passList = pass.length > 0
    ? pass.map((r) => `${Emoji.UNAVAILABLE} <@${r.userId}>`).join('\n')
    : '*Aucun*';

  embed.addFields(
    { name: `${Emoji.CHECK} Partants (${partants.length})`, value: truncate(partantList, 1024), inline: true },
    { name: `${Emoji.STAR} Leads (${leads.length})`, value: truncate(leadList, 1024), inline: true },
    { name: `${Emoji.UNAVAILABLE} Pas ce soir (${pass.length})`, value: truncate(passList, 1024), inline: true },
  );

  if (call.status !== 'open') {
    embed.setFooter({ text: `Chafer Chafer — ${call.status === 'expired' ? 'Expiré' : call.status === 'filled' ? 'Complet' : call.status}` });
  }

  const isClosed = call.status !== 'open';
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`lfg:partant:${call.id}`)
      .setLabel('Partant')
      .setEmoji(Emoji.CHECK)
      .setStyle(ButtonStyle.Success)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`lfg:lead:${call.id}`)
      .setLabel('Je lead')
      .setEmoji(Emoji.STAR)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isClosed),
    new ButtonBuilder()
      .setCustomId(`lfg:pass:${call.id}`)
      .setLabel('Pas ce soir')
      .setEmoji(Emoji.UNAVAILABLE)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isClosed),
  );

  return { embeds: [embed], components: [row] };
}

export function buildActivityListEmbed(
  activities: (ActivityData & { signups: SignupData[] })[],
): EmbedBuilder {
  if (activities.length === 0) {
    return baseEmbed(`${Emoji.CALENDAR} Sorties à venir`, Colors.ACTIVITY)
      .setDescription('Aucune sortie planifiée pour le moment.');
  }

  const lines = activities.map((a) => {
    const typeEmoji = ACTIVITY_TYPE_EMOJI[a.activityType] ?? Emoji.SWORD;
    const typeLabel = ACTIVITY_TYPE_LABELS[a.activityType] ?? a.activityType;
    const confirmed = a.signups.filter((s) => s.status === 'confirmed').length;
    const maxStr = a.maxPlayers ? `/${a.maxPlayers}` : '';
    return `${typeEmoji} **${a.title}** — ${typeLabel}\n${Emoji.CALENDAR} ${discordTimestamp(a.scheduledAt, 'F')} (${discordTimestamp(a.scheduledAt, 'R')})\n${Emoji.PEOPLE} ${confirmed}${maxStr} confirmés — ID: \`${a.id}\``;
  });

  return baseEmbed(`${Emoji.CALENDAR} Sorties à venir (${activities.length})`, Colors.ACTIVITY)
    .setDescription(truncate(lines.join('\n\n'), 4096));
}
