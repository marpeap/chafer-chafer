import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
} from 'discord.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { childLogger } from '../../core/logger.js';
import { getMemberLevel, requireLevel, PermissionLevel } from '../../core/permissions.js';
import { baseEmbed, errorEmbed, successEmbed, Colors, Emoji, truncate, discordTimestamp } from '../../views/base.js';
import { buildProfileEmbed } from '../A-members/views.js';
import { resolveMember } from '../../core/resolve-member.js';

const log = childLogger('admin:members');

// Interaction types that support reply/deferReply/editReply
type RepliableInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction;

// ────────────────── /admin membres ──────────────────

export async function handleAdminMembres(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  page: number = 0,
): Promise<void> {
  const guildId = interaction.guildId!;
  const PAGE_SIZE = 10;

  const [profiles, total] = await Promise.all([
    db().playerProfile.findMany({
      where: { guildId, status: 'approved' },
      orderBy: { approvedAt: 'desc' },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db().playerProfile.count({
      where: { guildId, status: 'approved' },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (profiles.length === 0 && page === 0) {
    const embed = baseEmbed(`${Emoji.PEOPLE} Membres Chafer`, Colors.INFO)
      .setDescription('Aucun membre approuve pour le moment.');
    await replyOrEdit(interaction, { embeds: [embed], components: [] });
    return;
  }

  const lines = profiles.map((p, i) => {
    const idx = page * PAGE_SIZE + i + 1;
    const name = p.characterName ?? 'Inconnu';
    const cls = p.characterClass ?? '?';
    const lvl = p.characterLevel != null ? String(p.characterLevel) : '?';
    const orientation = p.orientation ?? '?';
    return `**${idx}.** <@${p.userId}> — ${name} (${cls} ${lvl}, ${orientation})`;
  });

  const embed = baseEmbed(`${Emoji.PEOPLE} Membres Chafer (${total})`, Colors.INFO)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Page ${page + 1}/${totalPages} | Chafer Chafer` });

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (totalPages > 1) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin:membres_page:${page - 1}`)
        .setLabel('Precedent')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(`admin:membres_page:${page + 1}`)
        .setLabel('Suivant')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1),
    );
    components.push(row);
  }

  await replyOrEdit(interaction, { embeds: [embed], components });
}

// ────────────────── /admin profil @user ──────────────────

export async function handleAdminProfil(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const targetUser = interaction.options.getUser('utilisateur', true);

  await interaction.deferReply({ ephemeral: true });

  const profile = await db().playerProfile.findUnique({
    where: { guildId_userId: { guildId, userId: targetUser.id } },
  });

  if (!profile) {
    await interaction.editReply({
      embeds: [errorEmbed(`<@${targetUser.id}> n'a pas de profil enregistre.`)],
    });
    return;
  }

  // Fetch GuildMember for the profile embed
  let guildMember: GuildMember | null = null;
  try {
    guildMember = await interaction.guild!.members.fetch(targetUser.id);
  } catch {
    // Member may have left the guild
  }

  // Build profile embed (reuse existing builder if member still in guild)
  const embeds: EmbedBuilder[] = [];

  if (guildMember) {
    embeds.push(buildProfileEmbed(profile, guildMember));
  } else {
    // Fallback embed for members who left
    const profileEmbed = baseEmbed(`\u{1F480} Profil de ${targetUser.username}`, Colors.PRIMARY)
      .addFields(
        { name: 'Personnage', value: profile.characterName ?? 'Non renseigne', inline: true },
        { name: 'Classe', value: profile.characterClass ?? 'Non renseignee', inline: true },
        { name: 'Niveau', value: profile.characterLevel != null ? String(profile.characterLevel) : '?', inline: true },
        { name: 'Orientation', value: profile.orientation ?? '?', inline: true },
        { name: 'Statut', value: profile.status, inline: true },
      );
    embeds.push(profileEmbed);
  }

  // Gather stats
  const [
    activitySignupCount,
    quickCallCount,
    craftRequestsMade,
    craftRequestsFulfilled,
    rewardsData,
    auditCount,
    warningsAndNotes,
  ] = await Promise.all([
    db().activitySignup.count({
      where: {
        userId: targetUser.id,
        activity: { guildId },
      },
    }),
    db().quickCall.count({
      where: { guildId, createdBy: targetUser.id },
    }),
    db().craftRequest.count({
      where: { guildId, requesterId: targetUser.id },
    }),
    db().craftRequest.count({
      where: { guildId, crafterId: targetUser.id, status: 'completed' },
    }),
    db().reward.findMany({
      where: { guildId, recipientId: targetUser.id },
      select: { amount: true },
    }),
    db().auditLog.count({
      where: {
        guildId,
        OR: [
          { actorId: targetUser.id },
          { targetId: targetUser.id },
        ],
      },
    }),
    db().auditLog.findMany({
      where: {
        guildId,
        targetId: targetUser.id,
        action: { in: ['admin.warn', 'admin.note'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const rewardCount = rewardsData.length;

  // Stats embed
  const statsEmbed = baseEmbed(`${Emoji.SCROLL} Statistiques`, Colors.INFO);

  const statsLines = [
    `${Emoji.SWORD} Activites rejointes : **${activitySignupCount}**`,
    `${Emoji.PEOPLE} QuickCalls crees : **${quickCallCount}**`,
    `${Emoji.HAMMER} Crafts demandes : **${craftRequestsMade}**`,
    `${Emoji.HAMMER} Crafts realises : **${craftRequestsFulfilled}**`,
    `${Emoji.COIN} Recompenses recues : **${rewardCount}**`,
    `${Emoji.SCROLL} Actions audit : **${auditCount}**`,
  ];

  statsEmbed.setDescription(statsLines.join('\n'));

  // Warnings/notes
  if (warningsAndNotes.length > 0) {
    const warnLines = warningsAndNotes.map((entry) => {
      const icon = entry.action === 'admin.warn' ? Emoji.CROSS : Emoji.SCROLL;
      const label = entry.action === 'admin.warn' ? 'WARN' : 'NOTE';
      let detail = '';
      try {
        const parsed = JSON.parse(entry.details ?? '{}');
        detail = parsed.text ?? parsed.reason ?? '';
      } catch {
        detail = entry.details ?? '';
      }
      return `${icon} **${label}** ${discordTimestamp(entry.createdAt, 'R')} par <@${entry.actorId}>\n> ${truncate(detail, 200)}`;
    });
    statsEmbed.addFields({
      name: 'Notes & Avertissements recents',
      value: warnLines.join('\n\n'),
    });
  }

  embeds.push(statsEmbed);

  await interaction.editReply({ embeds });
}

// ────────────────── /admin note @user <texte> ──────────────────

export async function handleAdminNote(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const targetUser = interaction.options.getUser('utilisateur', true);
  const text = interaction.options.getString('texte', true);

  // Verify profile exists
  const profile = await db().playerProfile.findUnique({
    where: { guildId_userId: { guildId, userId: targetUser.id } },
  });

  if (!profile) {
    await interaction.reply({
      embeds: [errorEmbed(`<@${targetUser.id}> n'a pas de profil enregistre.`)],
      ephemeral: true,
    });
    return;
  }

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'admin.note',
    targetType: 'user',
    targetId: targetUser.id,
    details: { text },
  });

  await interaction.reply({
    embeds: [successEmbed(`Note ajoutee au profil de <@${targetUser.id}>.\n> ${truncate(text, 200)}`)],
    ephemeral: true,
  });
}

// ────────────────── /admin warn @user <raison> ──────────────────

export async function handleAdminWarn(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const targetUser = interaction.options.getUser('utilisateur', true);
  const reason = interaction.options.getString('raison', true);

  // Verify profile exists
  const profile = await db().playerProfile.findUnique({
    where: { guildId_userId: { guildId, userId: targetUser.id } },
  });

  if (!profile) {
    await interaction.reply({
      embeds: [errorEmbed(`<@${targetUser.id}> n'a pas de profil enregistre.`)],
      ephemeral: true,
    });
    return;
  }

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'admin.warn',
    targetType: 'user',
    targetId: targetUser.id,
    details: { reason },
  });

  // DM the user
  try {
    const dmEmbed = baseEmbed(`${Emoji.CROSS} Avertissement`, Colors.ERROR)
      .setDescription(
        `Tu as recu un avertissement de la guilde **${interaction.guild?.name ?? 'Chafer'}**.\n\n` +
        `**Raison :** ${truncate(reason, 500)}`,
      );
    await targetUser.send({ embeds: [dmEmbed] });
  } catch {
    // User may have DMs disabled
    log.warn({ userId: targetUser.id }, 'Could not DM warned user');
  }

  // Count total warnings
  const warnCount = await db().auditLog.count({
    where: {
      guildId,
      targetId: targetUser.id,
      action: 'admin.warn',
    },
  });

  await interaction.reply({
    embeds: [
      successEmbed(
        `${Emoji.CROSS} Avertissement envoye a <@${targetUser.id}>.\n` +
        `**Raison :** ${truncate(reason, 200)}\n` +
        `Total avertissements : **${warnCount}**`,
      ),
    ],
    ephemeral: true,
  });
}

// ────────────────── /admin historique @user ──────────────────

export async function handleAdminHistorique(
  interaction: RepliableInteraction,
  targetUserId?: string,
): Promise<void> {
  const guildId = interaction.guildId!;

  let userId: string;
  if (interaction.isChatInputCommand()) {
    const targetUser = interaction.options.getUser('utilisateur', true);
    userId = targetUser.id;
  } else if (targetUserId) {
    userId = targetUserId;
  } else {
    await interaction.reply({
      embeds: [errorEmbed('Utilisateur non specifie.')],
      ephemeral: true,
    });
    return;
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const entries = await db().auditLog.findMany({
    where: {
      guildId,
      OR: [
        { actorId: userId },
        { targetId: userId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  if (entries.length === 0) {
    await interaction.editReply({
      embeds: [
        baseEmbed(`${Emoji.SCROLL} Historique de <@${userId}>`, Colors.INFO)
          .setDescription('Aucune entree dans le journal d\'audit.'),
      ],
    });
    return;
  }

  const lines = entries.map((entry) => {
    const time = discordTimestamp(entry.createdAt, 'R');
    const isActor = entry.actorId === userId;
    const role = isActor ? 'acteur' : 'cible';

    let detail = '';
    if (entry.details) {
      try {
        const parsed = JSON.parse(entry.details);
        const text = parsed.text ?? parsed.reason ?? '';
        if (text) detail = ` — ${truncate(text, 80)}`;
      } catch {
        // ignore parse errors
      }
    }

    return `${time} \`${entry.action}\` (${role})${detail}`;
  });

  const embed = baseEmbed(`${Emoji.SCROLL} Historique de <@${userId}>`, Colors.INFO)
    .setDescription(lines.join('\n'));

  await interaction.editReply({ embeds: [embed] });
}

// ────────────────── Button handler for pagination ──────────────────

export async function handleAdminMemberButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;

  // admin:membres_page:N
  if (customId.startsWith('admin:membres_page:')) {
    const member = interaction.member as GuildMember;
    const level = await getMemberLevel(member);
    if (!requireLevel(PermissionLevel.OFFICER, level)) {
      await interaction.deferUpdate();
      return;
    }

    const page = parseInt(customId.split(':')[2], 10);
    if (isNaN(page) || page < 0) return;
    await interaction.deferUpdate();
    await handleAdminMembres(interaction, page);
    return;
  }

  log.warn({ customId }, 'Unknown admin member button');
}

// ────────────────── Modal handler for historique (from officer panel) ──────────────────

export async function handleAdminMemberModal(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;

  if (customId === 'admin:modal_historique') {
    const userInput = interaction.fields.getTextInputValue('user_id').trim();

    if (!interaction.guild) {
      await interaction.reply({ embeds: [errorEmbed('Cette commande ne fonctionne que dans un serveur.')], ephemeral: true });
      return;
    }

    // Resoudre le membre : supporte @pseudo, pseudo, ID brut, <@ID>
    await interaction.deferReply({ ephemeral: true });
    const member = await resolveMember(interaction.guild, userInput);

    if (!member) {
      await interaction.editReply({
        embeds: [errorEmbed(`Membre introuvable pour "${userInput}". Utilise un @pseudo, un nom d'affichage ou un ID Discord.`)],
      });
      return;
    }

    await handleAdminHistorique(interaction, member.id);
    return;
  }

  log.warn({ customId }, 'Unknown admin member modal');
}

// ────────────────── Helpers ──────────────────

async function replyOrEdit(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  payload: { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] },
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: payload.embeds, components: payload.components });
  } else {
    await interaction.reply({ embeds: payload.embeds, components: payload.components, ephemeral: true });
  }
}
