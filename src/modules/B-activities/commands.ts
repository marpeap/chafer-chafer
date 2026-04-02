import {
  ChatInputCommandInteraction,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { db } from '../../core/database.js';
import { audit } from '../../core/audit.js';
import { childLogger } from '../../core/logger.js';
import { errorEmbed, successEmbed } from '../../views/base.js';
import { buildActivityListEmbed } from './views.js';

const log = childLogger('activities:commands');

export async function handleSortie(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'creer':
      return handleSortieCreer(interaction);
    case 'liste':
      return handleSortieListe(interaction);
    case 'annuler':
      return handleSortieAnnuler(interaction);
    case 'cloturer':
      return handleSortieCloturer(interaction);
    default:
      log.warn({ sub }, 'Unknown sortie subcommand');
  }
}

export async function handleLfg(interaction: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('lfg_creer')
    .setTitle('LFG — Appel rapide');

  const activiteInput = new TextInputBuilder()
    .setCustomId('activite')
    .setLabel('Activité (donjon, koli, songe, quête, farm, pvp, autre)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('ex: donjon')
    .setRequired(true)
    .setMaxLength(50);

  const joueursInput = new TextInputBuilder()
    .setCustomId('joueurs')
    .setLabel('Joueurs recherchés')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('ex: 3')
    .setRequired(true)
    .setMaxLength(3);

  const dureeInput = new TextInputBuilder()
    .setCustomId('duree')
    .setLabel('Durée en heures (0.5 à 6)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('ex: 1 (ou 0.5 pour 30min)')
    .setRequired(true)
    .setMaxLength(3);

  const commentaireInput = new TextInputBuilder()
    .setCustomId('commentaire')
    .setLabel('Commentaire (optionnel)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Détails supplémentaires...')
    .setRequired(false)
    .setMaxLength(500);

  const niveauInput = new TextInputBuilder()
    .setCustomId('niveau')
    .setLabel('Niveau minimum (optionnel)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 100')
    .setRequired(false)
    .setMaxLength(3);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(activiteInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(joueursInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(dureeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(niveauInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(commentaireInput),
  );

  await interaction.showModal(modal);
}

// --- Subcommand handlers ---

async function handleSortieCreer(interaction: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('sortie_creer')
    .setTitle('Créer une sortie');

  const titreInput = new TextInputBuilder()
    .setCustomId('titre')
    .setLabel('Titre de la sortie')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('ex: Donjon Comte Harebourg')
    .setRequired(true)
    .setMaxLength(100);

  const typeInput = new TextInputBuilder()
    .setCustomId('type')
    .setLabel('Type (donjon/koli/songe/quete/farm/pvp/autre)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('ex: donjon')
    .setRequired(true)
    .setMaxLength(20);

  const dateHeureInput = new TextInputBuilder()
    .setCustomId('date_heure')
    .setLabel('Date et heure (JJ/MM/AAAA HH:MM)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('ex: 15/04/2026 21:00')
    .setRequired(true)
    .setMaxLength(20);

  const dureeMaxInput = new TextInputBuilder()
    .setCustomId('duree_max')
    .setLabel('Durée estimée (min) / Max joueurs (ex: 120/8)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('ex: 120/8')
    .setRequired(false)
    .setMaxLength(20);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description / Rôles (optionnel)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Ex: 2 Tank, 2 Heal, 4 DPS\nDétails de la sortie...')
    .setRequired(false)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titreInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(typeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(dateHeureInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(dureeMaxInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
  );

  await interaction.showModal(modal);
}

async function handleSortieListe(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const activities = await db().activity.findMany({
    where: {
      guildId,
      status: 'published',
      scheduledAt: { gte: new Date() },
    },
    include: { signups: true },
    orderBy: { scheduledAt: 'asc' },
    take: 15,
  });

  const embed = buildActivityListEmbed(activities);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSortieAnnuler(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const id = interaction.options.getInteger('id', true);

  const activity = await db().activity.findFirst({
    where: { id, guildId },
  });

  if (!activity) {
    await interaction.reply({ embeds: [errorEmbed('Sortie introuvable.')], ephemeral: true });
    return;
  }

  if (activity.status === 'cancelled') {
    await interaction.reply({ embeds: [errorEmbed('Cette sortie est déjà annulée.')], ephemeral: true });
    return;
  }

  await db().activity.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'activity.cancel',
    targetType: 'activity',
    targetId: String(id),
    details: { title: activity.title },
  });

  // Update the original message if it exists
  if (activity.messageId && activity.channelId) {
    try {
      const channel = interaction.client.channels.cache.get(activity.channelId);
      if (channel && 'messages' in channel) {
        const message = await (channel as import('discord.js').TextChannel).messages.fetch(activity.messageId);
        const updatedActivity = await db().activity.findUnique({
          where: { id },
          include: { signups: true },
        });
        if (updatedActivity) {
          const { buildActivityEmbed } = await import('./views.js');
          const card = buildActivityEmbed(updatedActivity, updatedActivity.signups);
          await message.edit({ embeds: card.embeds, components: card.components });
        }
      }
    } catch (err) {
      log.warn({ err, activityId: id }, 'Failed to update activity message after cancel');
    }
  }

  await interaction.reply({ embeds: [successEmbed(`Sortie **${activity.title}** (ID: ${id}) annulée.`)], ephemeral: true });
}

async function handleSortieCloturer(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const id = interaction.options.getInteger('id', true);

  const activity = await db().activity.findFirst({
    where: { id, guildId },
  });

  if (!activity) {
    await interaction.reply({ embeds: [errorEmbed('Sortie introuvable.')], ephemeral: true });
    return;
  }

  if (activity.status === 'closed' || activity.status === 'cancelled') {
    await interaction.reply({ embeds: [errorEmbed('Cette sortie est déjà clôturée ou annulée.')], ephemeral: true });
    return;
  }

  await db().activity.update({
    where: { id },
    data: { status: 'closed', closedAt: new Date() },
  });

  await audit({
    guildId,
    actorId: interaction.user.id,
    action: 'activity.close',
    targetType: 'activity',
    targetId: String(id),
    details: { title: activity.title },
  });

  // Update the original message if it exists
  if (activity.messageId && activity.channelId) {
    try {
      const channel = interaction.client.channels.cache.get(activity.channelId);
      if (channel && 'messages' in channel) {
        const message = await (channel as import('discord.js').TextChannel).messages.fetch(activity.messageId);
        const updatedActivity = await db().activity.findUnique({
          where: { id },
          include: { signups: true },
        });
        if (updatedActivity) {
          const { buildActivityEmbed } = await import('./views.js');
          const card = buildActivityEmbed(updatedActivity, updatedActivity.signups);
          await message.edit({ embeds: card.embeds, components: card.components });
        }
      }
    } catch (err) {
      log.warn({ err, activityId: id }, 'Failed to update activity message after close');
    }
  }

  await interaction.reply({ embeds: [successEmbed(`Sortie **${activity.title}** (ID: ${id}) clôturée.`)], ephemeral: true });
}
