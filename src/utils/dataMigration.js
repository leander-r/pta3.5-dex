// ============================================================
// Data Migration — Old PTA format → PTA3 format
// ============================================================

import { getPointBuyCost } from './dataUtils.js';
import { CREATION_STAT_POINTS, MAX_PARTY_SIZE, MAX_TOTAL_MOVES } from '../data/constants.js';

/**
 * Size caps applied to a save payload crossing a trust boundary (file import).
 * These exist purely to stop a corrupt or malicious save file from injecting
 * unbounded strings/arrays into persisted state (localStorage quota exhaustion,
 * a hung render over a 100k-entry array, etc.) — NOT a full field-shape
 * validator. Values are intentionally generous; legitimate saves never get close.
 */
const IMPORT_SIZE_CAPS = {
    MAX_TRAINERS: 50,
    MAX_RESERVE: 500,
    MAX_INVENTORY: 2000,
    MAX_FEATURES: 200,
    MAX_SKILLS_KEYS: 100,
    MAX_NAME_LENGTH: 200,
    MAX_NOTES_LENGTH: 10000,
    MAX_CATALOG_ARRAY: 2000, // customSpecies / customMoves / customOrigins / npcs
};

const capString = (value, maxLength) =>
    typeof value === 'string' ? value.slice(0, maxLength) : value;

const capArray = (value, maxLength) =>
    Array.isArray(value) ? value.slice(0, maxLength) : value;

const capObjectKeys = (value, maxKeys) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const keys = Object.keys(value);
    if (keys.length <= maxKeys) return value;
    const capped = {};
    keys.slice(0, maxKeys).forEach(k => { capped[k] = value[k]; });
    return capped;
};

const capPokemon = (pokemon) => {
    if (!pokemon || typeof pokemon !== 'object') return pokemon;
    return {
        ...pokemon,
        name: capString(pokemon.name, IMPORT_SIZE_CAPS.MAX_NAME_LENGTH),
        species: capString(pokemon.species, IMPORT_SIZE_CAPS.MAX_NAME_LENGTH),
        notes: capString(pokemon.notes, IMPORT_SIZE_CAPS.MAX_NOTES_LENGTH),
        moves: capArray(pokemon.moves, MAX_TOTAL_MOVES),
        skills: capArray(pokemon.skills, IMPORT_SIZE_CAPS.MAX_SKILLS_KEYS),
    };
};

const capPokemonArray = (arr, maxLength) =>
    Array.isArray(arr) ? arr.slice(0, maxLength).map(capPokemon) : arr;

const capTrainer = (trainer) => {
    if (!trainer || typeof trainer !== 'object') return trainer;
    return {
        ...trainer,
        name: capString(trainer.name, IMPORT_SIZE_CAPS.MAX_NAME_LENGTH),
        notes: capString(trainer.notes, IMPORT_SIZE_CAPS.MAX_NOTES_LENGTH),
        party: capPokemonArray(trainer.party, MAX_PARTY_SIZE),
        reserve: capPokemonArray(trainer.reserve, IMPORT_SIZE_CAPS.MAX_RESERVE),
        features: capArray(trainer.features, IMPORT_SIZE_CAPS.MAX_FEATURES),
        skills: capObjectKeys(trainer.skills, IMPORT_SIZE_CAPS.MAX_SKILLS_KEYS),
        badges: capArray(trainer.badges, IMPORT_SIZE_CAPS.MAX_FEATURES),
    };
};

/**
 * Cap array/string sizes on a full save payload coming from a file import
 * (bulk multi-trainer or single-trainer). Safe to call on any format — this
 * runs independently of (and in addition to) the PTA3 rules migration.
 */
