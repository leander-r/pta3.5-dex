// ============================================================
// SHARED CONSTANTS
// ============================================================

/**
 * Evolution stones available in PTA
 */
export const EVOLUTION_STONES = [
    'Fire Stone', 'Water Stone', 'Thunder Stone', 'Leaf Stone', 'Moon Stone',
    'Sun Stone', 'Shiny Stone', 'Dusk Stone', 'Dawn Stone', 'Ice Stone'
];

/**
 * Default trainer template for new trainers (PTA3 rules)
 */
export const DEFAULT_TRAINER = {
    id: Date.now(),
    name: '',
    gender: '',
    age: '',
    avatar: '',
    level: 0,
    honors: 0,             // Replaces experience; honors = gym badges, ribbons, etc.
    origin: '',                // Trainer Origin (HB1 pp. 90-99), e.g. 'Academic', 'Backpacker'
    originSkills: [],           // Skill talents actually granted by the chosen Origin (excludes any already Talented from elsewhere)
    originFeatureGranted: false, // Whether the Origin is what added its feature (false if the trainer already had it, e.g. from a Class)
    classes: [],
    stats: { atk: 3, def: 3, satk: 3, sdef: 3, spd: 3 },  // 5 stats, 1-10 scale, mid-range default
    maxHp: 20,             // Fixed base HP; increases via rolls at milestone levels
    hpRolls: [],           // 1d4 results added at levels 3, 7, 11
    // Character creation points remaining (PHB1 Point Buy In: absolute cost table, 30-pt budget).
    // The default stat spread above (3/3/3/3/3) already costs 5×3=15 of that 30-pt budget under
    // the RAW cost table, so only 30-15=15 points start out unspent — NOT the full 30.
    statPoints: 15,
    levelStatPoints: 0,    // Level-up stat points (no cap)
    levelStatAllocations: [],  // Stats already raised with level points in current batch (enforces "two different stats" rule)
    classLevels: {},           // Per-class level tracker: { 'Ace Trainer': 3, 'Stat Ace': 1 }
    primaryBaseClass: '',      // First base class ever taken — only one to receive Level 15 feature
    secondaryBaseClasses: [],  // Base classes taken as 2nd/3rd slot (1 talent, no Lv15 feature)
    featureDropsUsed: 0,       // How many features have been dropped for +1 stat (max 4)
    skills: {},                // Skills with talents: { 'Athletics': 1, 'Stealth': 2 }
    features: [],
    notes: '',
    badges: [],
    money: 0,
    equippedItems: [],     // string[] — item names currently equipped
    dailyBonusUsed: '',    // string — name of the one item whose bonus was used today
    currentDamage: 0,      // Damage taken; currentHp = maxHp − currentDamage
    party: [],             // Active party - max 6 Pokemon
    reserve: [],           // Reserve/PC storage - unlimited
    archived: false        // Soft-delete: archived trainers are hidden but recoverable
};

/**
 * Default Pokemon template for new Pokemon (PTA3 rules)
 * Stats are now fixed from Pokédex entry; no addedStats or stat allocation.
 */
export const DEFAULT_POKEMON = {
    id: Date.now(),
    name: 'New Pokémon',
    species: '',
    gender: '',
    avatar: '',
    types: [],
    nature: 'Hardy',
    ability: '',
    baseStats: {
        hp: 30,
        atk: 5,
        def: 5,
        satk: 5,
        sdef: 5,
        spd: 5
    },
    moves: [],
    skills: [],   // Array of capability/skill strings e.g. ["Sprouter", "Threaded"]
    notes: '',
    loyalty: 2,
    heldItem: '',
    tempStatBoosts: {},     // Temporary stat boosts from X items / battle berries; keyed by stat
    statBonuses: { atk: 0, def: 0, satk: 0, sdef: 0, spd: 0 }, // Permanent manual bonuses (e.g. Breeder's Natural Edge, Evolver's Peak Form)
    specialForm: null,      // null | 'alpha' | 'totem' | 'titan' — special encounter form
    specialFormDefStat: 'def', // Which defense is raised to 15 in Alpha/Totem form
    teraType: '',  // Tera Type: stored permanently on Pokémon (like nature/ability)
    isShiny: false // Cosmetic — no stat effects (GMG p.37)
};

/**
 * Application tab identifiers
 */
