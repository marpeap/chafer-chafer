/**
 * @module services/reward
 * @description Reward lifecycle: creation, claiming, disputes, payment, cancellation.
 *
 * Each reward follows a state machine:
 *   claimable → claimed → paid
 *   claimable → disputed
 *   claimable → cancelled
 *
 * Every state transition creates a ledger entry for auditability.
 *
 * Used by:
 *   - F-rewards/modals.ts (create)
 *   - F-rewards/buttons.ts (claim, dispute)
 *   - F-rewards/commands.ts (pay, cancel)
 *   - B-activities/buttons.ts (release rewards for activity participants)
 *
 * Depends on: core/database, core/audit
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
 * Create a new reward and its initial ledger entry.
 *
 * Does NOT handle Discord message posting — that stays in the handler
 * because it needs the interaction/channel context.
 *
 * Called by: F-rewards/modals.ts → handleRewardModal
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
 * Transition a reward to a new status with validation and ledger tracking.
 *
 * @param validFromStatuses - Which statuses allow this transition
 * @param newStatus - Target status
 * @param auditAction - Action name for the audit log
 * @param extraData - Additional fields to set on the reward (e.g. claimedAt, paidAt)
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
 * Claim a reward — only the recipient can claim.
 *
 * State: claimable → claimed
 *
 * Called by: F-rewards/buttons.ts → handleClaim
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
 * Dispute a reward — only the recipient can dispute.
 *
 * State: claimable → disputed
 *
 * Called by: F-rewards/buttons.ts → handleDispute
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
 * Mark a reward as paid — officers/admins only (permission check is in handler).
 *
 * State: claimed → paid
 *
 * Called by: F-rewards/commands.ts → handlePayer
 */
export async function payReward(guildId: string, rewardId: number, paidBy: string): Promise<TransitionResult> {
  return transitionReward(guildId, rewardId, paidBy, ['claimed'], 'paid', 'reward.paid', { paidAt: new Date() });
}

/**
 * Cancel a reward — officers/admins only (permission check is in handler).
 *
 * State: pending|claimable → cancelled
 *
 * Called by: F-rewards/commands.ts → handleAnnuler
 */
export async function cancelReward(guildId: string, rewardId: number, cancelledBy: string): Promise<TransitionResult> {
  return transitionReward(guildId, rewardId, cancelledBy, ['pending', 'claimable'], 'cancelled', 'reward.cancelled');
}

/**
 * Save the Discord message reference on a reward (for future embed updates).
 *
 * Called by: F-rewards/modals.ts after posting the reward card
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
