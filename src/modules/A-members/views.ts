import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalActionRowComponentBuilder,
  GuildMember,
} from 'discord.js';
/**
 * @module A-members/views
 * @description Discord embed builders for member profiles and pending requests.
 *
 * Pure display layer — no database calls, no side effects.
 *
 * Used by: A-members/buttons.ts, A-members/modals.ts, panel/modals.ts (admin profil)
 * Depends on: views/base (shared embed utilities), services/member (ProfileStats type)
 */

import { baseEmbed, Colors, Emoji, truncate, formatDate } from '../../views/base.js';
import type { PlayerProfile } from '@prisma/client';
import type { ProfileStats } from '../../services/member.service.js';

export type { ProfileStats };

// ────────────────── Color mapping ──────────────────

const ORIENTATION_COLORS: Record<string, number> = {
  pvm: Colors.SUCCESS,   // green
  pvp: Colors.ERROR,     // red
  both: 0x9b59b6,        // purple
};

const ORIENTATION_LABELS: Record<string, string> = {
  pvm: 'PvM',
  pvp: 'PvP',
  both: 'Les deux',
};

// ────────────────── Profile embed ──────────────────

export function buildProfileEmbed(
  profile: PlayerProfile,
  member: GuildMember,
  stats?: ProfileStats,
): EmbedBuilder {
  const color = ORIENTATION_COLORS[profile.orientation ?? ''] ?? Colors.PRIMARY;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`\u{1F480} Profil de ${member.displayName}`)
    .setTimestamp();

  if (member.user.displayAvatarURL()) {
    embed.setThumbnail(member.user.displayAvatarURL({ size: 128 }));
  }

  const fields: { name: string; value: string; inline: boolean }[] = [];

  fields.push({
    name: 'Personnage',
    value: profile.characterName ?? 'Non renseign\u00e9',
    inline: true,
  });

  fields.push({
    name: 'Classe',
    value: profile.characterClass ?? 'Non renseign\u00e9e',
    inline: true,
  });

  fields.push({
    name: 'Niveau',
    value: profile.characterLevel != null ? String(profile.characterLevel) : 'Non renseign\u00e9',
    inline: true,
  });

  fields.push({
    name: 'Orientation',
    value: ORIENTATION_LABELS[profile.orientation ?? ''] ?? 'Non renseign\u00e9e',
    inline: true,
  });

  const profs200 = profile.professions200
    ? profile.professions200.split(',').map((p) => p.trim()).filter(Boolean).join(', ')
    : 'Aucun';
  fields.push({
    name: 'M\u00e9tiers 200',
    value: profs200,
    inline: false,
  });

  if (profile.presentation) {
    fields.push({
      name: 'Pr\u00e9sentation',
      value: truncate(profile.presentation, 1024),
      inline: false,
    });
  }

  const statusText = profile.globalAvailable
    ? '\u{1F680} Glandeur Dispo'
    : 'Non disponible';
  fields.push({
    name: 'Statut',
    value: statusText,
    inline: true,
  });

  if (stats) {
    fields.push({
      name: '\u{1F4CA} Statistiques',
      value: [
        `\u{2694}\u{FE0F} Sorties: ${stats.activityCount} | \u{1F465} Groupes: ${stats.quickCallCount}`,
        `\u{1F4E6} Crafts demand\u00e9s: ${stats.craftsMade} | \u{1F528} Crafts r\u00e9alis\u00e9s: ${stats.craftsFulfilled}`,
        `\u{1F3C6} R\u00e9compenses re\u00e7ues: ${stats.rewardsPaid}`,
      ].join('\n'),
      inline: false,
    });
  }

  embed.addFields(fields);

  if (profile.approvedAt) {
    embed.setFooter({ text: `Chafer depuis ${formatDate(profile.approvedAt)}` });
  } else {
    embed.setFooter({ text: 'Chafer Chafer' });
  }

  return embed;
}

// ────────────────── Pending request embed (for admin) ──────────────────