export const TABS = {
    TRAINER: 'trainer',
    POKEMON: 'pokemon',
    INVENTORY: 'inventory',
    BATTLE: 'battle',
    REFERENCE: 'reference',
    NOTES: 'notes',
    GM: 'gm'
};

/**
 * Reference sub-tab identifiers
 */
export const REFERENCE_TABS = {
    TYPES: 'types',
    MOVES: 'moves',
    ABILITIES: 'abilities',
    FEATURES: 'features'
};

/**
 * Pokemon view modes
 */
export const POKEMON_VIEW = {
    PARTY: 'party',
    RESERVE: 'reserve'
};

/**
 * Maximum feature drops (swap a gained feature for +1 stat) per trainer career
 */
export const MAX_FEATURE_DROPS = 4;

/**
 * Maximum party size
 */
export const MAX_PARTY_SIZE = 6;

/**
 * Maximum trainer level (PTA3: honor-based leveling, max 15)
 */
export const MAX_TRAINER_LEVEL = 15;

/**
 * Base stat value for new trainers (PTA3: 1-10 scale)
 */
export const BASE_STAT_VALUE = 1;

/**
 * Character creation stat points (PTA3.5 point-buy budget)
 */
export const CREATION_STAT_POINTS = 30;

/**
 * Character creation stat cap (PTA3: max 6 at creation)
 */
export const CREATION_STAT_CAP = 6;

/**
 * Network fetch timeout (milliseconds)
 */
export const FETCH_TIMEOUT_MS = 15000;

/**
 * Maximum full trainer data import file size (5 MB)
 */
export const MAX_TRAINER_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * Maximum single-Pokemon import file size (100 KB)
 */
export const MAX_POKEMON_IMPORT_BYTES = 100 * 1024;

/**
 * Maximum total moves a Pokemon can have (PTA3: 6 total, no natural/taught distinction)
 */
export const MAX_TOTAL_MOVES = 6;

/**
 * Maximum number of roll entries kept in battle roll history
 */
export const MAX_ROLL_HISTORY = 50;

/**
 * Item types that can be equipped from the Trainer tab / Inventory
 */
export const EQUIPPABLE_ITEM_TYPES = ['clothing', 'armor', 'weapon', 'accessory'];

/**
 * Flat Speed stat added per Speed combat stage (PTA3.5: +5 per stage, applies to both + and -).
 * Speed is the only stat whose combat stages still modify the stat directly — Attack, Defense,
 * Special Attack, and Special Defense stages instead add/remove damage dice (see
 * `applyAttackStageDice` in dataUtils.js). There is no flat-stat constant for those four.
 */
export const SPEED_STAGE_FLAT_PER_STAGE = 5;

/**
 * STAB bonus (PTA3: fixed +4, no level scaling)
 */
export const STAB_BONUS = 4;

/**
 * Milliseconds in one day — used for backup-reminder age calculations
 */
export const MS_PER_DAY = 86_400_000;

/**
 * Number of days between exports before the backup reminder is shown
 */
export const BACKUP_REMINDER_DAYS = 7;

/**
 * Minimum trainer level required to pick a 2nd class (PTA3)
 */
export const CLASS_2_MIN_LEVEL = 3;

/**
 * Minimum trainer level required to pick a 3rd class (PTA3)
 */
export const CLASS_3_MIN_LEVEL = 7;

/**
 * Minimum trainer level required to pick a 4th class (PTA3)
 */
export const CLASS_4_MIN_LEVEL = 11;

/**
 * Honor (gym badge/ribbon) thresholds for each trainer level (PTA3).
 * Key = level, value = honors required to reach that level.
 */
export const HONOR_THRESHOLDS = {
    1: 0, 2: 1, 3: 2, 4: 3, 5: 5, 6: 7, 7: 9, 8: 12, 9: 15, 10: 18,
    11: 22, 12: 26, 13: 30, 14: 35, 15: 40
};

/**
 * Trainer levels at which an HP milestone roll (1d4) is granted (PTA3)
 */
export const HP_MILESTONE_LEVELS = [3, 7, 11];

/**
 * Point-buy costs for each stat value during character creation (PTA3).
 * Stat 1 costs 1 pt, stat 2 costs 2 pts (total), etc.
 * These are CUMULATIVE costs from 1 to each level.
 */
export const POINT_BUY_COSTS = { 1: 1, 2: 2, 3: 3, 4: 6, 5: 8, 6: 11 };

