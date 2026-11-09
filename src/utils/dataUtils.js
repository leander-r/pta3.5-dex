// ============================================================
// DATA CALCULATION UTILITIES
// ============================================================

import { GAME_DATA } from '../data/configs.js';
import { SPEED_STAGE_FLAT_PER_STAGE, STAB_BONUS, POINT_BUY_COSTS } from '../data/constants.js';

/**
 * Calculate stat modifier (PTA3: ⌊stat / 2⌋)
 */
export const calcModifier = (stat) => Math.floor((stat || 0) / 2);

/**
 * PTA3 point-buy: absolute cost (from a true zero baseline) to have a stat at `value`.
 * HB1 "Point Buy In" table: 1→1, 2→2, 3→3, 4→6, 5→8, 6→11 pts, extending flat beyond 6.
 * This is the RAW cost table itself — it is NOT a discount off some free starting value.
 */
export const getPointBuyCost = (value) => {
    if (value <= 0) return 0;
    return POINT_BUY_COSTS[Math.min(value, 6)] + Math.max(0, value - 6);
};

/**
 * Format number with commas
 */
export const formatNumber = (num) => (num || 0).toLocaleString();

/**
 * Apply nature to Pokémon stats (PTA3: ±1 on affected stat)
 */
export const applyNature = (baseStats, nature) => {
    const natureData = GAME_DATA.natures[nature];
    if (!natureData) return baseStats;

    let modifiedStats = { ...baseStats };
    if (natureData.buff) {
        modifiedStats[natureData.buff] = (baseStats[natureData.buff] || 0) + 1;
    }
    if (natureData.nerf) {
        modifiedStats[natureData.nerf] = Math.max(1, (baseStats[natureData.nerf] || 0) - 1);
    }
    return modifiedStats;
};

/**
 * Apply a Speed combat stage to the Speed stat (PTA3.5: flat ±5 per stage).
 * Speed is the only stat whose combat stages still modify the stat value directly — RAW:
 * "For each Speed▲ your Speed stat is +5. For each Speed▼ your Speed stat is -5."
 * Attack, Defense, Special Attack, and Special Defense stages no longer touch the stat at all;
 * see `getStageDiceDelta` for those.
 */
export const applySpeedCombatStage = (baseSpeed, stages) => {
    if (!stages) return baseSpeed || 0;
    return (baseSpeed || 0) + stages * SPEED_STAGE_FLAT_PER_STAGE;
};

/**
 * Get Speed combat stage flat change display (e.g. "+5", "-10")
 */
export const getSpeedCombatStageDelta = (stages) => {
    if (!stages) return '+0';
    return (stages > 0 ? '+' : '') + (stages * SPEED_STAGE_FLAT_PER_STAGE);
};

/**
 * Convert an Attack/Defense/Special Attack/Special Defense combat stage into a damage-dice delta
 * (PTA3.5). Each stage of the attacker's own Attack/SpAttack adds (▲) or removes (▼) one damage
 * die from their own attacks; RAW also has the target's opposing Defense/SpDefense stage
 * contribute a die the same way (Defense▼ on the target adds a die, Defense▲ removes one), but
 * this tool only tracks stages for whichever single Pokémon is selected — it has never modeled an
 * opposing target's stat separately, even under the old flat-stat rules (Defense/SpDefense stages
 * were tracked in combat-stage state but were never read by the damage roll). If target-side
 * Defense/SpDefense needs to factor into a roll, add/subtract it into `stages` manually before
 * calling this.
 */
export const getStageDiceDelta = (stages) => stages || 0;

/**
 * Calculate STAB bonus (PTA3: fixed +4, no level scaling)
 */
export const calculateSTAB = (_level) => STAB_BONUS;

/**
 * Get actual Pokémon stats with nature modifier applied (PTA3: ±1 nature, no addedStats)
 * Also layers on any permanent manual stat bonus (e.g. Breeder's Natural Edge, Evolver's
 * Peak Form) — these never affect HP per RAW.
 */
