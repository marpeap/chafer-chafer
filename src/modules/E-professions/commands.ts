import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
} from 'discord.js';
import { db } from '../../core/database.js';
import { childLogger } from '../../core/logger.js';
import { successEmbed, errorEmbed } from '../../views/base.js';
import {
  buildProfessionListEmbed,
  buildCrafterSearchEmbed,
  buildCrafterAvailableEmbed,
  buildCrafterUnavailableEmbed,
  buildCraftRequestEmbed,
  buildCraftRequestRow,
} from './views.js';

const log = childLogger('E-professions');

// ────────────────── DOFUS Professions ──────────────────

export const PROFESSIONS = [
  'Bijoutier',
  'Bricoleur',
  'Cordonnier',
  'Costumier',
  'Forgeur de Boucliers',
  'Forgeur de Dagues',
  "Forgeur d'Épées",
  'Forgeur de Haches',
  'Forgeur de Marteaux',
  'Forgeur de Pelles',
  'Forgeur de Baguettes',
  "Sculpteur d'Arcs",
  'Sculpteur de Bâtons',
  'Tailleur',
  'Alchimiste',
  'Boulanger',
  'Boucher',
  'Poissonnier',
  'Paysan',
  'Bûcheron',
  'Mineur',
  'Pêcheur',
  'Chasseur',
] as const;

// ────────────────── /metier ──────────────────

export async function handleMetier(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'inscrire': return metierInscrire(interaction);
    case 'chercher': return metierChercher(interaction);
    case 'dispo': return metierDispo(interaction);
    case 'liste': return metierListe(interaction);
    default:
      log.warn({ sub }, 'Unknown /metier subcommand');
  }
}

// ── /metier inscrire → open modal ──

async function metierInscrire(interaction: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('metier_inscrire')
    .setTitle('Inscrire un métier');

  const nameInput = new TextInputBuilder()
    .setCustomId('profession')
    .setLabel('Métier')
    .setPlaceholder('Ex: Bijoutier, Forgeur de Dagues...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);

  const levelInput = new TextInputBuilder()
    .setCustomId('level')
    .setLabel('Niveau (1-200)')
    .setPlaceholder('200')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(3);

  const noteInput = new TextInputBuilder()
    .setCustomId('note')
    .setLabel('Note (optionnel)')
    .setPlaceholder('Ex: Spécialisé gelano, dispo le soir...')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(200);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(levelInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(noteInput),
  );

  await interaction.showModal(modal);
}

// ── /metier chercher <profession> ──

async function metierChercher(interaction: ChatInputCommandInteraction): Promise<void> {
  const profession = interaction.options.getString('profession', true);
  const guildId = interaction.guildId!;

  // 1. Find ALL crafters with this profession
  const allCrafters = await db().professionProfile.findMany({
    where: {
      guildId,
      profession: { equals: profession, mode: 'insensitive' },
    },
    orderBy: { level: 'desc' },
  });

  // 2. Find "Glandeur Dispo" players who listed this profession in their profile
  const glandeurs = await db().playerProfile.findMany({
    where: {
      guildId,
      globalAvailable: true,
      professions200: { contains: profession, mode: 'insensitive' },
    },
  });

  // 3. Build set of available user IDs (profession available OR globally available)
  const availableUserIds = new Set<string>();
  for (const c of allCrafters) {
    if (c.available) availableUserIds.add(c.userId);
  }
  for (const g of glandeurs) {
    availableUserIds.add(g.userId);
  }

  // 4. Split into available vs unavailable
  const availableProfiles = allCrafters.filter((c) => availableUserIds.has(c.userId));

  // Also include glandeurs who don't have a ProfessionProfile entry (level 200 assumed)
  const existingUserIds = new Set(allCrafters.map((c) => c.userId));
  for (const g of glandeurs) {
    if (!existingUserIds.has(g.userId)) {
      availableProfiles.push({
        userId: g.userId,
        level: 200,
        note: 'Glandeur Dispo',
      } as typeof allCrafters[number]);
    }
  }

  if (availableProfiles.length > 0) {
    // Case 1: Available crafters found — GREEN embed + ping
    const mentions = availableProfiles.map((p) => `<@${p.userId}>`).join(' ');
    const embed = buildCrafterAvailableEmbed(availableProfiles, profession);
    await interaction.reply({
      content: `${mentions} — on cherche un **${profession}** !`,
      embeds: [embed],
    });
  } else {
    // Case 2: No available crafters — ORANGE embed, no ping
    const embed = buildCrafterUnavailableEmbed(allCrafters, profession);
    await interaction.reply({ embeds: [embed] });
  }
}

// ── /metier dispo ──

async function metierDispo(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // Toggle global availability
  const existing = await db().crafterAvailability.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  const newAvailable = existing ? !existing.available : false;

  await db().crafterAvailability.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId, available: newAvailable },
    update: { available: newAvailable },
  });

  // Also update all profession profiles
  await db().professionProfile.updateMany({
    where: { guildId, userId },
    data: { available: newAvailable },
  });

  const statusText = newAvailable ? 'disponible' : 'indisponible';
  await interaction.reply({
    embeds: [successEmbed(`Tu es maintenant marqué(e) comme **${statusText}** pour tous tes métiers.`)],
    ephemeral: true,
  });
}

// ── /metier liste ──

