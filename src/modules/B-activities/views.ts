import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { baseEmbed, Colors, Emoji, discordTimestamp, truncate } from '../../views/base.js';

// ==================== Type Selection (2-step flow) ====================

export function buildTypeSelectMessage(flowType: 'sortie' | 'lfg'): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = baseEmbed(
    flowType === 'sortie' ? '\u2694\uFE0F Quel type de sortie ?' : '\uD83D\uDC65 Quel type d\'activit\u00E9 ?',
    Colors.INFO,
  ).setDescription('Choisis le type d\'activit\u00E9 :');

  const types = [
    { label: 'Donjon', emoji: '\u2694\uFE0F', value: 'donjon' },
    { label: 'Koliz\u00E9um', emoji: '\uD83C\uDFDF\uFE0F', value: 'koli' },
    { label: 'Songe', emoji: '\uD83D\uDCAD', value: 'songe' },
    { label: 'Qu\u00EAte', emoji: '\uD83D\uDCDC', value: 'quete' },
    { label: 'Farm', emoji: '\uD83C\uDF3E', value: 'farm' },
    { label: 'PvP', emoji: '\u26A1', value: 'pvp' },
    { label: 'Autre', emoji: '\uD83C\uDFB2', value: 'autre' },
  ];

  // 2 rows: 4 + 3 buttons
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...types.slice(0, 4).map(t =>
      new ButtonBuilder()
        .setCustomId(`activity:type_select:${flowType}:${t.value}`)
        .setLabel(t.label)
        .setEmoji(t.emoji)
        .setStyle(ButtonStyle.Secondary)
    )
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...types.slice(4).map(t =>
      new ButtonBuilder()
        .setCustomId(`activity:type_select:${flowType}:${t.value}`)
        .setLabel(t.label)
        .setEmoji(t.emoji)
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return { embeds: [embed], components: [row1, row2] };
}

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

// ==================== Role Slots Parsing ====================

/** Role abbreviation mapping */
const ROLE_ABBREV: Record<string, string> = {
  t: 'tank',
  tank: 'tank',
  h: 'heal',
  heal: 'heal',
  d: 'dps',
  dps: 'dps',
};

const ROLE_EMOJI: Record<string, string> = {
  tank: '\u{1F6E1}\uFE0F',   // shield
  heal: '\u2764\uFE0F',       // heart
  dps: '\u2694\uFE0F',        // swords
};

const ROLE_LABEL: Record<string, string> = {
  tank: 'Tanks',
  heal: 'Heals',
  dps: 'DPS',
};

export interface RoleSlotEntry {
  role: string; // tank, heal, dps
  count: number;
}

/**
 * Parse a roleSlots string like "2T,2H,4D" or "2 Tank, 2 Heal, 4 DPS"
 * into structured role slot entries.
 */
export function parseRoleSlotsString(raw: string | null | undefined): RoleSlotEntry[] {
  if (!raw) return [];
  const slots: RoleSlotEntry[] = [];
  // Split by comma or space-separated groups
  const parts = raw.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    // Match patterns: "2T", "2 Tank", "4DPS", "4 dps"
    const match = part.match(/^(\d+)\s*([a-zA-Z]+)$/);
    if (match) {
      const count = parseInt(match[1], 10);
      const roleKey = match[2].toLowerCase();
      const role = ROLE_ABBREV[roleKey];
      if (role && count > 0) {
        // Merge if same role appears multiple times
        const existing = slots.find((s) => s.role === role);
        if (existing) {
          existing.count += count;
        } else {
          slots.push({ role, count });
        }
      }
    }
  }
  return slots;
}

/**
 * Parse description field: extract role slots from the first line if it matches
 * the pattern "2 Tank, 2 Heal, 4 DPS". Returns the parsed roleSlots string and
 * the remaining description.
 */
export function parseRoleSlots(descriptionRaw: string | null): { roleSlots: string | null; description: string | null } {
  if (!descriptionRaw) return { roleSlots: null, description: null };

  const lines = descriptionRaw.split('\n');
  const firstLine = lines[0].trim();

  // Try to parse the first line as role slots
  const parsed = parseRoleSlotsString(firstLine);
  if (parsed.length > 0) {
    // First line is role config — format it as the canonical string
    const roleSlots = parsed.map((s) => `${s.count}${s.role[0].toUpperCase()}`).join(',');
    const remaining = lines.slice(1).join('\n').trim() || null;
    return { roleSlots, description: remaining };
  }

  // No role slots detected
  return { roleSlots: null, description: descriptionRaw };
}

