/**
 * @module core/client
 * @description Discord.js client singleton — initialization, login, and graceful shutdown.
 *
 * Configured intents: Guilds, GuildMembers, GuildPresences, GuildMessages,
 * GuildScheduledEvents, MessageContent.
 * Partials: GuildMember, Channel (needed for uncached member/channel events).
 *
 * Used by: index.ts (boot), core/audit, core/resolve-member, events/, modules/
 */

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { env } from '../config/env.js';
import { childLogger } from './logger.js';

let _client: Client | null = null;
const log = childLogger('client');

export function initClient(): Client {
  _client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildScheduledEvents,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.GuildMember, Partials.Channel],
  });

  _client.on('warn', (msg) => log.warn({ msg }, 'Discord warning'));
  _client.on('error', (err) => log.error({ err }, 'Discord error'));

  return _client;
}

export function discordClient(): Client {
  if (!_client) throw new Error('Discord client not initialized');
  return _client;
}

export async function loginClient(): Promise<void> {
  if (!_client) throw new Error('Discord client not initialized');
  await _client.login(env().DISCORD_BOT_TOKEN);
  log.info({ user: _client.user?.tag }, 'Discord client logged in');
}

export async function destroyClient(): Promise<void> {
  if (_client) {
    _client.destroy();
    _client = null;
  }
}
