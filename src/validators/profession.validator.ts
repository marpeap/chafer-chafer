/**
 * @module validators/profession
 * @description Shared profession name validation and fuzzy matching for DOFUS professions.
 *
 * Used by:
 *   - A-members/modals.ts (professions200 edit — validate user input)
 *   - E-professions/modals.ts (profession enrollment + craft requests)
 *   - panel/modals.ts (metier search)
 *
 * Depends on: E-professions/commands.ts (canonical PROFESSIONS list)
 */

import { PROFESSIONS } from '../modules/E-professions/commands.js';

/**
 * Strip accents, apostrophes, and normalize whitespace for fuzzy matching.
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

/** Pre-computed normalized profession names for O(1) comparison */
const PROFESSIONS_NORMALIZED = PROFESSIONS.map((p) => normalizeForMatch(p));

/**
 * Match user input to a canonical DOFUS profession name.
 *
 * Matching strategy (in priority order):
 *   1. Exact match after normalization
 *   2. Prefix match (either direction)
 *   3. Contains match (either direction)
 *
 * @returns Canonical profession name, or the original input if no match found
 */
export function canonicalizeProfession(input: string): string {
  const norm = normalizeForMatch(input);
  let idx = PROFESSIONS_NORMALIZED.indexOf(norm);
  if (idx === -1) idx = PROFESSIONS_NORMALIZED.findIndex((p) => p.startsWith(norm) || norm.startsWith(p));
  if (idx === -1) idx = PROFESSIONS_NORMALIZED.findIndex((p) => p.includes(norm) || norm.includes(p));
  return idx !== -1 ? PROFESSIONS[idx] : input;
}

/**
 * Validate a comma/newline-separated list of profession names.
 *
 * @returns Object with validated canonical names and any invalid entries
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