interface ActivityData {
  id: number;
  title: string;
  activityType: string;
  description: string | null;
  roleSlots: string | null;
  scheduledAt: Date;
  estimatedDuration: number | null;
  maxPlayers: number | null;
  createdBy: string;
  status: string;
}

interface SignupData {
  userId: string;
  status: string; // confirmed, maybe, unavailable
  role: string | null;
}

interface QuickCallData {
  id: number;
  activityType: string;
  description: string | null;
  playersNeeded: number;
  minLevel: number | null;
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

  // Parse role slots
  const roleSlotEntries = parseRoleSlotsString(activity.roleSlots);
  const hasRoles = roleSlotEntries.length > 0;

  if (hasRoles) {
    // Role-based signup display
    for (const slot of roleSlotEntries) {
      const emoji = ROLE_EMOJI[slot.role] ?? Emoji.SWORD;
      const label = ROLE_LABEL[slot.role] ?? slot.role;
      const roleSignups = confirmed.filter((s) => s.role === slot.role);
      const list = roleSignups.length > 0
        ? roleSignups.map((s) => `<@${s.userId}>`).join(', ')
        : '*Aucun*';
      embed.addFields({
        name: `${emoji} ${label} (${roleSignups.length}/${slot.count})`,
        value: truncate(list, 1024),
        inline: true,
      });
    }

    // Show unroled confirmed (people who signed up without a role)
    const roledUserIds = new Set(
      confirmed.filter((s) => s.role && ROLE_ABBREV[s.role]).map((s) => s.userId),
    );
    const unroled = confirmed.filter((s) => !roledUserIds.has(s.userId));
    if (unroled.length > 0) {
      embed.addFields({
        name: `${Emoji.CHECK} Sans rôle (${unroled.length})`,
        value: truncate(unroled.map((s) => `<@${s.userId}>`).join(', '), 1024),
        inline: true,
      });
    }

    // Maybe and unavailable
    const maybeList = maybe.length > 0
      ? maybe.map((s) => `<@${s.userId}>`).join(', ')
      : '*Aucun*';
    const unavailableList = unavailable.length > 0
      ? unavailable.map((s) => `<@${s.userId}>`).join(', ')
      : '*Aucun*';
    embed.addFields(
      { name: `${Emoji.MAYBE} Peut-être (${maybe.length})`, value: truncate(maybeList, 1024), inline: true },
      { name: `${Emoji.UNAVAILABLE} Indisponibles (${unavailable.length})`, value: truncate(unavailableList, 1024), inline: true },
    );
  } else {
    // Flat signup lists (no roles)
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
  }

  if (activity.status !== 'published') {
    embed.setFooter({ text: `Chafer Chafer — Statut : ${activity.status}` });
  }

  // Buttons — Row 1: general signup
  const isClosed = activity.status === 'closed' || activity.status === 'cancelled';
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

  const components: ActionRowBuilder<ButtonBuilder>[] = [row1];

