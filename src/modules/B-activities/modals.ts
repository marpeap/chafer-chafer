import { ModalSubmitInteraction, TextChannel } from 'discord.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed, successEmbed } from '../../views/base.js';
import { buildActivityEmbed, buildQuickCallEmbed, parseRoleSlots } from './views.js';

const log = childLogger('activities:modals');

const VALID_TYPES = ['donjon', 'koli', 'songe', 'quete', 'farm', 'pvp', 'autre'];

export async function handleActivityModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId } = interaction;

  // Support both old format (sortie_creer) and new format (sortie_creer:donjon)
  if (customId === 'sortie_creer' || customId.startsWith('sortie_creer:')) {
    return handleSortieCreerModal(interaction);
  }
  if (customId === 'lfg_creer' || customId.startsWith('lfg_creer:')) {
    return handleLfgCreerModal(interaction);
  }

  log.warn({ customId }, 'Unknown activity modal');
}

async function handleSortieCreerModal(interaction: ModalSubmitInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  await interaction.deferReply({ ephemeral: true });

  // Parse fields
  const titre = interaction.fields.getTextInputValue('titre').trim();
  const dateHeureStr = interaction.fields.getTextInputValue('date_heure').trim();
  const dureeMaxStr = interaction.fields.getTextInputValue('duree_max')?.trim() || '';
  const descriptionRaw = interaction.fields.getTextInputValue('description')?.trim() || null;

  // Parse role slots from the first line of description (e.g. "2 Tank, 2 Heal, 4 DPS")
  const { roleSlots, description } = parseRoleSlots(descriptionRaw);

  // Extract type from customId (new format: sortie_creer:donjon) or fallback to text field (old format)
  let activityType: string | null = null;
  const customIdParts = interaction.customId.split(':');
  if (customIdParts.length >= 2 && VALID_TYPES.includes(customIdParts[1])) {
    activityType = customIdParts[1];
  } else {
    // Backward compat: try to read from the type text field
    try {
      const typeRaw = interaction.fields.getTextInputValue('type').trim().toLowerCase().replace('\u00EA', 'e');
      activityType = VALID_TYPES.includes(typeRaw) ? typeRaw : null;
    } catch { /* field does not exist in new modal */ }
  }
  if (!activityType) {
    await interaction.editReply({
      embeds: [errorEmbed(`Type invalide. Types valides : ${VALID_TYPES.join(', ')}`)],
    });
    return;
  }

  // Parse date (JJ/MM/AAAA HH:MM)
  const dateMatch = dateHeureStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!dateMatch) {
    await interaction.editReply({
      embeds: [errorEmbed('Format de date invalide. Utilisez : JJ/MM/AAAA HH:MM (ex: 15/04/2026 21:00)')],
    });
    return;
  }

  const [, day, month, year, hour, minute] = dateMatch;
  // Determine the correct Europe/Paris offset (CET +01:00 or CEST +02:00) for this date
  const targetStr = `${year}-${month}-${day}T${hour}:${minute}:00`;
  let scheduledAt: Date = new Date(targetStr + '+01:00'); // fallback: CET
  for (const offset of ['+01:00', '+02:00']) {
    const candidate = new Date(targetStr + offset);
    const check = candidate.toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).replace(' ', 'T');
    if (check.startsWith(targetStr.slice(0, 16))) {
      scheduledAt = candidate;
      break;
    }
  }
  if (isNaN(scheduledAt.getTime())) {
    await interaction.editReply({
      embeds: [errorEmbed('Date invalide. Vérifiez le format : JJ/MM/AAAA HH:MM')],
    });
    return;
  }

  if (scheduledAt.getTime() < Date.now()) {
    await interaction.editReply({
      embeds: [errorEmbed('La date de la sortie doit être dans le futur.')],
    });
    return;
  }

  // Parse duration / max players (format: "120/8" or "120" or "/8")
  let estimatedDuration: number | null = null;
  let maxPlayers: number | null = null;
  if (dureeMaxStr) {
    const parts = dureeMaxStr.split('/');
    if (parts[0]?.trim()) {
      const dur = parseInt(parts[0].trim(), 10);
      if (!isNaN(dur) && dur > 0) estimatedDuration = dur;
    }
    if (parts[1]?.trim()) {
      const max = parseInt(parts[1].trim(), 10);
      if (!isNaN(max) && max > 0) maxPlayers = max;
    }
  }

  // Find the sorties channel
  const guild = await db().discordGuild.findUnique({
    where: { guildId },
  });

  if (!guild?.sortiesChannelId) {
    await interaction.editReply({
      embeds: [errorEmbed('Aucun salon #sorties configuré. Demandez à un admin d\'utiliser `/config channels`.')],
    });
    return;
  }

  const channel = interaction.client.channels.cache.get(guild.sortiesChannelId);
  if (!channel || !(channel instanceof TextChannel)) {
    await interaction.editReply({
      embeds: [errorEmbed('Le salon #sorties configuré est introuvable ou invalide.')],
    });
    return;
  }

  // Create activity in DB
  const activity = await db().activity.create({
    data: {
      guildId,
      createdBy: interaction.user.id,
      title: titre,
      activityType,
      description,
      roleSlots,
      scheduledAt,
      estimatedDuration,
      maxPlayers,
      status: 'published',
    },
  });

  // Create reminders (-24h, -1h, -10min)
  const reminderOffsets = [
    { type: '24h', ms: 24 * 60 * 60 * 1000 },
    { type: '1h', ms: 60 * 60 * 1000 },
    { type: '10min', ms: 10 * 60 * 1000 },
  ];

  const remindersData = reminderOffsets
    .map(({ type, ms }) => ({
      activityId: activity.id,
      type,
      remindAt: new Date(scheduledAt.getTime() - ms),
    }))
    .filter((r) => r.remindAt.getTime() > Date.now());

  if (remindersData.length > 0) {
    await db().activityReminder.createMany({ data: remindersData });
  }

  // Send the card to the sorties channel
  const card = buildActivityEmbed(activity, []);
  const sentMessage = await channel.send({
    embeds: card.embeds,
    components: card.components,
  });

  // Update activity with message reference
  await db().activity.update({
    where: { id: activity.id },
    data: {
      messageId: sentMessage.id,
      channelId: channel.id,
    },
  });

  // Track message mapping
  await db().discordMessageMap.create({
    data: {
      guildId,
      channelId: channel.id,
      messageId: sentMessage.id,
      entityType: 'activity',
      entityId: activity.id,
    },
  });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'activity.create',
    targetType: 'activity',
    targetId: String(activity.id),
    details: { title: titre, type: activityType, scheduledAt: scheduledAt.toISOString() },
  });

  await interaction.editReply({
    embeds: [successEmbed(`Sortie **${titre}** créée ! Publiée dans <#${channel.id}>.`)],
  });
}

