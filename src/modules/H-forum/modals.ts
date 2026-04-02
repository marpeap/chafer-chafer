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

export async function handleDemandeModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== 'demande_creer') return;

  const guildId = interaction.guildId;
  if (!guildId) return;

  const title = interaction.fields.getTextInputValue('title').trim();
  const description = interaction.fields.getTextInputValue('description').trim();
  const tagRaw = interaction.fields.getTextInputValue('tag').trim().toLowerCase();

  // Validate tag
  if (!VALID_TAGS.includes(tagRaw as typeof VALID_TAGS[number])) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          `Tag invalide : \`${tagRaw}\`\nTags valides : ${VALID_TAGS.map((t) => `\`${t}\``).join(', ')}`,
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