  // Row 2: role-specific buttons (only if activity has role slots)
  if (hasRoles) {
    const roleRow = new ActionRowBuilder<ButtonBuilder>();
    for (const slot of roleSlotEntries) {
      const emoji = ROLE_EMOJI[slot.role] ?? Emoji.SWORD;
      const label = ROLE_LABEL[slot.role] ?? slot.role;
      roleRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`activity:role:${slot.role}:${activity.id}`)
          .setLabel(label)
          .setEmoji(emoji)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(isClosed),
      );
    }
    components.push(roleRow);
  }

  return { embeds: [embed], components };
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
  const activeCount = partants.length + leads.length;
  const isFilled = call.status === 'filled';
  const isExpired = call.status === 'expired';

  // Determine embed color based on status
  const msRemaining = call.expiresAt.getTime() - Date.now();
  const urgentThreshold = 15 * 60 * 1000; // 15 minutes
  let embedColor: number = Colors.LFG;
  if (isFilled) {
    embedColor = Colors.SUCCESS; // green when complete
  } else if (isExpired) {
    embedColor = Colors.NEUTRAL; // gray when expired
  } else if (msRemaining > 0 && msRemaining <= urgentThreshold) {
    embedColor = Colors.WARNING; // orange when <15min remaining
  }

  // Build title with COMPLET indicator
  const statusTag = isFilled ? ' — COMPLET' : '';
  const embed = baseEmbed(`${typeEmoji} LFG — ${typeLabel}${statusTag}`, embedColor);

  // Player count field — prominent format
  const playerCountStr = `${Emoji.PEOPLE} **${activeCount}/${call.playersNeeded}** joueurs`;
  embed.addFields(
    { name: 'Groupe', value: playerCountStr, inline: true },
  );

  // Expiry field — show human-readable remaining time + Discord relative timestamp
  if (isFilled) {
    embed.addFields({ name: 'Statut', value: `${Emoji.CHECK} Groupe complet !`, inline: true });
  } else if (isExpired) {
    embed.addFields({ name: 'Statut', value: 'Expiré', inline: true });
  } else if (msRemaining > 0) {
    const minsLeft = Math.ceil(msRemaining / 60000);
    const timeStr = minsLeft >= 60
      ? `${Math.floor(minsLeft / 60)}h${minsLeft % 60 > 0 ? ` ${minsLeft % 60}min` : ''}`
      : `${minsLeft}min`;
    const urgentPrefix = minsLeft <= 15 ? `${Emoji.CLOCK} ` : '';
    embed.addFields({ name: 'Expire', value: `${urgentPrefix}dans ${timeStr} (${discordTimestamp(call.expiresAt, 'R')})`, inline: true });
  } else {
    embed.addFields({ name: 'Expire', value: discordTimestamp(call.expiresAt, 'R'), inline: true });
  }

  embed.addFields({ name: 'Lancé par', value: `<@${call.createdBy}>`, inline: true });

  // Level requirement
  if (call.minLevel) {
    embed.addFields({ name: 'Niveau minimum', value: `${call.minLevel}`, inline: true });
  }

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

  if (call.status !== 'open' && !isFilled) {
    embed.setFooter({ text: `Chafer Chafer — ${isExpired ? 'Expiré' : call.status}` });
  }

  const isClosed = call.status !== 'open' && !isFilled;
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

// ==================== Smart Matching Embeds ====================

const ACTIVITY_TYPE_LABELS_LOWER: Record<string, string> = ACTIVITY_TYPE_LABELS;

export function buildMatchFoundEmbed(
  activityType: string,
  matchedUserIds: string[],
): EmbedBuilder {
  const typeLabel = ACTIVITY_TYPE_LABELS_LOWER[activityType] ?? activityType;
  const playerList = matchedUserIds.map((id) => `${Emoji.CHECK} <@${id}>`).join('\n');

  return baseEmbed(`${Emoji.TROPHY} Groupe trouv\u00E9 !`, Colors.SUCCESS)
    .setDescription(
      `Un groupe **${typeLabel}** s'est form\u00E9 ! **${matchedUserIds.length}** joueurs pr\u00EAts.`,
    )
    .addFields({
      name: `${Emoji.PEOPLE} Joueurs`,
      value: truncate(playerList, 1024),
    });
}

export function buildSearchQueueEmbed(
  activityType: string,
  otherSearchers: number,
  expiresAt: Date,
  searchId: number,
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const typeLabel = ACTIVITY_TYPE_LABELS_LOWER[activityType] ?? activityType;

  const othersText = otherSearchers > 0
    ? `**${otherSearchers}** autre(s) joueur(s) cherchent aussi.`
    : 'Tu es le premier \u00E0 chercher ce type.';

  const embed = baseEmbed(`${Emoji.SEARCH} Recherche en cours`, Colors.INFO)
    .setDescription(
      `Tu cherches un groupe **${typeLabel}**. ${othersText}\n\n` +
      `${Emoji.CLOCK} Expire ${discordTimestamp(expiresAt, 'R')}`,
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`activity:cancel_search:${searchId}`)
      .setLabel('Annuler la recherche')
      .setEmoji(Emoji.CROSS)
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row] };
}

export function buildSearchCancelledEmbed(): EmbedBuilder {
  return baseEmbed(`${Emoji.CROSS} Recherche annul\u00E9e`, Colors.NEUTRAL)
    .setDescription('Ta recherche de groupe a \u00E9t\u00E9 annul\u00E9e.');
}

// ==================== Activity List ====================

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
