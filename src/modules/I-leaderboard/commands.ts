import { ChatInputCommandInteraction } from 'discord.js';
import { db } from '../../core/database.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed } from '../../views/base.js';
import {
  buildLeaderboardEmbed,
  buildWeeklyRecapEmbed,
  LeaderboardEntry,
  WeeklyRecapData,
} from './views.js';

const log = childLogger('I-leaderboard');

export async function handleClassement(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'activites':
      return handleActivites(interaction);
    case 'crafts':
      return handleCrafts(interaction);
    case 'recompenses':
      return handleRecompenses(interaction);
    case 'resume':
      return handleResume(interaction);
    default:
      log.warn({ sub }, 'Unknown /classement subcommand');
  }
}

// ────────────────── /classement activites ──────────────────

async function handleActivites(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const periode = interaction.options.getString('periode') || 'mois';
  const since = getPeriodDate(periode);

  const signups = await db().activitySignup.findMany({
    where: {
      status: 'confirmed',
      activity: { guildId, scheduledAt: { gte: since } },
    },
    select: { userId: true },
  });

  const counts = countBy(signups, (s) => s.userId);
  const entries: LeaderboardEntry[] = toSortedEntries(counts);

  const embed = buildLeaderboardEmbed(
    'Participations aux sorties',
    entries,
    periode,
    'participations',
  );
  await interaction.editReply({ embeds: [embed] });
}

// ────────────────── /classement crafts ──────────────────

async function handleCrafts(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const periode = interaction.options.getString('periode') || 'mois';
  const since = getPeriodDate(periode);

  const crafts = await db().craftRequest.findMany({
    where: {
      guildId,
      status: 'completed',
      updatedAt: { gte: since },
      crafterId: { not: null },
    },
    select: { crafterId: true },
  });

  const counts = countBy(crafts, (c) => c.crafterId!);
  const entries: LeaderboardEntry[] = toSortedEntries(counts);

  const embed = buildLeaderboardEmbed(
    'Crafts complétés',
    entries,
    periode,
    'crafts',
  );
  await interaction.editReply({ embeds: [embed] });
}

// ────────────────── /classement recompenses ──────────────────

async function handleRecompenses(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const periode = interaction.options.getString('periode') || 'mois';
  const since = getPeriodDate(periode);

  const rewards = await db().reward.findMany({
    where: {
      guildId,
      status: { in: ['claimed', 'paid'] },
      createdAt: { gte: since },
    },
    select: { recipientId: true },
  });

  const counts = countBy(rewards, (r) => r.recipientId);
  const entries: LeaderboardEntry[] = toSortedEntries(counts);

  const embed = buildLeaderboardEmbed(
    'Récompenses reçues',
    entries,
    periode,
    'récompenses',
  );
  await interaction.editReply({ embeds: [embed] });
}

// ────────────────── /classement resume ──────────────────

async function handleResume(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const data = await buildRecapData(guildId, 7);
  const embed = buildWeeklyRecapEmbed(data);
  await interaction.editReply({ embeds: [embed] });
}

// ────────────────── Shared helpers ──────────────────

export async function buildRecapData(guildId: string, days: number): Promise<WeeklyRecapData> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [activities, crafts, rewards, newMembers, upcoming] = await Promise.all([
    db().activitySignup.findMany({
      where: { status: 'confirmed', activity: { guildId, scheduledAt: { gte: since } } },
      select: { userId: true, activityId: true },
    }),
    db().craftRequest.count({
      where: { guildId, status: 'completed', updatedAt: { gte: since } },
    }),
    db().reward.count({
      where: { guildId, status: { in: ['claimed', 'paid'] }, createdAt: { gte: since } },
    }),
    db().playerProfile.count({
      where: { guildId, status: 'approved', approvedAt: { gte: since } },
    }),
    db().activity.findFirst({
      where: { guildId, status: 'published', scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: 'asc' },
      select: { title: true, scheduledAt: true },
    }),
  ]);

  const uniqueActivityIds = new Set(activities.map((a) => a.activityId));
  const uniqueParticipants = new Set(activities.map((a) => a.userId));

  // MVP: most active participant
  const participationCounts = countBy(activities, (a) => a.userId);
  const mvpEntry = Object.entries(participationCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    totalActivities: uniqueActivityIds.size,
    totalParticipants: uniqueParticipants.size,
    totalCrafts: crafts,
    totalRewards: rewards,
    newMembers,
    mvpUserId: mvpEntry ? mvpEntry[0] : null,
    mvpCount: mvpEntry ? mvpEntry[1] : 0,
    nextActivity: upcoming ? { title: upcoming.title, scheduledAt: upcoming.scheduledAt } : null,
  };
}

function getPeriodDate(periode: string): Date {
  const now = new Date();
  switch (periode) {
    case 'semaine':
      now.setDate(now.getDate() - 7);
      break;
    case 'trimestre':
      now.setMonth(now.getMonth() - 3);
      break;
    case 'tout':
      now.setFullYear(2020);
      break;
    case 'mois':
    default:
      now.setMonth(now.getMonth() - 1);
      break;
  }
  return now;
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function toSortedEntries(counts: Record<string, number>): LeaderboardEntry[] {
  return Object.entries(counts)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}
