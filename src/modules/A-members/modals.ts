import { ModalSubmitInteraction, TextChannel, GuildMember } from 'discord.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { childLogger } from '../../core/logger.js';
import { successEmbed, errorEmbed } from '../../views/base.js';
import { buildPendingRequestEmbed, buildPendingRequestButtons } from './views.js';
import { PROFESSIONS } from '../E-professions/commands.js';

const log = childLogger('A-members:modals');

// Normalized profession names for validation (lowercase)
const PROFESSIONS_LOWER = PROFESSIONS.map((p) => p.toLowerCase());

export async function handleMemberModal(interaction: ModalSubmitInteraction): Promise<void> {
  switch (interaction.customId) {
    case 'member:profile_create':
      return handleProfileCreate(interaction);
    case 'member:profile_edit':
      return handleProfileEdit(interaction);
    case 'member:professions200_edit':
      return handleProfessions200Edit(interaction);
    default:
      log.warn({ customId: interaction.customId }, 'Unknown member modal');
  }
}

// ────────────────── Parse & validate shared fields ──────────────────

interface ProfileFields {
  characterName: string;
  characterClass: string;
  characterLevel: number;
  orientation: string;
  presentation: string | null;
}

function parseProfileFields(interaction: ModalSubmitInteraction): ProfileFields | null {
  const characterName = interaction.fields.getTextInputValue('character_name').trim();
  const characterClass = interaction.fields.getTextInputValue('character_class').trim();
  const levelStr = interaction.fields.getTextInputValue('character_level').trim();
  const orientationRaw = interaction.fields.getTextInputValue('orientation').trim().toLowerCase();
  const presentation = interaction.fields.getTextInputValue('presentation')?.trim() || null;

  const characterLevel = parseInt(levelStr, 10);

  return { characterName, characterClass, characterLevel, orientation: orientationRaw, presentation };
}

async function validateProfileFields(
  interaction: ModalSubmitInteraction,
  fields: ProfileFields,
): Promise<boolean> {
  // Validate level
  if (isNaN(fields.characterLevel) || fields.characterLevel < 1 || fields.characterLevel > 230) {
    await interaction.reply({
      embeds: [errorEmbed('Le niveau doit \u00eatre entre 1 et 230.')],
      ephemeral: true,
    });
    return false;
  }

  // Validate orientation
  const validOrientations: Record<string, string> = {
    pvm: 'pvm',
    pvp: 'pvp',
    'les deux': 'both',
    both: 'both',
    lesdeux: 'both',
    'les 2': 'both',
  };

  if (!validOrientations[fields.orientation]) {
    await interaction.reply({
      embeds: [errorEmbed('Orientation invalide. Valeurs accept\u00e9es : `pvm`, `pvp`, `les deux`.')],
      ephemeral: true,
    });
    return false;
  }

  // Normalize orientation
  fields.orientation = validOrientations[fields.orientation];

  // Validate class name (non-empty)
  if (!fields.characterClass) {
    await interaction.reply({
      embeds: [errorEmbed('La classe ne peut pas \u00eatre vide.')],
      ephemeral: true,
    });
    return false;
  }

  return true;
}

// ────────────────── Profile create (new application) ──────────────────