async function metierListe(interaction: ChatInputCommandInteraction): Promise<void> {
  const profiles = await db().professionProfile.findMany({
    where: {
      guildId: interaction.guildId!,
      userId: interaction.user.id,
    },
    orderBy: { profession: 'asc' },
  });

  const embed = buildProfessionListEmbed(profiles, interaction.user.displayName);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ────────────────── /craft ──────────────────

export async function handleCraft(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'demande': return craftDemande(interaction);
    case 'prendre': return craftPrendre(interaction);
    case 'cloturer': return craftCloturer(interaction);
    default:
      log.warn({ sub }, 'Unknown /craft subcommand');
  }
}

// ── /craft demande → open modal ──

async function craftDemande(interaction: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('craft_demande')
    .setTitle('Nouvelle demande de craft');

  const professionInput = new TextInputBuilder()
    .setCustomId('profession')
    .setLabel('Métier requis')
    .setPlaceholder('Ex: Bijoutier')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);

  const itemInput = new TextInputBuilder()
    .setCustomId('item_name')
    .setLabel("Nom de l'objet")
    .setPlaceholder('Ex: Gelano')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const quantityInput = new TextInputBuilder()
    .setCustomId('quantity')
    .setLabel('Quantité')
    .setPlaceholder('1')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(5)
    .setValue('1');

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description (optionnel)')
    .setPlaceholder('Ex: Je fournis les ressources, merci !')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(professionInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(itemInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(quantityInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(descriptionInput),
  );

  await interaction.showModal(modal);
}

// ── /craft prendre <id> ──

async function craftPrendre(interaction: ChatInputCommandInteraction): Promise<void> {
  const id = interaction.options.getInteger('id', true);
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  const request = await db().craftRequest.findFirst({
    where: { id, guildId },
  });

  if (!request) {
    await interaction.reply({ embeds: [errorEmbed(`Demande de craft #${id} introuvable.`)], ephemeral: true });
    return;
  }

  if (request.status !== 'open') {
    await interaction.reply({ embeds: [errorEmbed('Cette demande n\'est plus ouverte.')], ephemeral: true });
    return;
  }

  if (request.requesterId === userId) {
    await interaction.reply({ embeds: [errorEmbed('Tu ne peux pas prendre ta propre demande.')], ephemeral: true });
    return;
  }

  const updated = await db().craftRequest.update({
    where: { id },
    data: { crafterId: userId, status: 'taken' },
  });

  const embed = buildCraftRequestEmbed(updated);
  const row = buildCraftRequestRow(updated);

  await interaction.reply({
    embeds: [successEmbed(`Tu as pris la demande de craft #${id}. Contacte <@${request.requesterId}> !`)],
  });

  // Update the original message if it exists
  await updateCraftMessage(interaction, updated, embed, row);
}

// ── /craft cloturer <id> ──

async function craftCloturer(interaction: ChatInputCommandInteraction): Promise<void> {
  const id = interaction.options.getInteger('id', true);
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  const request = await db().craftRequest.findFirst({
    where: { id, guildId },
  });

  if (!request) {
    await interaction.reply({ embeds: [errorEmbed(`Demande de craft #${id} introuvable.`)], ephemeral: true });
    return;
  }

  if (request.status !== 'taken') {
    await interaction.reply({ embeds: [errorEmbed('Seule une demande en cours peut être clôturée.')], ephemeral: true });
    return;
  }

  if (request.requesterId !== userId && request.crafterId !== userId) {
    await interaction.reply({ embeds: [errorEmbed('Seul le demandeur ou l\'artisan peut clôturer cette demande.')], ephemeral: true });
    return;
  }

  const updated = await db().craftRequest.update({
    where: { id },
    data: { status: 'completed' },
  });

  const embed = buildCraftRequestEmbed(updated);

  await interaction.reply({
    embeds: [successEmbed(`Demande de craft #${id} terminée !`)],
  });

  // Update the original message (no buttons for completed)
  await updateCraftMessage(interaction, updated, embed, null);
}

// ────────────────── Autocomplete ──────────────────

export async function handleMetierAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);

  if (focused.name === 'profession') {
    const search = focused.value.toLowerCase();
    const filtered = PROFESSIONS
      .filter((p) => p.toLowerCase().includes(search))
      .slice(0, 25)
      .map((p) => ({ name: p, value: p }));

    await interaction.respond(filtered);
    return;
  }

  await interaction.respond([]);
}

// ────────────────── Helpers ──────────────────

async function updateCraftMessage(
  interaction: ChatInputCommandInteraction,
  request: { id: number; messageId: string | null; channelId: string | null },
  embed: ReturnType<typeof buildCraftRequestEmbed>,
  row: ReturnType<typeof buildCraftRequestRow> | null,
): Promise<void> {
  if (!request.messageId || !request.channelId) return;

  try {
    const channel = interaction.client.channels.cache.get(request.channelId);
    if (!channel || !('messages' in channel)) return;

    const textChannel = channel as import('discord.js').TextChannel;
    const message = await textChannel.messages.fetch(request.messageId).catch(() => null);
    if (!message) return;

    if (row) {
      await message.edit({ embeds: [embed], components: [row] });
    } else {
      await message.edit({ embeds: [embed], components: [] });
    }
  } catch (err) {
    log.warn({ err, requestId: request.id }, 'Failed to update craft request message');
  }
}
