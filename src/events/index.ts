import { Client } from 'discord.js';
import { registerReadyEvent } from './ready.js';
import { registerInteractionCreateEvent } from './interaction-create.js';
import { registerMemberEvents } from './member-events.js';

export function registerAllEvents(client: Client): void {
  registerReadyEvent(client);
  registerInteractionCreateEvent(client);
  registerMemberEvents(client);
}
