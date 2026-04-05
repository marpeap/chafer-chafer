/**
 * @module services/reward
 * @description Cycle de vie des recompenses : creation, reclamation, contestation, paiement, annulation.
 *
 * Chaque recompense suit une machine a etats :
 *   claimable → claimed → paid
 *   claimable → disputed
 *   claimable → cancelled
 *
 * Chaque transition d'etat cree une entree dans le ledger pour la tracabilite.
 *
 * Utilise par :
 *   - F-rewards/modals.ts (creation)
 *   - F-rewards/buttons.ts (reclamation, contestation)
 *   - F-rewards/commands.ts (paiement, annulation)
 *   - B-activities/buttons.ts (distribution des recompenses aux participants)
 *
 * Depend de : core/database, core/audit
 */

import { db } from '../core/database.js';
import { audit } from '../core/audit.js';
import type { Reward } from '@prisma/client';

// ────────────────── Types ──────────────────

export interface CreateRewardParams {
  guildId: string;
  createdBy: string;
  recipientId: string;
  title: string;
  amount: string | null;
  reason: string | null;
}

export interface CreateRewardResult {
  success: boolean;
  reward?: Reward;
  error?: string;
}

export interface TransitionResult {
  success: boolean;
  reward?: Reward;
  error?: string;
}

// ────────────────── Create ──────────────────

/**
 * Cree une nouvelle recompense et son entree initiale dans le ledger.
 *
 * Ne gere PAS l'envoi du message Discord — cela reste dans le handler
 * car il a besoin du contexte interaction/channel.
 *
 * Appele par : F-rewards/modals.ts → handleRewardModal
 */
export async function createReward(params: CreateRewardParams): Promise<CreateRewardResult> {
  const reward = await db().reward.create({
    data: {
      guildId: params.guildId,
      createdBy: params.createdBy,
      recipientId: params.recipientId,
      title: params.title,
      amount: params.amount,
      reason: params.reason,
      status: 'claimable',
    },
  });

  await db().ledgerEntry.create({
    data: {
      guildId: params.guildId,
      rewardId: reward.id,
      actorId: params.createdBy,
      action: 'created',
      fromStatus: null,
      toStatus: 'claimable',
    },
  });

  await audit({
    guildId: params.guildId,
    actorId: params.createdBy,
    action: 'reward.created',
    targetType: 'reward',
    targetId: String(reward.id),
    details: { title: params.title, recipientId: params.recipientId, amount: params.amount, reason: params.reason },
  });

  return { success: true, reward };
}

// ────────────────── State Transitions ──────────────────

/**
 * Fait transiter une recompense vers un nouveau statut avec validation et suivi ledger.
 *
 * @param validFromStatuses - Statuts autorisant cette transition
 * @param newStatus - Statut cible
 * @param auditAction - Nom de l'action pour le log d'audit
 * @param extraData - Champs supplementaires a mettre a jour (ex : claimedAt, paidAt)
 */
async function transitionReward(
  guildId: string,
  rewardId: number,
  actorId: string,
  validFromStatuses: string[],
  newStatus: string,
  auditAction: string,
  extraData?: Record<string, unknown>,
): Promise<TransitionResult> {
  const reward = await db().reward.findFirst({ where: { id: rewardId, guildId } });

  if (!reward) return { success: false, error: 'Recompense introuvable.' };
  if (!validFromStatuses.includes(reward.status)) {
    return { success: false, error: `Cette recompense ne peut pas passer en "${newStatus}" (statut actuel : ${reward.status}).` };
  }

  const previousStatus = reward.status;

  const updated = await db().reward.update({
    where: { id: rewardId },
    data: { status: newStatus, ...extraData },
  });

  await db().ledgerEntry.create({
    data: {
      guildId,
      rewardId: reward.id,
      actorId,
      action: newStatus,
      fromStatus: previousStatus,
      toStatus: newStatus,
    },
  });

  await audit({
    guildId,
    actorId,
    action: auditAction,
    targetType: 'reward',
    targetId: String(rewardId),
    details: { title: reward.title, amount: reward.amount, recipientId: reward.recipientId },
  });

  return { success: true, reward: updated };
}

/**
 * Reclamer une recompense — seul le destinataire peut reclamer.
 *
 * Etat : claimable → claimed
 *
 * Appele par : F-rewards/buttons.ts → handleClaim
 */
export async function claimReward(guildId: string, rewardId: number, userId: string): Promise<TransitionResult> {
  const reward = await db().reward.findFirst({ where: { id: rewardId, guildId } });
  if (!reward) return { success: false, error: 'Recompense introuvable.' };
  if (reward.recipientId !== userId) {
    return { success: false, error: 'Seul le destinataire peut reclamer cette recompense.' };
  }

  const result = await transitionReward(guildId, rewardId, userId, ['claimable'], 'claimed', 'reward.claimed', { claimedAt: new Date() });

  if (result.success) {
    await db().rewardClaim.create({
      data: { rewardId, userId, action: 'claim' },
    });
  }

  return result;
}

/**
 * Contester une recompense — seul le destinataire peut contester.
 *
 * Etat : claimable → disputed
 *
 * Appele par : F-rewards/buttons.ts → handleDispute
 */
export async function disputeReward(guildId: string, rewardId: number, userId: string): Promise<TransitionResult> {
  const reward = await db().reward.findFirst({ where: { id: rewardId, guildId } });
  if (!reward) return { success: false, error: 'Recompense introuvable.' };
  if (reward.recipientId !== userId) {
    return { success: false, error: 'Seul le destinataire peut contester cette recompense.' };
  }

  const result = await transitionReward(guildId, rewardId, userId, ['claimable'], 'disputed', 'reward.disputed');

  if (result.success) {
    await db().rewardClaim.create({
      data: { rewardId, userId, action: 'dispute' },
    });
  }

  return result;
}

/**
 * Marquer une recompense comme payee — officiers/admins uniquement (verification des permissions dans le handler).
 *
 * Etat : claimed → paid
 *
 * Appele par : F-rewards/commands.ts → handlePayer
 */
export async function payReward(guildId: string, rewardId: number, paidBy: string): Promise<TransitionResult> {
  return transitionReward(guildId, rewardId, paidBy, ['claimed'], 'paid', 'reward.paid', { paidAt: new Date() });
}

/**
 * Annuler une recompense — officiers/admins uniquement (verification des permissions dans le handler).
 *
 * Etat : pending|claimable → cancelled
 *
 * Appele par : F-rewards/commands.ts → handleAnnuler
 */
export async function cancelReward(guildId: string, rewardId: number, cancelledBy: string): Promise<TransitionResult> {
  return transitionReward(guildId, rewardId, cancelledBy, ['pending', 'claimable'], 'cancelled', 'reward.cancelled');
}

/**
 * Sauvegarde la reference du message Discord sur une recompense (pour les futures mises a jour de l'embed).
 *
 * Appele par : F-rewards/modals.ts apres l'envoi de la carte recompense
 */
export async function saveRewardMessageRef(
  guildId: string,
  rewardId: number,
  channelId: string,
  messageId: string,
): Promise<void> {
  await db().reward.update({
    where: { id: rewardId },
    data: { messageId, channelId },
  });

  await db().discordMessageMap.create({
    data: { guildId, channelId, messageId, entityType: 'reward', entityId: rewardId },
  });
}