async function handleLfgCreerModal(interaction: ModalSubmitInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  await interaction.deferReply({ ephemeral: true });

  // Parse fields
  const joueursStr = interaction.fields.getTextInputValue('joueurs').trim();
  const dureeStr = interaction.fields.getTextInputValue('duree').trim();
  const commentaire = interaction.fields.getTextInputValue('commentaire')?.trim() || null;
  let niveauStr: string | null = null;
  try { niveauStr = interaction.fields.getTextInputValue('niveau')?.trim() || null; } catch { /* field may not exist */ }

  // Extract type from customId (new format: lfg_creer:donjon) or fallback to text field (old format)
  let activityType: string | null = null;
  const customIdParts = interaction.customId.split(':');
  if (customIdParts.length >= 2 && VALID_TYPES.includes(customIdParts[1])) {
    activityType = customIdParts[1];
  } else {
    // Backward compat: try to read from the activite text field
    try {
      const activiteRaw = interaction.fields.getTextInputValue('activite').trim().toLowerCase().replace('\u00EA', 'e');
      activityType = VALID_TYPES.includes(activiteRaw) ? activiteRaw : null;
    } catch { /* field does not exist in new modal */ }
  }
  if (!activityType) {
    await interaction.editReply({
      embeds: [errorEmbed(`Type invalide. Types valides : ${VALID_TYPES.join(', ')}`)],
    });
    return;
  }

  // Validate players
  const playersNeeded = parseInt(joueursStr, 10);
  if (isNaN(playersNeeded) || playersNeeded < 1 || playersNeeded > 50) {
    await interaction.editReply({
      embeds: [errorEmbed('Nombre de joueurs invalide (1-50).')],
    });
    return;
  }

  // Validate duration (0.5-6h)
  const dureeH = parseFloat(dureeStr.replace(',', '.'));
  if (isNaN(dureeH) || dureeH < 0.5 || dureeH > 6) {
    await interaction.editReply({
      embeds: [errorEmbed('Durée invalide. Doit être entre 0.5 et 6 heures.')],
    });
    return;
  }

  // Parse optional min level
  let minLevel: number | null = null;
  if (niveauStr) {
    const parsed = parseInt(niveauStr, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 230) {
      minLevel = parsed;
    }
  }

  const expiresAt = new Date(Date.now() + dureeH * 60 * 60 * 1000);

  // Find the sorties channel
  const guild = await db().discordGuild.findUnique({
    where: { guildId },
  });

  if (!guild?.sortiesChannelId) {
    await interaction.editReply({
      embeds: [errorEmbed('Aucun salon #sorties configuré. Demandez à un admin d\'utiliser `/config channels`.')],
    });
    return;
  }

  const channel = interaction.client.channels.cache.get(guild.sortiesChannelId);
  if (!channel || !(channel instanceof TextChannel)) {
    await interaction.editReply({
      embeds: [errorEmbed('Le salon #sorties configuré est introuvable ou invalide.')],
    });
    return;
  }

  // Create quick call in DB
  const quickCall = await db().quickCall.create({
    data: {
      guildId,
      createdBy: interaction.user.id,
      activityType,
      description: commentaire,
      playersNeeded,
      minLevel,
      expiresAt,
      status: 'open',
    },
  });

  // Send the card
  const card = buildQuickCallEmbed(quickCall, []);
  const sentMessage = await channel.send({
    embeds: card.embeds,
    components: card.components,
  });

  // Update with message reference
  await db().quickCall.update({
    where: { id: quickCall.id },
    data: {
      messageId: sentMessage.id,
      channelId: channel.id,
    },
  });

  // Track message mapping
  await db().discordMessageMap.create({
    data: {
      guildId,
      channelId: channel.id,
      messageId: sentMessage.id,
      entityType: 'quick_call',
      entityId: quickCall.id,
    },
  });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'lfg.create',
    targetType: 'quick_call',
    targetId: String(quickCall.id),
    details: { type: activityType, playersNeeded, expiresAt: expiresAt.toISOString() },
  });

  await interaction.editReply({
    embeds: [successEmbed(`LFG publié dans <#${channel.id}> ! Expire ${`<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`}.`)],
  });
}
