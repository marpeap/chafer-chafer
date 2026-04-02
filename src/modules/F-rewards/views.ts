import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { baseEmbed, Colors, Emoji, truncate, discordTimestamp } from '../../views/base.js';
import type { Reward } from '@prisma/client';

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  claimable: 'A reclamer',
  claimed: 'Reclamee',
  paid: 'Payee',
  cancelled: 'Annulee',
  disputed: 'Contestee',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function buildRewardEmbed(reward: Reward): EmbedBuilder {
  const embed = baseEmbed(
    `${Emoji.TROPHY} Recompense — ${reward.title}`,
    Colors.REWARD,
  );

  const lines: string[] = [];
  lines.push(`**Destinataire :** <@${reward.recipientId}>`);
  if (reward.amount) {
    lines.push(`**Montant :** ${Emoji.COIN} ${reward.amount}`);
  }
  lines.push(`**Statut :** ${statusLabel(reward.status)}`);
  if (reward.reason) {
    lines.push(`**Raison :** ${truncate(reward.reason, 512)}`);
  }
  lines.push(`**Creee par :** <@${reward.createdBy}>`);
  lines.push(`**Date :** ${discordTimestamp(reward.createdAt, 'F')}`);

  embed.setDescription(lines.join('\n'));

  return embed;
}

export function buildRewardCard(reward: Reward): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = buildRewardEmbed(reward);

  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (reward.status === 'claimable') {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`reward:claim:${reward.id}`)
        .setLabel('Reclamer')
        .setStyle(ButtonStyle.Success)
        .setEmoji(Emoji.COIN),
      new ButtonBuilder()
        .setCustomId(`reward:dispute:${reward.id}`)
        .setLabel('Contester')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(Emoji.CROSS),
    );
    components.push(row);
  }

  return { embeds: [embed], components };
}

export function buildRewardListEmbed(rewards: Reward[]): EmbedBuilder {
  const embed = baseEmbed(
    `${Emoji.TROPHY} Mes recompenses`,
    Colors.REWARD,
  );

  if (rewards.length === 0) {
    embed.setDescription('Aucune recompense en cours.');
    return embed;
  }

  const lines = rewards.map((r, i) => {
    const amount = r.amount ? ` — ${Emoji.COIN} ${r.amount}` : '';
    return `**${i + 1}.** ${r.title}${amount} — *${statusLabel(r.status)}* (ID: ${r.id})`;
  });

  embed.setDescription(truncate(lines.join('\n'), 4096));
  return embed;
}
