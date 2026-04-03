import { ModalSubmitInteraction, TextChannel } from 'discord.js';
import { Prisma } from '@prisma/client';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { childLogger } from '../../core/logger.js';
import { buildMatchFoundEmbed, buildSearchQueueEmbed, buildQuickCallEmbed } from './views.js';

const log = childLogger('activities:matching');

interface MatchParams {
  guildId: string;
  userId: string;
  activityType: string;
  playersNeeded: number;
  minLevel: number | null;
  comment: string | null;
  expiresAt: Date;
  channel: TextChannel;
  interaction: ModalSubmitInteraction;
}

export async function findOrCreateMatch(params: MatchParams): Promise<void> {
  const {
    guildId,
    userId,
    activityType,
    playersNeeded,
    minLevel,
    comment,
    expiresAt,
    channel,
    interaction,
  } = params;

  const now = new Date();

  try {
    // Use a transaction to avoid race conditions
    const result = await db().$transaction(async (tx) => {
      // Check if user already has an active search for this guild + activityType
      const existingUserSearch = await tx.searchQueue.findFirst({
        where: {
          guildId,
          userId,
          activityType,
          matched: false,
          expiresAt: { gt: now },
        },
      });

      if (existingUserSearch) {
        return { type: 'duplicate' as const };
      }

      // 1. Find existing unmatched searches for same guild + activityType
      const existingSearches = await tx.searchQueue.findMany({
        where: {
          guildId,
          activityType,
          matched: false,
          expiresAt: { gt: now },
          userId: { not: userId }, // exclude the current user
        },
      });

      // 2. Find "Glandeur Dispo" players (globalAvailable = true) who are NOT the current user
      //    and NOT already in an active search for this guild
      const glandeurs = await tx.playerProfile.findMany({
        where: {
          guildId,
          globalAvailable: true,
          status: 'approved',
          userId: { not: userId },
        },
      });

      // Filter out glandeurs who already have an active search entry (any type)
      const activeSearchUserIds = new Set(
        (await tx.searchQueue.findMany({
          where: {
            guildId,
            matched: false,
            expiresAt: { gt: now },
          },
          select: { userId: true },
        })).map((s) => s.userId),
      );

      const eligibleGlandeurs = glandeurs.filter(
        (g) => !activeSearchUserIds.has(g.userId),
      );

      // 3. Combine all candidates (existing searchers + eligible glandeurs + current user)
      const candidateUserIds = new Set<string>();
      candidateUserIds.add(userId); // current user always included

      for (const search of existingSearches) {
        candidateUserIds.add(search.userId);
      }
      for (const glandeur of eligibleGlandeurs) {
        candidateUserIds.add(glandeur.userId);
      }

      const totalCandidates = candidateUserIds.size;

      if (totalCandidates >= playersNeeded) {
        // MATCH FOUND — create a QuickCall with all matched players

        // Pick exactly playersNeeded candidates: prioritize existing searchers, then glandeurs, then current user
        const matchedUserIds: string[] = [userId]; // always include current user
        for (const search of existingSearches) {
          if (matchedUserIds.length >= playersNeeded) break;
          if (!matchedUserIds.includes(search.userId)) {
            matchedUserIds.push(search.userId);
          }
        }
        for (const glandeur of eligibleGlandeurs) {
          if (matchedUserIds.length >= playersNeeded) break;
          if (!matchedUserIds.includes(glandeur.userId)) {
            matchedUserIds.push(glandeur.userId);
          }
        }

        // Create the QuickCall
        const quickCall = await tx.quickCall.create({
          data: {
            guildId,
            createdBy: userId,
            activityType,
            description: comment,
            playersNeeded,
            minLevel,
            expiresAt,
            status: matchedUserIds.length >= playersNeeded ? 'filled' : 'open',
          },
        });

        // Register all matched players as "partant" responses
        for (const matchedUserId of matchedUserIds) {
          await tx.quickCallResponse.create({
            data: {
              quickCallId: quickCall.id,
              userId: matchedUserId,
              status: matchedUserId === userId ? 'lead' : 'partant',
            },
          });
        }

        // Mark existing SearchQueue entries as matched
        const matchedSearchIds = existingSearches
          .filter((s) => matchedUserIds.includes(s.userId))
          .map((s) => s.id);

        if (matchedSearchIds.length > 0) {
          await tx.searchQueue.updateMany({
            where: { id: { in: matchedSearchIds } },
            data: { matched: true, quickCallId: quickCall.id },
          });
        }

        return {
          type: 'matched' as const,
          quickCall,
          matchedUserIds,
          existingSearchCount: existingSearches.length,
        };
      } else {
        // NOT ENOUGH PLAYERS — create a search entry
        const searchEntry = await tx.searchQueue.create({
          data: {
            guildId,
            userId,
            activityType,
            minLevel,
            message: comment,
            expiresAt,
            matched: false,
          },
        });

        return {
          type: 'queued' as const,
          searchEntry,
          otherSearchers: existingSearches.length,
          existingSearches,
        };
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Handle duplicate search early return
    if (result.type === 'duplicate') {
      await interaction.editReply({
        content: 'Tu as deja une recherche en cours pour ce type.',
      });
      return;
    }

    // Outside the transaction: send Discord messages
    if (result.type === 'matched') {
      const { quickCall, matchedUserIds } = result;

      try {
        // Build and send the match found notification
        const mentions = matchedUserIds.map((id) => `<@${id}>`).join(' ');
        const matchEmbed = buildMatchFoundEmbed(activityType, matchedUserIds);

        await channel.send({
          content: `${mentions} Un groupe **${activityType}** a été trouvé !`,
          embeds: [matchEmbed],
        });

        // Send the QuickCall embed
        const responses = matchedUserIds.map((uid) => ({
          userId: uid,
          status: uid === userId ? 'lead' : 'partant',
        }));
        const card = buildQuickCallEmbed(quickCall, responses);
        const sentMessage = await channel.send({
          embeds: card.embeds,
          components: card.components,
        });

        // Update QuickCall with message reference
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
          actorId: userId,
          action: 'lfg.match',
          targetType: 'quick_call',
          targetId: String(quickCall.id),
          details: {
            type: activityType,
            playersNeeded,
            matchedPlayers: matchedUserIds.length,
          },
        });

        await interaction.editReply({
          embeds: [matchEmbed],
        });

        log.info(
          { guildId, quickCallId: quickCall.id, matchedCount: matchedUserIds.length },
          'LFG match found',
        );
      } catch (sendErr) {
        // Transaction succeeded but Discord message failed — do NOT re-throw
        log.error({ err: sendErr, guildId, quickCallId: quickCall.id }, 'Match found but failed to send Discord message');
        try {
          await interaction.editReply({
            content: 'Un groupe a ete cree mais l\'envoi du message dans le salon a echoue. Contactez un officier.',
          });
        } catch { /* interaction may have expired */ }
      }
    } else {
      // Queued — send search embed
      const { searchEntry, otherSearchers, existingSearches } = result;

      const searchEmbed = buildSearchQueueEmbed(activityType, otherSearchers, expiresAt, searchEntry.id);
      const sentMessage = await channel.send({
        embeds: [searchEmbed.embeds[0]],
        components: searchEmbed.components,
      });

      // If there are other searchers, notify them that someone new joined
      if (existingSearches.length > 0) {
        const existingMentions = existingSearches.map((s) => `<@${s.userId}>`).join(' ');
        await channel.send({
          content: `${existingMentions} Un joueur de plus cherche un groupe **${activityType}** ! (${existingSearches.length + 1} en recherche)`,
        });
      }

      await audit({
        guildId,
        actorId: userId,
        action: 'lfg.search',
        targetType: 'search_queue',
        targetId: String(searchEntry.id),
        details: { type: activityType, otherSearchers },
      });

      await interaction.editReply({
        embeds: [searchEmbed.embeds[0]],
        components: searchEmbed.components,
      });

      log.info(
        { guildId, searchId: searchEntry.id, otherSearchers },
        'LFG search queued',
      );
    }
  } catch (err) {
    log.error({ err, guildId, userId, activityType }, 'Matching failed');
    throw err; // re-throw so the caller can fallback
  }
}
