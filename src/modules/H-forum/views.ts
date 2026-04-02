import { EmbedBuilder } from 'discord.js';
import { baseEmbed, Colors, Emoji, truncate, discordTimestamp } from '../../views/base.js';
import type { ForumRequest } from '@prisma/client';

const TAG_LABELS: Record<string, string> = {
  aide: 'Aide',
  donjon: 'Donjon',
  craft: 'Craft',
  koli: 'Kolizeum',
  songes: 'Songes',
  recrutement_groupe: 'Recrutement groupe',
  question: 'Question',
  guilde: 'Guilde',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  resolved: 'Resolue',
  archived: 'Archivee',
};

function tagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag;
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function buildForumRequestEmbed(request: ForumRequest): EmbedBuilder {
  const embed = baseEmbed(
    `${Emoji.SCROLL} ${request.title}`,
    Colors.FORUM,
  );

  const lines: string[] = [];
  lines.push(`**Auteur :** <@${request.createdBy}>`);
  lines.push(`**Tag :** ${tagLabel(request.tag)}`);
  lines.push(`**Statut :** ${statusLabel(request.status)}`);
  lines.push(`**Date :** ${discordTimestamp(request.createdAt, 'F')}`);

  if (request.description) {
    lines.push('');
    lines.push(truncate(request.description, 2048));
  }

  embed.setDescription(lines.join('\n'));

  return embed;
}