export const getActualStats = (pokemon) => {
    if (!pokemon) return { hp: 1, atk: 1, def: 1, satk: 1, sdef: 1, spd: 1 };

    const base = pokemon.baseStats || { hp: 30, atk: 5, def: 5, satk: 5, sdef: 5, spd: 5 };

    // Apply nature modifications (±1, PTA3 rules)
    const withNature = applyNature(base, pokemon.nature);

    const bonuses = pokemon.statBonuses || {};
    const result = { ...withNature };
    for (const stat of ['atk', 'def', 'satk', 'sdef', 'spd']) {
        result[stat] = (result[stat] || 0) + (bonuses[stat] || 0);
    }
    return result;
};

/**
 * Calculate Pokémon max HP (PTA3: HP is a fixed Pokédex stat, nature-adjusted)
 */
export const calculatePokemonHP = (pokemon) => {
    if (!pokemon) return 0;
    const actualStats = getActualStats(pokemon);
    return actualStats.hp;
};

/**
 * Parse dice notation string (e.g., "2d6+5", "3d12+14", "1d20")
 */
export const parseDice = (diceStr) => {
    if (!diceStr) return { count: 0, sides: 0, bonus: 0, flat: 0 };
    const diceMatch = diceStr.match(/(\d+)d(\d+)(?:\+(\d+))?/i);
    if (diceMatch) {
        return {
            count: parseInt(diceMatch[1]) || 0,
            sides: parseInt(diceMatch[2]) || 0,
            bonus: parseInt(diceMatch[3]) || 0,
            flat: 0,
        };
    }
    // Flat damage (e.g. Dragon Rage "25" — fixed damage, no dice)
    const flatMatch = diceStr.match(/^(\d+)$/);
    if (flatMatch) {
        return { count: 0, sides: 0, bonus: 0, flat: parseInt(flatMatch[1]) || 0 };
    }
    return { count: 0, sides: 0, bonus: 0, flat: 0 };
};

/**
 * Parse a move description for an extended crit range (e.g. "Critical Hit on 18-20").
 * Returns the lowest roll that counts as a crit (default 20).
 */
export const parseCritThreshold = (description = '') => {
    const text = description || '';
    // PTA3 format: "if you got 18 or higher on Accuracy Check"
    const pta3 = text.match(/(\d+)\s+or\s+higher\s+on\s+Accuracy\s+Check/i);
    if (pta3) return parseInt(pta3[1]);
    // Legacy format: "Critical Hit on 18-20"
    const legacy = text.match(/Critical Hit on (\d+)[-–]20/i);
    return legacy ? parseInt(legacy[1]) : 20;
};

/**
 * Parse an item's effect string for an HP heal formula.
 * Handles dice ("2d6+3 HP"), full restore ("Restores full HP"), fractions ("1/2 Max HP"),
 * and flat values ("Heals 10 HP", "Recovers 25 HP").
 * Returns { type: 'dice', formula } | { type: 'full' } | { type: 'fraction', num, denom }
 *       | { type: 'flat', amount } | { type: 'none' }
 */
export const parseHealFormula = (effectStr = '') => {
    const diceMatch = effectStr.match(/(\d+d\d+(?:\s*[+]\s*\d+)?)\s*HP/i);
    if (diceMatch) return { type: 'dice', formula: diceMatch[1].replace(/\s+/g, '') };
    const fullMatch = effectStr.match(/restores?\s+(?:full|max)\s+(?:max\s+)?HP/i);
    if (fullMatch) return { type: 'full' };
    const fracMatch = effectStr.match(/(\d+)\/(\d+)\s*Max\s*HP/i);
    if (fracMatch) return { type: 'fraction', num: parseInt(fracMatch[1]), denom: parseInt(fracMatch[2]) };
    const flatMatch = effectStr.match(/(?:heals?|recovers?)\s+(\d+)\s*HP/i);
    if (flatMatch) return { type: 'flat', amount: parseInt(flatMatch[1]) };
    return { type: 'none' };
};
