/**
 * @module services/member
 * @description Cycle de vie des membres : approbation, refus, statistiques profil, toggle glandeur.
 *
 * Encapsule toute la logique metier de gestion des membres — les handlers ne font
 * que parser les interactions Discord et appeler ces fonctions avec des donnees brutes.
 *
 * Utilise par : A-members/buttons.ts (approve, reject, glandeur, profil stats)
 * Depend de : core/database, core/audit
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
 * Recupere les statistiques agregees du profil d'un membre : participations aux activites,
 * crafts demandes/realises, recompenses recues.
 *
 * Appele par : A-members/buttons.ts → handleProfile
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
 * Approuve un profil membre en attente.
 *
 * Flux : valider le statut → maj DB → recuperer la config guilde pour le role → log audit
 * Ne gere PAS les actions Discord (attribution de role, DM, maj du message)
 * — celles-ci restent dans le handler car elles necessitent l'objet interaction.
 *
 * Appele par : A-members/buttons.ts → handleApprove
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
 * Refuse un profil membre en attente.
 *
 * Flux : valider le statut → maj DB → log audit
 *
 * Appele par : A-members/buttons.ts → handleReject
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
 * Bascule le statut "Glandeur Dispo" d'un membre.
 *
 * Quand active : le membre est visible comme disponible pour les crafts, activites et LFG.
 * Synchronise 3 tables : playerProfile.globalAvailable, crafterAvailability, professionProfile.
 *
 * Appele par : A-members/buttons.ts → handleGlandeurDispo
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

  // Synchronise les 3 sources de disponibilite
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