/**
 * Auto-save debounce delay (ms) — how long to wait after a data change before saving
 */
export const AUTOSAVE_DEBOUNCE_MS = 1000;

/**
 * Auto-save interval (ms) — periodic save regardless of debounce
 */
export const AUTOSAVE_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Z-Move table — keyed by type, each dealing 8d12 damage, 1/day.
 */
export const Z_MOVE_TABLE = {
    Normal:   { name: 'Breakneck Blitz',       range: 'Melee (25ft burst)',        damage: '8d12', category: 'Physical' },
    Fighting: { name: 'All-Out Pummeling',      range: 'Melee (25ft burst)',        damage: '8d12', category: 'Physical' },
    Flying:   { name: 'Supersonic Skystrike',   range: 'Melee (25ft burst)',        damage: '8d12', category: 'Physical' },
    Poison:   { name: 'Acid Downpour',          range: 'Ranged (60ft, 20ft blast)', damage: '8d12', category: 'Physical' },
    Ground:   { name: 'Tectonic Rage',          range: 'Ranged (60ft, 20ft blast)', damage: '8d12', category: 'Physical' },
    Rock:     { name: 'Continental Crush',      range: 'Ranged (60ft, 20ft blast)', damage: '8d12', category: 'Physical' },
    Bug:      { name: 'Savage Spin Out',        range: 'Melee (25ft burst)',        damage: '8d12', category: 'Physical' },
    Ghost:    { name: 'Never-Ending Nightmare', range: 'Ranged (60ft, 20ft blast)', damage: '8d12', category: 'Special'  },
    Steel:    { name: 'Corkscrew Crash',        range: 'Melee (25ft burst)',        damage: '8d12', category: 'Physical' },
    Fire:     { name: 'Inferno Overdrive',      range: 'Ranged (60ft, 20ft blast)', damage: '8d12', category: 'Special'  },
    Water:    { name: 'Hydro Vortex',           range: 'Ranged (60ft, 20ft blast)', damage: '8d12', category: 'Special'  },
    Grass:    { name: 'Bloom Doom',             range: 'Ranged (60ft, 20ft blast)', damage: '8d12', category: 'Special'  },
    Electric: { name: 'Gigavolt Havoc',         range: 'Ranged (60ft, 20ft blast)', damage: '8d12', category: 'Special'  },
    Psychic:  { name: 'Shattered Psyche',       range: 'Ranged (60ft, 20ft blast)', damage: '8d12', category: 'Special'  },
    Ice:      { name: 'Subzero Slammer',        range: 'Ranged (60ft, 20ft blast)', damage: '8d12', category: 'Special'  },
    Dragon:   { name: 'Devastating Drake',      range: 'Melee (25ft burst)',        damage: '8d12', category: 'Special'  },
    Dark:     { name: 'Black Hole Eclipse',     range: 'Ranged (60ft, 20ft blast)', damage: '8d12', category: 'Physical' },
    Fairy:    { name: 'Twinkle Tackle',         range: 'Melee (25ft burst)',        damage: '8d12', category: 'Special'  },
};

/**
 * Max Move table — keyed by type, used during Dynamax.
 * All Max Moves: Ranged 80ft 30ft blast, At-Will, 4d12. Secondary effect differs per type.
 */