export function buildPendingRequestEmbed(profile: PlayerProfile, member: GuildMember): EmbedBuilder {
  const embed = baseEmbed('\u{1F480} Demande d\'adh\u00e9sion', Colors.WARNING)
    .setDescription(`<@${member.id}> souhaite devenir Chafer`);

  if (member.user.displayAvatarURL()) {
    embed.setThumbnail(member.user.displayAvatarURL({ size: 128 }));
  }

  const fields: { name: string; value: string; inline: boolean }[] = [];

  if (profile.characterName) {
    fields.push({ name: 'Personnage', value: profile.characterName, inline: true });
  }
  if (profile.characterClass) {
    fields.push({ name: 'Classe', value: profile.characterClass, inline: true });
  }
  if (profile.characterLevel != null) {
    fields.push({ name: 'Niveau', value: String(profile.characterLevel), inline: true });
  }
  if (profile.orientation) {
    fields.push({
      name: 'Orientation',
      value: ORIENTATION_LABELS[profile.orientation] ?? profile.orientation,
      inline: true,
    });
  }
  if (profile.presentation) {
    fields.push({
      name: 'Pr\u00e9sentation',
      value: truncate(profile.presentation, 1024),
      inline: false,
    });
  }

  embed.addFields(fields);
  return embed;
}

// ────────────────── Pending request buttons (approve / reject) ──────────────────

export function buildPendingRequestButtons(profileId: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`member:approve:${profileId}`)
      .setLabel('Valider')
      .setEmoji(Emoji.CHECK)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`member:reject:${profileId}`)
      .setLabel('Refuser')
      .setEmoji(Emoji.CROSS)
      .setStyle(ButtonStyle.Danger),
  );
}

// ────────────────── Profile view buttons ──────────────────

export function buildProfileViewButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('member:edit_profile')
      .setLabel('Modifier profil')
      .setEmoji('\u{270F}\u{FE0F}')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('member:edit_professions200')
      .setLabel('Modifier m\u00e9tiers 200')
      .setEmoji('\u{1F4CB}')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ────────────────── Profile edit modal ──────────────────

export function buildProfileEditModal(customId: 'member:profile_create' | 'member:profile_edit'): ModalBuilder {
  const isCreate = customId === 'member:profile_create';
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(isCreate ? 'Devenir Chafer' : 'Modifier mon profil');

  const nameInput = new TextInputBuilder()
    .setCustomId('character_name')
    .setLabel('Nom du personnage')
    .setPlaceholder('Ex: Xel\u00f4r-du-42')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(30);

  const classInput = new TextInputBuilder()
    .setCustomId('character_class')
    .setLabel('Classe')
    .setPlaceholder('Ex: Cr\u00e2, Eniripsa, Sacrieur...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(30);

  const levelInput = new TextInputBuilder()
    .setCustomId('character_level')
    .setLabel('Niveau')
    .setPlaceholder('Ex: 200')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(3);

  const orientationInput = new TextInputBuilder()
    .setCustomId('orientation')
    .setLabel('Orientation')
    .setPlaceholder('pvm, pvp, ou les deux')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  const presentationInput = new TextInputBuilder()
    .setCustomId('presentation')
    .setLabel('Pr\u00e9sentation (optionnel)')
    .setPlaceholder('Parle-nous de toi, tes objectifs en jeu...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(classInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(levelInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(orientationInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(presentationInput),
  );

  return modal;
}

// ────────────────── Professions 200 modal ──────────────────

export function buildProfessions200Modal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId('member:professions200_edit')
    .setTitle('M\u00e9tiers niveau 200');

  const profsInput = new TextInputBuilder()
    .setCustomId('professions200')
    .setLabel('M\u00e9tiers niveau 200')
    .setPlaceholder('Ex: Bijoutier, Cordonnier, Mineur\n(un par ligne ou s\u00e9par\u00e9s par virgules)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(profsInput),
  );

  return modal;
}
