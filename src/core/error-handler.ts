import { ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction, AutocompleteInteraction, EmbedBuilder } from 'discord.js';
import { childLogger } from './logger.js';
import { Colors } from '../views/base.js';

const log = childLogger('error-handler');

type AnyInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction;

export async function handleInteractionError(
  interaction: AnyInteraction,
  err: unknown,
): Promise<void> {
  log.error({ err, user: interaction.user.id, type: interaction.type }, 'Interaction error');

  const embed = new EmbedBuilder()
    .setColor(Colors.ERROR)
    .setTitle('Erreur')
    .setDescription('Une erreur interne est survenue.')
    .setTimestamp();

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (replyErr) {
    log.error({ err: replyErr }, 'Failed to send error reply');
  }
}

export function isAutocompleteInteraction(interaction: unknown): interaction is AutocompleteInteraction {
  return (interaction as AutocompleteInteraction).type === 4;
}