export const capImportedPayloadSizes = (data) => {
    if (!data || typeof data !== 'object') return data;
    return {
        ...data,
        trainers: Array.isArray(data.trainers)
            ? capArray(data.trainers, IMPORT_SIZE_CAPS.MAX_TRAINERS).map(capTrainer)
            : data.trainers,
        // Single-trainer export/import files use `trainer` (singular), not `trainers`.
        trainer: data.trainer ? capTrainer(data.trainer) : data.trainer,
        inventory: capArray(data.inventory, IMPORT_SIZE_CAPS.MAX_INVENTORY),
        customSpecies: capArray(data.customSpecies, IMPORT_SIZE_CAPS.MAX_CATALOG_ARRAY),
        customMoves: capArray(data.customMoves, IMPORT_SIZE_CAPS.MAX_CATALOG_ARRAY),
        customOrigins: capArray(data.customOrigins, IMPORT_SIZE_CAPS.MAX_CATALOG_ARRAY),
        npcs: capArray(data.npcs, IMPORT_SIZE_CAPS.MAX_CATALOG_ARRAY),
    };
};

/**
 * Detect if a save contains old-format trainer data (pre-PTA3).
 * Old format has stats.hp on trainers.
 */
export const isOldSaveFormat = (data) => {
    if (!data || !Array.isArray(data.trainers) || data.trainers.length === 0) return false;
    return data.trainers[0]?.stats?.hp !== undefined;
};

/**
 * Scale an old stat value (range ~6–30) to new PTA3 range (1–10).
 * Mapping: 6→2, 10→4, 14→6, 20→8, 30→10
 */
const scaleStatToNew = (oldStat) =>
    Math.min(10, Math.max(1, Math.round((oldStat || 6) / 2.5)));

/**
 * Normalize a move frequency string to PTA3 format.
 * "Battle - 2" / "EOT" → "3/day"
 * "Battle - 1"         → "1/day"
 * "At-Will"            → "At-Will" (unchanged)
 */
const normalizeMoveFrequency = (freq) => {
    if (!freq) return 'At-Will';
    const f = freq.trim();
    if (f === 'At-Will') return 'At-Will';
    if (f.startsWith('Battle - 1') || f === 'EOT') return '1/day';
    if (f.startsWith('Battle - 2') || f.startsWith('Battle -')) return '3/day';
    if (f === '1/day' || f === '3/day') return f;
    // Keep unknown frequencies unchanged
    return f;
};

/**
 * Migrate a single trainer from old format to PTA3 format.
 */
const migrateTrainer = (trainer) => {
    const oldStats = trainer.stats || {};

    // Scale the 5 remaining stats (drop hp)
    const newStats = {
        atk:  scaleStatToNew(oldStats.atk),
        def:  scaleStatToNew(oldStats.def),
        satk: scaleStatToNew(oldStats.satk),
        sdef: scaleStatToNew(oldStats.sdef),
        spd:  scaleStatToNew(oldStats.spd)
    };

    // Approximate honors = trainer level (1 honor per old level)
    const honors = trainer.level || 0;

    return {
        ...trainer,
        stats: newStats,
        maxHp: 20,
        hpRolls: [],
        honors,
        statPoints: Math.min(CREATION_STAT_POINTS, trainer.statPoints ?? CREATION_STAT_POINTS),
        classLevels: {},  // Will be initialised in DataContext.migrateOldData based on trainer.level
    };
};

/**
 * Migrate a single Pokémon from old format to PTA3 format.
 */
const migratePokemon = (pokemon) => {
    const base = pokemon.baseStats || {};
    const added = pokemon.addedStats || {};

    // Merge base + addedStats into unified baseStats
    const mergedStats = {
        hp:   (base.hp   || 0) + (added.hp   || 0),
        atk:  (base.atk  || 0) + (added.atk  || 0),
        def:  (base.def  || 0) + (added.def  || 0),
        satk: (base.satk || 0) + (added.satk || 0),
        sdef: (base.sdef || 0) + (added.sdef || 0),
        spd:  (base.spd  || 0) + (added.spd  || 0)
    };

    // Normalize move frequencies
    const normalizedMoves = (pokemon.moves || []).map(m => ({
        ...m,
        frequency: normalizeMoveFrequency(m.frequency)
    }));

    // Remove old stat allocation fields
    const {
        addedStats,
        statAllocationHistory,
        statPointsAvailable,
        ...rest
    } = pokemon;

    return {
        ...rest,
        baseStats: mergedStats,
        moves: normalizedMoves
    };
};