async function handleProfileCreate(interaction: ModalSubmitInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const userId = interaction.user.id;
  const fields = parseProfileFields(interaction);
  if (!fields) return;

  if (!(await validateProfileFields(interaction, fields))) return;

  // Create or update profile with status pending
  const profile = await db().playerProfile.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: {
      guildId,
      userId,
      status: 'pending',
      characterName: fields.characterName,
      characterClass: fields.characterClass,
      characterLevel: fields.characterLevel,
      orientation: fields.orientation,
      presentation: fields.presentation,
    },
    update: {
      status: 'pending',
      characterName: fields.characterName,
      characterClass: fields.characterClass,
      characterLevel: fields.characterLevel,
      orientation: fields.orientation,
      presentation: fields.presentation,
    },
  });

  // Post pending request to officers channel
  const guildConfig = await db().discordGuild.findUnique({
    where: { guildId },
  });

  const officerChannelId = guildConfig?.officersChannelId ?? guildConfig?.logChannelId;

  if (officerChannelId) {
    try {
      const channel = interaction.client.channels.cache.get(officerChannelId);
      if (channel && channel instanceof TextChannel) {
        const member = interaction.member as GuildMember;
        const embed = buildPendingRequestEmbed(profile, member);
        const buttons = buildPendingRequestButtons(profile.id);
        await channel.send({ embeds: [embed], components: [buttons] });
      }
    } catch (err) {
      log.warn({ err }, 'Failed to post pending request to officers channel');
    }
  }

  // Audit
  await audit({
    guildId,
    actorId: userId,
    action: 'member.application_submitted',
    targetType: 'player_profile',
    targetId: String(profile.id),
    details: {
      characterName: fields.characterName,
      characterClass: fields.characterClass,
      characterLevel: fields.characterLevel,
      orientation: fields.orientation,
    },
  });

  await interaction.reply({
    embeds: [successEmbed('Ta demande a \u00e9t\u00e9 envoy\u00e9e aux officiers ! Tu seras notifi\u00e9 quand elle sera trait\u00e9e.')],
    ephemeral: true,
  });

  log.info({ profileId: profile.id, guildId, userId }, 'Member application submitted');
}

// ────────────────── Profile edit (update existing) ──────────────────

async function handleProfileEdit(interaction: ModalSubmitInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const userId = interaction.user.id;
  const fields = parseProfileFields(interaction);
  if (!fields) return;

  if (!(await validateProfileFields(interaction, fields))) return;

  const existing = await db().playerProfile.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  if (!existing) {
    await interaction.reply({
      embeds: [errorEmbed('Profil introuvable. Utilise "Devenir Chafer" d\'abord.')],
      ephemeral: true,
    });
    return;
  }

  await db().playerProfile.update({
    where: { id: existing.id },
    data: {
      characterName: fields.characterName,
      characterClass: fields.characterClass,
      characterLevel: fields.characterLevel,
      orientation: fields.orientation,
      presentation: fields.presentation,
    },
  });

  await interaction.reply({
    embeds: [successEmbed('Profil mis \u00e0 jour !')],
    ephemeral: true,
  });

  log.info({ profileId: existing.id, guildId, userId }, 'Profile updated');
}

// ────────────────── Professions 200 edit ──────────────────

async function handleProfessions200Edit(interaction: ModalSubmitInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const userId = interaction.user.id;
  const raw = interaction.fields.getTextInputValue('professions200')?.trim() || '';

  const existing = await db().playerProfile.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  if (!existing) {
    await interaction.reply({
      embeds: [errorEmbed('Profil introuvable. Utilise "Devenir Chafer" d\'abord.')],
      ephemeral: true,
    });
    return;
  }

  if (!raw) {
    // Clear professions
    await db().playerProfile.update({
      where: { id: existing.id },
      data: { professions200: null },
    });

    await interaction.reply({
      embeds: [successEmbed('M\u00e9tiers 200 vid\u00e9s.')],
      ephemeral: true,
    });
    return;
  }

  // Parse: comma or newline separated
  const parsed = raw
    .split(/[,\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Validate each against known professions
  const invalid: string[] = [];
  const validated: string[] = [];

  for (const entry of parsed) {
    const idx = PROFESSIONS_LOWER.indexOf(entry.toLowerCase());
    if (idx === -1) {
      invalid.push(entry);
    } else {
      // Use the canonical casing from PROFESSIONS
      validated.push(PROFESSIONS[idx]);
    }
  }

  if (invalid.length > 0) {
    await interaction.reply({
      embeds: [errorEmbed(
        `M\u00e9tier(s) invalide(s) : ${invalid.map((i) => `\`${i}\``).join(', ')}\n\n` +
        `M\u00e9tiers valides :\n${PROFESSIONS.join(', ')}`,
      )],
      ephemeral: true,
    });
    return;
  }

  // Deduplicate
  const unique = [...new Set(validated)];
  const stored = unique.join(', ');

  await db().playerProfile.update({
    where: { id: existing.id },
    data: { professions200: stored },
  });

  await interaction.reply({
    embeds: [successEmbed(`M\u00e9tiers 200 mis \u00e0 jour : ${stored}`)],
    ephemeral: true,
  });

  log.info({ profileId: existing.id, guildId, professions: unique }, 'Professions 200 updated');
}
