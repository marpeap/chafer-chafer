/**
 * @module services/member
 * @description Member lifecycle: approval, rejection, profile stats, glandeur toggle.
 *
 * Encapsulates all business logic for member management — handlers only parse
 * Discord interactions and call these functions with plain data.
 *
 * Used by: A-members/buttons.ts (approve, reject, glandeur, profile stats)
 * Depends on: core/database, core/audit
 */

import { db } from '../core/database.js';
import { audit } from '../core/audit.js';
import { childLogger } from '../core/logger.js';

const log = childLogger('services:member');

// ────────────────── Types ──────────────────

export interface ProfileStats {
  activityCount: number;
  quickCallCount: number;
  craftsMade: number;
  craftsFulfilled: number;
  rewardsPaid: number;
}

export interface ApproveResult {
  success: boolean;
  error?: string;
  memberRoleId?: string | null;
}

export interface RejectResult {
  success: boolean;
  error?: string;
}

export interface GlandeurToggleResult {
  success: boolean;
  error?: string;
  newAvailable?: boolean;
}

// ────────────────── Profile Stats ──────────────────

/**
 * Fetch aggregated stats for a member's profile: activity participation,
 * crafts made/fulfilled, rewards received.
 *
 * Called by: A-members/buttons.ts → handleProfile
 */
export async function getProfileStats(guildId: string, userId: string): Promise<ProfileStats> {
  const [activityCount, quickCallCount, craftsMade, craftsFulfilled, rewardsPaid] = await Promise.all([
    db().activitySignup.count({ where: { userId, activity: { guildId } } }),
    db().quickCallResponse.count({ where: { userId, quickCall: { guildId } } }),
    db().craftRequest.count({ where: { guildId, requesterId: userId } }),
    db().craftRequest.count({ where: { guildId, crafterId: userId } }),
    db().reward.count({ where: { guildId, recipientId: userId, status: 'paid' } }),
  ]);

  return { activityCount, quickCallCount, craftsMade, craftsFulfilled, rewardsPaid };
}

// ────────────────── Approve ──────────────────

/**
 * Approve a pending member profile.
 *
 * Flow: validate status → update DB → fetch guild config for role → audit log
 * Does NOT handle Discord-specific actions (role assignment, DM, message update)
 * — those stay in the handler because they need the interaction object.
 *
 * Called by: A-members/buttons.ts → handleApprove
 */
export async function approveMember(
  guildId: string,
  profileId: number,
  approvedBy: string,
): Promise<ApproveResult> {
  const profile = await db().playerProfile.findFirst({
    where: { id: profileId, guildId },
  });

  if (!profile) return { success: false, error: 'Profil introuvable.' };
  if (profile.status === 'approved') return { success: false, error: 'Ce profil est déjà validé.' };

  await db().playerProfile.update({
    where: { id: profileId },
    data: { status: 'approved', approvedBy, approvedAt: new Date() },
  });

  const guildConfig = await db().discordGuild.findUnique({ where: { guildId } });

  await audit({
    guildId,
    actorId: approvedBy,
    action: 'member.approved',
    targetType: 'player_profile',
    targetId: String(profileId),
    details: { userId: profile.userId },
  });

  return {
    success: true,
    memberRoleId: guildConfig?.memberRoleId ?? null,
  };
}

// ────────────────── Reject ──────────────────

/**
 * Reject a pending member profile.
 *
 * Flow: validate status → update DB → audit log
 *
 * Called by: A-members/buttons.ts → handleReject
 */
export async function rejectMember(
  guildId: string,
  profileId: number,
  rejectedBy: string,
): Promise<RejectResult> {
  const profile = await db().playerProfile.findFirst({
    where: { id: profileId, guildId },
  });

  if (!profile) return { success: false, error: 'Profil introuvable.' };
  if (profile.status === 'rejected') return { success: false, error: 'Ce profil est déjà refusé.' };

  await db().playerProfile.update({
    where: { id: profileId },
    data: { status: 'rejected' },
  });

  await audit({
    guildId,
    actorId: rejectedBy,
    action: 'member.rejected',
    targetType: 'player_profile',
    targetId: String(profileId),
    details: { userId: profile.userId },
  });

  return { success: true };
}

// ────────────────── Glandeur Toggle ──────────────────

/**
 * Toggle "Glandeur Dispo" status for a member.
 *
 * When toggled ON: member is visible as available for crafts, activities, and LFG.
 * Syncs 3 tables: playerProfile.globalAvailable, crafterAvailability, professionProfile.
 *
 * Called by: A-members/buttons.ts → handleGlandeurDispo
 */
export async function toggleGlandeurDispo(
  guildId: string,
  userId: string,
): Promise<GlandeurToggleResult> {
  const profile = await db().playerProfile.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  if (!profile) return { success: false, error: 'Tu dois d\'abord devenir Chafer !' };
  if (profile.status !== 'approved') {
    return { success: false, error: 'Ton profil doit être validé pour utiliser cette fonctionnalité.' };
  }

  const newAvailable = !profile.globalAvailable;

  // Sync all 3 availability sources
  await db().playerProfile.update({
    where: { id: profile.id },
    data: { globalAvailable: newAvailable },
  });

  await db().crafterAvailability.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId, available: newAvailable },
    update: { available: newAvailable },
  });

  await db().professionProfile.updateMany({
    where: { guildId, userId },
    data: { available: newAvailable },
  });

  return { success: true, newAvailable };
}
