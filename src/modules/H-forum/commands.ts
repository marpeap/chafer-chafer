import {
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
} from 'discord.js';
import { childLogger } from '../../core/logger.js';

const log = childLogger('H-forum:commands');

export async function handleDemande(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'creer':
      return handleCreer(interaction);
    default:
      log.warn({ sub }, 'Unknown demande subcommand');
  }
}

// ────────────────── /demande creer ──────────────────

async function handleCreer(interaction: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('demande_creer')
    .setTitle('Creer une demande');

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Titre')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(2000)
    .setRequired(true);

  const tagInput = new TextInputBuilder()
    .setCustomId('tag')
    .setLabel('Tag (aide/donjon/craft/koli/songes/question/guilde)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('aide, donjon, craft, koli, songes, recrutement_groupe, question, guilde')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(titleInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(descriptionInput),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(tagInput),
  );

  await interaction.showModal(modal);
}
