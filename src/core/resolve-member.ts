import { Guild, GuildMember } from 'discord.js';

/**
 * Resolve a guild member from flexible user input.
 *
 * Handles 3 formats:
 *  1. Raw Discord ID: "123456789012345678"
 *  2. Mention format: "<@123456789012345678>" or "<@!123456789012345678>"
 *  3. Username / display name: "@Overim", "Overim", "overim"
 *
 * Discord modal TextInputs never resolve mentions — users type "@pseudo"
 * but the bot receives the literal string, not "<@id>". This helper
 * bridges that gap by falling back to a member search by name.
 *
 * Returns the GuildMember if found, null otherwise.
 */
export async function resolveMember(
  guild: Guild,
  input: string,
): Promise<GuildMember | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Extract ID from mention format <@id> or <@!id>
  const mentionMatch = trimmed.match(/^<@!?(\d{17,19})>$/);
  if (mentionMatch) {
    return guild.members.fetch(mentionMatch[1]).catch(() => null);
  }

  // 2. Raw numeric ID
  if (/^\d{17,19}$/.test(trimmed)) {
    return guild.members.fetch(trimmed).catch(() => null);
  }

  // 3. Username / display name lookup (strip leading @ if present)
  const name = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  const lower = name.toLowerCase();

  // Search through cached members first (fast path)
  const cached = guild.members.cache.find(
    (m) =>
      m.user.username.toLowerCase() === lower ||
      m.user.globalName?.toLowerCase() === lower ||
      m.displayName.toLowerCase() === lower,
  );
  if (cached) return cached;

  // Fallback: fetch from Discord API (handles uncached members)
  try {
    const fetched = await guild.members.fetch({ query: name, limit: 5 });
    const exact = fetched.find(
      (m) =>
        m.user.username.toLowerCase() === lower ||
        m.user.globalName?.toLowerCase() === lower ||
        m.displayName.toLowerCase() === lower,
    );
    return exact ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract just the user ID from flexible input, without fetching.
 * Returns null if the input isn't a valid ID or mention format.
 * Use resolveMember() when you need the full GuildMember object.
 */
export function parseUserId(input: string): string | null {
  const trimmed = input.trim();

  const mentionMatch = trimmed.match(/^<@!?(\d{17,19})>$/);
  if (mentionMatch) return mentionMatch[1];

  if (/^\d{17,19}$/.test(trimmed)) return trimmed;

  return null;
}