export const MAX_MOVE_TABLE = {
    Bug:      { name: 'Max Flutterby',  effect: 'All targets SAtk −1 for 2 mins. Trainer cannot act next round.' },
    Dark:     { name: 'Max Darkness',   effect: 'All targets SDef −1 for 2 mins. Trainer cannot act next round.' },
    Dragon:   { name: 'Max Wyrmwind',   effect: 'All targets Atk −1 for 2 mins. Trainer cannot act next round.' },
    Electric: { name: 'Max Lightning',  effect: 'Creates Electrified Terrain (60ft, 2 mins). Prevents Sleep.' },
    Fairy:    { name: 'Max Starfall',   effect: 'Creates Misty Terrain (60ft, 2 mins). Dragon resisted, no afflictions.' },
    Fighting: { name: 'Max Knuckle',    effect: 'All allies within 60ft get Atk +1 for 2 mins.' },
    Fire:     { name: 'Max Flare',      effect: 'Creates Sunny Weather (60ft, 2 mins). Fire +8 dmg, Water −8 dmg.' },
    Flying:   { name: 'Max Airstream',  effect: 'All allies within 60ft get Spd +1 for 2 mins.' },
    Ghost:    { name: 'Max Phantasm',   effect: 'All targets Def −1 for 2 mins.' },
    Grass:    { name: 'Max Overgrowth', effect: 'Creates Grassy Terrain (60ft, 2 mins). Allies recover 1d12 HP after acting.' },
    Ground:   { name: 'Max Quake',      effect: 'All allies within 60ft get SDef +1 for 2 mins.' },
    Ice:      { name: 'Max Hailstorm',  effect: 'Creates Hailing Weather (60ft, 2 mins). All take 2d4 dmg/turn except Ice.' },
    Normal:   { name: 'Max Strike',     effect: 'All targets Spd −1 for 2 mins.' },
    Poison:   { name: 'Max Ooze',       effect: 'All allies within 60ft get SAtk +1 for 2 mins.' },
    Psychic:  { name: 'Max Mindstorm',  effect: 'Creates Psychic Terrain (60ft, 2 mins). No Priority/Reaction moves.' },
    Rock:     { name: 'Max Rockfall',   effect: 'Creates Sandstorm (60ft, 2 mins). All take 2d4 dmg/turn except Rock/Ground/Steel.' },
    Steel:    { name: 'Max Steelspike', effect: 'All allies within 60ft get Def +1 for 2 mins.' },
    Water:    { name: 'Max Geyser',     effect: 'Creates Raining Weather (60ft, 2 mins). Water +8 dmg, Fire −8 dmg.' },
};

/**
 * Tera Crown table — keyed by type.
 * Each entry grants a skill and an At-Will move when Terastallized.
 */
export const TERA_CROWN_TABLE = {
    Bug:      { skill: 'Threaded',     move: 'Struggling Bug',  range: 'Ranged (20ft)', damage: '2d6',  category: 'Special'  },
    Dark:     { skill: 'Stealth',      move: 'Brutal Hit',      range: 'Melee',         damage: '2d6',  category: 'Physical' },
    Dragon:   { skill: 'Guster',       move: 'Twisting Gust',   range: 'Ranged (20ft)', damage: '1d12', category: 'Special'  },
    Electric: { skill: 'Zapper',       move: 'Thunder Spark',   range: 'Ranged (20ft)', damage: '1d12', category: 'Special'  },
    Fairy:    { skill: 'Alluring',     move: 'Fairy Wind',      range: 'Ranged (20ft)', damage: '1d12', category: 'Special'  },
    Fighting: { skill: 'Strength',     move: 'Karate Slap',     range: 'Melee',         damage: '2d6',  category: 'Physical' },
    Fire:     { skill: 'Firestarter',  move: 'Emberish',        range: 'Ranged (20ft)', damage: '1d12', category: 'Special'  },
    Flying:   { skill: 'Flight',       move: 'Air Dart',        range: 'Ranged (10ft)', damage: '2d6',  category: 'Physical' },
    Ghost:    { skill: 'Invisibility', move: 'Spook',           range: 'Melee',         damage: '2d6',  category: 'Physical' },
    Grass:    { skill: 'Sprouter',     move: 'Leafage',         range: 'Ranged (20ft)', damage: '1d12', category: 'Special'  },
    Ground:   { skill: 'Burrow',       move: 'Mud Throw',       range: 'Ranged (20ft)', damage: '2d6',  category: 'Special'  },
    Ice:      { skill: 'Freezer',      move: 'Icy Breeze',      range: 'Ranged (20ft)', damage: '2d6',  category: 'Special'  },
    Normal:   { skill: 'Climber',      move: 'Tackle',          range: 'Melee',         damage: '2d6',  category: 'Physical' },
    Poison:   { skill: 'Repulsive',    move: 'Clearing Smog',   range: 'Ranged (20ft)', damage: '1d12', category: 'Special'  },
    Psychic:  { skill: 'Telekinetic',  move: 'Confusioning',    range: 'Ranged (20ft)', damage: '1d12', category: 'Special'  },
    Rock:     { skill: 'Groundshaper', move: 'Rock Throw',      range: 'Ranged (20ft)', damage: '2d6',  category: 'Physical' },
    Steel:    { skill: 'Magnetic',     move: 'Metal Cut',       range: 'Melee',         damage: '2d6',  category: 'Physical' },
    Water:    { skill: 'Fountain',     move: 'Water Gun',       range: 'Ranged (20ft)', damage: '2d6',  category: 'Special'  },
};
