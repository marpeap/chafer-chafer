import { Guild, GuildMember } from 'discord.js';

/**
 * Resout un membre de guilde a partir d'une saisie utilisateur flexible.
 *
 * Gere 3 formats :
 *  1. ID Discord brut : "123456789012345678"
 *  2. Format mention : "<@123456789012345678>" ou "<@!123456789012345678>"
 *  3. Pseudo / nom d'affichage : "@Overim", "Overim", "overim"
 *
 * Les TextInput des modals Discord ne resolvent jamais les mentions — l'utilisateur
 * tape "@pseudo" mais le bot recoit la chaine litterale, pas "<@id>". Ce helper
 * comble ce manque en cherchant par nom en dernier recours.
 *
 * Retourne le GuildMember si trouve, null sinon.
 */
export async function resolveMember(
  guild: Guild,
  input: string,
): Promise<GuildMember | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Extraire l'ID du format mention <@id> ou <@!id>
  const mentionMatch = trimmed.match(/^<@!?(\d{17,19})>$/);
  if (mentionMatch) {
    return guild.members.fetch(mentionMatch[1]).catch(() => null);
  }

  // 2. ID numerique brut
  if (/^\d{17,19}$/.test(trimmed)) {
    return guild.members.fetch(trimmed).catch(() => null);
  }

  // 3. Recherche par pseudo / nom d'affichage (retire le @ en debut si present)
  const name = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  const lower = name.toLowerCase();

  // Chercher d'abord dans les membres en cache (chemin rapide)
  const cached = guild.members.cache.find(
    (m) =>
      m.user.username.toLowerCase() === lower ||
      m.user.globalName?.toLowerCase() === lower ||
      m.displayName.toLowerCase() === lower,
  );
  if (cached) return cached;

  // Dernier recours : appel API Discord (pour les membres non mis en cache)
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
 * Extrait uniquement l'ID utilisateur d'une saisie flexible, sans appel API.
 * Retourne null si la saisie n'est pas un ID valide ou un format mention.
 * Utiliser resolveMember() quand on a besoin de l'objet GuildMember complet.
 */
export function parseUserId(input: string): string | null {
  const trimmed = input.trim();

  const mentionMatch = trimmed.match(/^<@!?(\d{17,19})>$/);
  if (mentionMatch) return mentionMatch[1];

  if (/^\d{17,19}$/.test(trimmed)) return trimmed;

  return null;
}