/**
 * Strip string entries from trainer.features that are not in the known PTA3 features dict.
 * Object entries (custom/stat-boost features) are always kept.
 * Safe to call on any save format.
 *
 * @param {Object} data         - Full save payload
 * @param {Object} knownFeatures - GAME_DATA.features dict (keys = feature names)
 * @returns {{ data: Object, cleaned: boolean }}
 */
export const cleanupLegacyFeatures = (data, knownFeatures = {}) => {
    if (!data?.trainers) return { data, cleaned: false };
    let anyChanged = false;
    const trainers = data.trainers.map(trainer => {
        if (!Array.isArray(trainer.features) || trainer.features.length === 0) return trainer;
        const filtered = trainer.features.filter(f => {
            if (typeof f !== 'string') return true;      // always keep object features
            return knownFeatures[f] !== undefined;        // keep known PTA3 features only
        });
        if (filtered.length === trainer.features.length) return trainer;
        anyChanged = true;
        return { ...trainer, features: filtered };
    });
    if (!anyChanged) return { data, cleaned: false };
    return { data: { ...data, trainers }, cleaned: true };
};

/**
 * Fix a stat-point accounting bug: trainers created before this fix had `statPoints`
 * tracked as a delta off the default (3/3/3/3/3) stat spread without ever charging for
 * that starting spread itself, so the pool didn't match the HB1 Point Buy In table's
 * absolute costs. This recomputes `statPoints` from the trainer's current stats using
 * the correct absolute formula. Only touches trainers still at Level 0 (mid-creation) —
 * once a trainer has leveled past creation, its stored value is inert and left alone.
 * Idempotent and safe to run on every load.
 *
 * @param {Object} data - Full save payload (trainers, activeTrainerId, inventory, …)
 * @returns {{ data: Object, fixed: boolean }}
 */
export const fixStatPointAccounting = (data) => {
    if (!data?.trainers) return { data, fixed: false };
    let anyChanged = false;
    const trainers = data.trainers.map(trainer => {
        if (trainer.level !== 0 || !trainer.stats) return trainer;
        const spent = ['atk', 'def', 'satk', 'sdef', 'spd']
            .reduce((sum, key) => sum + getPointBuyCost(trainer.stats[key] || 1), 0);
        const correctRemaining = Math.max(0, CREATION_STAT_POINTS - spent);
        if (correctRemaining === trainer.statPoints) return trainer;
        anyChanged = true;
        return { ...trainer, statPoints: correctRemaining };
    });
    if (!anyChanged) return { data, fixed: false };
    return { data: { ...data, trainers }, fixed: true };
};

/**
 * Migrate a full save payload from old PTA format to PTA3 format.
 * Safe to call even on new-format saves (no-op).
 *
 * @param {Object} data - Full save payload (trainers, activeTrainerId, inventory, …)
 * @returns {{ data: Object, migrated: boolean }}
 */
export const migrateSaveData = (data) => {
    if (!isOldSaveFormat(data)) {
        return { data, migrated: false };
    }

    const migratedTrainers = (data.trainers || []).map(trainer => {
        const migratedTrainer = migrateTrainer(trainer);
        migratedTrainer.party   = (trainer.party   || []).map(migratePokemon);
        migratedTrainer.reserve = (trainer.reserve || []).map(migratePokemon);
        return migratedTrainer;
    });

    return {
        data: { ...data, trainers: migratedTrainers, _migrated: true },
        migrated: true
    };
};
