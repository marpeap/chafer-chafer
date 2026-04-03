import { ModalSubmitInteraction, ForumChannel, ChannelType } from 'discord.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed } from '../../views/base.js';
import { buildForumRequestEmbed } from './views.js';

const log = childLogger('H-forum:modals');

const VALID_TAGS = [
  'aide',
  'donjon',
  'craft',
  'koli',
  'songes',
  'recrutement_groupe',
  'question',
  'guilde',
] as const;

/** Fuzzy-match a tag input to the closest valid tag */
function matchTag(input: string): (typeof VALID_TAGS)[number] | null {
  const norm = input.toLowerCase().replace(/[\s_-]+/g, '').trim();
  // Exact normalized match (spaces/underscores removed)
  const exact = VALID_TAGS.find((t) => t.replace(/_/g, '') === norm);
  if (exact) return exact;
  // StartsWith match
  const starts = VALID_TAGS.find((t) => t.replace(/_/g, '').startsWith(norm));
  if (starts) return starts;
  // Contains match
  const contains = VALID_TAGS.find((t) => t.replace(/_/g, '').includes(norm) || norm.includes(t.replace(/_/g, '')));
  if (contains) return contains;
  // Common aliases
  const aliases: Record<string, (typeof VALID_TAGS)[number]> = {
    help: 'aide', recrutement: 'recrutement_groupe', recruit: 'recrutement_groupe',
    groupe: 'recrutement_groupe', songe: 'songes', dream: 'songes', guild: 'guilde',
  };
  return aliases[norm] ?? null;
}

export async function handleDemandeModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== 'demande_creer') return;

  const guildId = interaction.guildId;
  if (!guildId) return;

  const title = interaction.fields.getTextInputValue('title').trim();
  const description = interaction.fields.getTextInputValue('description').trim();
  const tagInput = interaction.fields.getTextInputValue('tag').trim();

  // Fuzzy-match tag
  const tagRaw = matchTag(tagInput);
  if (!tagRaw) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          `Tag non reconnu : \`${tagInput}\`\nTags valides : ${VALID_TAGS.map((t) => `\`${t}\``).join(', ')}`,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get configured forum channel
    const guild = await db().discordGuild.findUnique({
      where: { guildId },
    });

    const forumChannelId = guild?.forumChannelId;
    if (!forumChannelId) {
      await interaction.editReply({
        embeds: [errorEmbed('Aucun salon forum configure. Demande a un admin de configurer `/config salons forum`.')],
      });
      return;
    }

    const forumChannel = interaction.guild?.channels.cache.get(forumChannelId);
    if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
      await interaction.editReply({
        embeds: [errorEmbed('Le salon forum configure est invalide ou introuvable.')],
      });
      return;
    }

    const forum = forumChannel as ForumChannel;

    // Create ForumRequest in DB
    const request = await db().forumRequest.create({
      data: {
        guildId,
        createdBy: interaction.user.id,
        title,
        description,
        tag: tagRaw,
        status: 'open',
      },
    });

    // Find matching tag in the forum channel
    const availableTag = forum.availableTags.find(
      (t) => t.name.toLowerCase() === tagRaw,
    );

    // Create thread in the forum channel
    const embed = buildForumRequestEmbed(request);
    const thread = await forum.threads.create({
      name: title,
      message: { embeds: [embed] },
      appliedTags: availableTag ? [availableTag.id] : [],
    });

    // Update DB with thread ID
    await db().forumRequest.update({
      where: { id: request.id },
      data: { threadId: thread.id },
    });

    // Audit log
    await audit({
      guildId,
      actorId: interaction.user.id,
      action: 'forum.request_created',
      targetType: 'forum_request',
      targetId: String(request.id),
      details: { title, tag: tagRaw },
    });

    await interaction.editReply({
      content: `Demande creee avec succes ! Retrouve-la ici : <#${thread.id}>`,
    });

    log.info({ requestId: request.id, guildId, threadId: thread.id }, 'Forum request created');
  } catch (err) {
    log.error({ err }, 'Failed to create forum request');
    await interaction.editReply({
      embeds: [errorEmbed('Une erreur est survenue lors de la creation de la demande.')],
    });
  }
}
