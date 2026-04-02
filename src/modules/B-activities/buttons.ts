import { ButtonInteraction, TextChannel } from 'discord.js';
import { db } from '../../core/database.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed } from '../../views/base.js';
import { buildActivityEmbed, buildQuickCallEmbed } from './views.js';

const log = childLogger('activities:buttons');

export async function handleActivityButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

  if (customId.startsWith('activity:')) {
    return handleActivitySignup(interaction);
  }
  if (customId.startsWith('lfg:')) {
    return handleLfgResponse(interaction);
  }

  log.warn({ customId }, 'Unknown activity button');
}

async function handleActivitySignup(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  // Format: activity:<action>:<id>
  if (parts.length !== 3) return;

  const action = parts[1]; // join, maybe, unavailable
  const activityId = parseInt(parts[2], 10);
  if (isNaN(activityId)) return;

  await interaction.deferUpdate();

  const activity = await db().activity.findUnique({
    where: { id: activityId },
    include: { signups: true },
  });

  if (!activity) {
    await interaction.followUp({ embeds: [errorEmbed('Sortie introuvable.')], ephemeral: true });
    return;
  }

  if (activity.status === 'cancelled' || activity.status === 'closed') {
    await interaction.followUp({ embeds: [errorEmbed('Cette sortie est terminée.')], ephemeral: true });
    return;
  }

  // Map button action to signup status
  const statusMap: Record<string, string> = {
    join: 'confirmed',
    maybe: 'maybe',
    unavailable: 'unavailable',
  };
  const signupStatus = statusMap[action];
  if (!signupStatus) return;

  // Check if user already has this status (toggle off)
  const existing = activity.signups.find((s) => s.userId === interaction.user.id);
  if (existing && existing.status === signupStatus) {
    // Remove signup (toggle)
    await db().activitySignup.delete({ where: { id: existing.id } });
  } else {
    // Upsert signup
    await db().activitySignup.upsert({
      where: {
        activityId_userId: {
          activityId,
          userId: interaction.user.id,
        },
      },
      create: {
        activityId,
        userId: interaction.user.id,
        status: signupStatus,
      },
      update: {
        status: signupStatus,
      },
    });
  }

  // Refresh and update embed
  const updated = await db().activity.findUnique({
    where: { id: activityId },
    include: { signups: true },
  });

  if (updated) {
    const card = buildActivityEmbed(updated, updated.signups);
    try {
      await interaction.editReply({ embeds: card.embeds, components: card.components });
    } catch (err) {
      log.warn({ err, activityId }, 'Failed to update activity embed');
    }
  }
}

async function handleLfgResponse(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  // Format: lfg:<action>:<id>
  if (parts.length !== 3) return;

  const action = parts[1]; // partant, lead, pass
  const quickCallId = parseInt(parts[2], 10);
  if (isNaN(quickCallId)) return;

  await interaction.deferUpdate();

  const quickCall = await db().quickCall.findUnique({
    where: { id: quickCallId },
    include: { responses: true },
  });

  if (!quickCall) {
    await interaction.followUp({ embeds: [errorEmbed('LFG introuvable.')], ephemeral: true });
    return;
  }

  if (quickCall.status !== 'open') {
    await interaction.followUp({ embeds: [errorEmbed('Ce LFG n\'est plus actif.')], ephemeral: true });
    return;
  }

  // Map button action to response status
  const statusMap: Record<string, string> = {
    partant: 'partant',
    lead: 'lead',
    pass: 'pas_ce_soir',
  };
  const responseStatus = statusMap[action];
  if (!responseStatus) return;

  // Check if user already has this status (toggle off)
  const existing = quickCall.responses.find((r) => r.userId === interaction.user.id);
  if (existing && existing.status === responseStatus) {
    // Remove response (toggle)
    await db().quickCallResponse.delete({ where: { id: existing.id } });
  } else {
    // Upsert response
    await db().quickCallResponse.upsert({
      where: {
        quickCallId_userId: {
          quickCallId,
          userId: interaction.user.id,
        },
      },
      create: {
        quickCallId,
        userId: interaction.user.id,
        status: responseStatus,
      },
      update: {
        status: responseStatus,
      },
    });
  }

  // Check if LFG is now filled
  const updatedCall = await db().quickCall.findUnique({
    where: { id: quickCallId },
    include: { responses: true },
  });

  if (updatedCall) {
    const activeResponders = updatedCall.responses.filter(
      (r) => r.status === 'partant' || r.status === 'lead',
    ).length;

    // Auto-fill if enough players
    if (activeResponders >= updatedCall.playersNeeded && updatedCall.status === 'open') {
      await db().quickCall.update({
        where: { id: quickCallId },
        data: { status: 'filled' },
      });
      updatedCall.status = 'filled';
    }

    const card = buildQuickCallEmbed(updatedCall, updatedCall.responses);
    try {
      await interaction.editReply({ embeds: card.embeds, components: card.components });
    } catch (err) {
      log.warn({ err, quickCallId }, 'Failed to update LFG embed');
    }
  }
}
