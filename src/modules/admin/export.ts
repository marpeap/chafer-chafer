import { ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { infoEmbed } from '../../views/base.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('export');

/** BOM for proper UTF-8 detection in Excel (French locale) */
const BOM = '\uFEFF';
const SEP = ';';

/** Escape a CSV field: wrap in quotes if it contains separator, quotes, or newlines */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(SEP) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields: unknown[]): string {
  return fields.map(csvField).join(SEP);
}

function formatDateFR(date: Date): string {
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
}

// ────────────────── Router ──────────────────

export async function handleExport(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'membres': return exportMembres(interaction);
    case 'activites': return exportActivites(interaction);
    case 'recompenses': return exportRecompenses(interaction);
    case 'audit': return exportAudit(interaction);
    default:
      log.warn({ sub }, 'Unknown export subcommand');
  }
}

// ────────────────── /export membres ──────────────────

async function exportMembres(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;

  const members = await db().playerProfile.findMany({
    where: { guildId, status: 'approved' },
    orderBy: { createdAt: 'asc' },
  });

  if (members.length === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Export membres', 'Aucun membre approuve a exporter.')],
      ephemeral: true,
    });
    return;
  }

  const header = csvRow([
    'ID', 'Discord ID', 'Pseudo', 'Classe', 'Niveau', 'Orientation',
    'Metiers 200', 'Statut Dispo', 'Date inscription',
  ]);

  const rows = members.map((m) =>
    csvRow([
      m.id,
      m.userId,
      m.characterName,
      m.characterClass,
      m.characterLevel,
      m.orientation,
      m.professions200,
      m.globalAvailable ? 'Oui' : 'Non',
      formatDateFR(m.createdAt),
    ]),
  );

  const csv = BOM + [header, ...rows].join('\n');
  const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), { name: 'membres.csv' });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'export.membres',
    details: { count: members.length },
  });

  await interaction.reply({ files: [attachment], ephemeral: true });
}

// ────────────────── /export activites ──────────────────

async function exportActivites(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const activities = await db().activity.findMany({
    where: {
      guildId,
      createdAt: { gte: thirtyDaysAgo },
    },
    include: { signups: true },
    orderBy: { scheduledAt: 'desc' },
  });

  if (activities.length === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Export activites', 'Aucune activite dans les 30 derniers jours.')],
      ephemeral: true,
    });
    return;
  }

  const header = csvRow([
    'ID', 'Type', 'Titre', 'Createur', 'Date', 'Duree',
    'Max joueurs', 'Statut', 'Inscrits',
  ]);

  const rows = activities.map((a) =>
    csvRow([
      a.id,
      a.activityType,
      a.title,
      a.createdBy,
      formatDateFR(a.scheduledAt),
      a.estimatedDuration ? `${a.estimatedDuration}min` : '',
      a.maxPlayers,
      a.status,
      a.signups.filter((s) => s.status === 'confirmed').length,
    ]),
  );

  const csv = BOM + [header, ...rows].join('\n');
  const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), { name: 'activites.csv' });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'export.activites',
    details: { count: activities.length },
  });

  await interaction.reply({ files: [attachment], ephemeral: true });
}

// ────────────────── /export recompenses ──────────────────

async function exportRecompenses(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;

  const rewards = await db().reward.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
  });

  if (rewards.length === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Export recompenses', 'Aucune recompense a exporter.')],
      ephemeral: true,
    });
    return;
  }

  const header = csvRow([
    'ID', 'Titre', 'Montant', 'Beneficiaire', 'Createur',
    'Statut', 'Date creation', 'Date paiement',
  ]);

  const rows = rewards.map((r) =>
    csvRow([
      r.id,
      r.title,
      r.amount,
      r.recipientId,
      r.createdBy,
      r.status,
      formatDateFR(r.createdAt),
      r.paidAt ? formatDateFR(r.paidAt) : '',
    ]),
  );

  const csv = BOM + [header, ...rows].join('\n');
  const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), { name: 'recompenses.csv' });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'export.recompenses',
    details: { count: rewards.length },
  });

  await interaction.reply({ files: [attachment], ephemeral: true });
}

// ────────────────── /export audit ──────────────────

async function exportAudit(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const logs = await db().auditLog.findMany({
    where: {
      guildId,
      createdAt: { gte: sevenDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (logs.length === 0) {
    await interaction.reply({
      embeds: [infoEmbed('Export audit', 'Aucune entree d\'audit dans les 7 derniers jours.')],
      ephemeral: true,
    });
    return;
  }

  const header = csvRow([
    'ID', 'Action', 'Acteur', 'Type cible', 'ID cible', 'Date',
  ]);

  const rows = logs.map((l) =>
    csvRow([
      l.id,
      l.action,
      l.actorId,
      l.targetType,
      l.targetId,
      formatDateFR(l.createdAt),
    ]),
  );

  const csv = BOM + [header, ...rows].join('\n');
  const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), { name: 'audit.csv' });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'export.audit',
    details: { count: logs.length },
  });

  await interaction.reply({ files: [attachment], ephemeral: true });
}
