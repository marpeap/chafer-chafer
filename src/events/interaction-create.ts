import { Client } from 'discord.js';
import { handleInteraction } from '../interactions/handler.js';
import { childLogger } from '../core/logger.js';

const log = childLogger('event:interactionCreate');

export function registerInteractionCreateEvent(client: Client): void {
  client.on('interactionCreate', async (interaction) => {
    try {
      await handleInteraction(interaction);
    } catch (err) {
      log.error({ err, type: interaction.type }, 'Unhandled error in interactionCreate');
    }
  });
}
