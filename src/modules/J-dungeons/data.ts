export interface DungeonInfo {
  name: string;
  level: number;
  category: string;
}

/** Comprehensive list of Dofus dungeons by level range */
export const DUNGEONS: DungeonInfo[] = [
  // Incarnam & Astrub (1-30)
  { name: 'Donjon des Bouftous', level: 10, category: 'Incarnam' },
  { name: 'Donjon des Larves', level: 14, category: 'Incarnam' },
  { name: 'Donjon des Tofus', level: 20, category: 'Astrub' },
  { name: 'Donjon des Squelettes', level: 25, category: 'Astrub' },
  { name: 'Donjon des Bworks', level: 30, category: 'Astrub' },

  // Amakna & Îles (20-60)
  { name: 'Donjon des Scarafeuilles', level: 20, category: 'Amakna' },
  { name: 'Château du Wa Wabbit', level: 30, category: 'Wabbit' },
  { name: 'Donjon des Blops', level: 40, category: 'Amakna' },
  { name: 'Donjon des Forgerons', level: 40, category: 'Amakna' },
  { name: 'Repaire de Skeunk', level: 50, category: 'Amakna' },
  { name: 'Donjon des Rats', level: 60, category: 'Brakmar' },
  { name: 'Terrier du Wa Wabbit', level: 50, category: 'Wabbit' },
  { name: 'Donjon des Champs', level: 30, category: 'Amakna' },

  // Mid-level (60-100)
  { name: 'Donjon des Dragoeufs', level: 60, category: 'Amakna' },
  { name: 'Donjon des Fungus', level: 70, category: 'Bonta' },
  { name: 'Antre du Dragon Cochon', level: 80, category: 'Amakna' },
  { name: 'Laboratoire de Grougalorasalar', level: 80, category: 'Otomaï' },
  { name: 'Donjon du Minotoror', level: 100, category: 'Amakna' },
  { name: 'Donjon des Canidés', level: 90, category: 'Amakna' },
  { name: 'Donjon des Kitsounes', level: 90, category: 'Pandala' },

  // Pandala & Otomaï (80-120)
  { name: 'Temple de Dojo', level: 80, category: 'Pandala' },
  { name: 'Donjon des Firefoux', level: 100, category: 'Pandala' },
  { name: 'Donjon des Kimbo', level: 110, category: 'Otomaï' },
  { name: 'Arbre de Moon', level: 100, category: 'Moon' },
  { name: 'Donjon du Koulosse', level: 120, category: 'Otomaï' },

  // Frigost 1 (100-140)
  { name: 'Donjon des Gélées', level: 100, category: 'Frigost' },
  { name: 'Donjon des Pingouins', level: 110, category: 'Frigost' },
  { name: 'Donjon du Mansot Royal', level: 120, category: 'Frigost' },
  { name: 'Donjon des Obsidiantre', level: 130, category: 'Frigost' },

  // Frigost 2 (130-160)
  { name: 'Donjon de Bethel Akarna', level: 140, category: 'Frigost' },
  { name: 'Donjon du Craqueleur', level: 140, category: 'Frigost' },
  { name: 'Donjon des Korriandres', level: 150, category: 'Frigost' },

  // Frigost 3 (150-190)
  { name: 'Donjon du Comte Harebourg', level: 190, category: 'Frigost' },
  { name: 'Donjon de Sylargh', level: 170, category: 'Frigost' },
  { name: 'Donjon du Nileza', level: 160, category: 'Frigost' },
  { name: 'Donjon du Klime', level: 180, category: 'Frigost' },

  // Dimensions (180-200)
  { name: 'Donjon Srambad', level: 190, category: 'Dimensions' },
  { name: 'Donjon Xélorium', level: 190, category: 'Dimensions' },
  { name: 'Donjon Ecaflipus', level: 190, category: 'Dimensions' },
  { name: 'Donjon Enurado', level: 190, category: 'Dimensions' },

  // Endgame (190-200)
  { name: 'Donjon du Merkator', level: 200, category: 'Endgame' },
  { name: 'Donjon du Vortex', level: 200, category: 'Endgame' },
  { name: 'Donjon de Missiz Frizz', level: 200, category: 'Endgame' },
  { name: 'Donjon d\'Ilyzaelle', level: 200, category: 'Endgame' },
  { name: 'Donjon Solaire', level: 200, category: 'Endgame' },
  { name: 'Donjon Lunaire', level: 200, category: 'Endgame' },
  { name: 'Reine des Voleurs', level: 200, category: 'Endgame' },
  { name: 'Donjon du Catseye', level: 200, category: 'Endgame' },
  { name: 'Donjon du Dark Vlad', level: 200, category: 'Endgame' },
  { name: 'Puits des Songes Infinis', level: 200, category: 'Endgame' },
  { name: 'Donjon de Tal Kasha', level: 200, category: 'Endgame' },
  { name: 'Songe de Draconiros', level: 200, category: 'Endgame' },

  // Osamodas Island / Other
  { name: 'Donjon des Cawettes', level: 60, category: 'Autre' },
  { name: 'Donjon du Wabbit', level: 80, category: 'Wabbit' },
  { name: 'Donjon de la Mine de Sakaï', level: 110, category: 'Otomaï' },
  { name: 'Donjon des Crocos', level: 60, category: 'Amakna' },
  { name: 'Donjon des Pirats', level: 80, category: 'Amakna' },
];

/** Group dungeons by category */
export function getDungeonsByCategory(): Map<string, DungeonInfo[]> {
  const map = new Map<string, DungeonInfo[]>();
  for (const d of DUNGEONS) {
    const list = map.get(d.category) || [];
    list.push(d);
    map.set(d.category, list);
  }
  // Sort each category by level
  for (const [, list] of map) {
    list.sort((a, b) => a.level - b.level);
  }
  return map;
}
