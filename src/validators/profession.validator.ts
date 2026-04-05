/**
 * @module validators/profession
 * @description Validation et correspondance floue des noms de metiers DOFUS, partagee entre modules.
 *
 * Utilise par :
 *   - A-members/modals.ts (edition professions200 — validation de la saisie utilisateur)
 *   - E-professions/modals.ts (inscription metier + demandes de craft)
 *   - panel/modals.ts (recherche metier)
 *
 * Depend de : E-professions/commands.ts (liste canonique PROFESSIONS)
 */

import { PROFESSIONS } from '../modules/E-professions/commands.js';

/**
 * Retire les accents, apostrophes et normalise les espaces pour la correspondance floue.
 * "Forgeur d'Épées" → "forgeur depees"
 */
export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** Noms de metiers normalises pre-calcules pour une comparaison en O(1) */
const PROFESSIONS_NORMALIZED = PROFESSIONS.map((p) => normalizeForMatch(p));

/**
 * Fait correspondre la saisie utilisateur a un nom canonique de metier DOFUS.
 *
 * Strategie de correspondance (par ordre de priorite) :
 *   1. Correspondance exacte apres normalisation
 *   2. Correspondance par prefixe (dans les deux sens)
 *   3. Correspondance par inclusion (dans les deux sens)
 *
 * @returns Nom canonique du metier, ou la saisie originale si aucune correspondance
 */
export function canonicalizeProfession(input: string): string {
  const norm = normalizeForMatch(input);
  let idx = PROFESSIONS_NORMALIZED.indexOf(norm);
  if (idx === -1) idx = PROFESSIONS_NORMALIZED.findIndex((p) => p.startsWith(norm) || norm.startsWith(p));
  if (idx === -1) idx = PROFESSIONS_NORMALIZED.findIndex((p) => p.includes(norm) || norm.includes(p));
  return idx !== -1 ? PROFESSIONS[idx] : input;
}

/**
 * Valide une liste de noms de metiers separes par des virgules ou retours a la ligne.
 *
 * @returns Objet contenant les noms canoniques valides et les entrees invalides
 */
export function validateProfessionList(raw: string): { valid: string[]; invalid: string[] } {
  const parsed = raw
    .split(/[,\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const invalid: string[] = [];
  const valid: string[] = [];

  for (const entry of parsed) {
    const norm = normalizeForMatch(entry);
    let idx = PROFESSIONS_NORMALIZED.indexOf(norm);
    if (idx === -1) idx = PROFESSIONS_NORMALIZED.findIndex((p) => p.startsWith(norm) || norm.startsWith(p));
    if (idx === -1) idx = PROFESSIONS_NORMALIZED.findIndex((p) => p.includes(norm) || norm.includes(p));
    if (idx === -1) {
      invalid.push(entry);
    } else {
      valid.push(PROFESSIONS[idx]);
    }
  }

  return { valid: [...new Set(valid)], invalid };
}
