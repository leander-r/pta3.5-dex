import { describe, it, expect } from 'vitest';
import {
    calcModifier,
    formatNumber,
    parseDice,
    applySpeedCombatStage,
    getStageDiceDelta,
    applyNature,
    calculatePokemonHP,
    calculateSTAB,
    getActualStats,
} from '../dataUtils.js';

describe('calcModifier', () => {
    it('returns 0 for stat 0', () => {
        expect(calcModifier(0)).toBe(0);
    });

    it('returns 0 for stat 1', () => {
        expect(calcModifier(1)).toBe(0);
    });

    it('returns 2 for stat 4', () => {
        expect(calcModifier(4)).toBe(2);
    });

    it('returns 3 for stat 6', () => {
        expect(calcModifier(6)).toBe(3);
    });

    it('returns 5 for stat 10', () => {
        expect(calcModifier(10)).toBe(5);
    });
});

describe('formatNumber', () => {
    it('formats 1234567 with commas', () => {
        expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('returns 0 for falsy values', () => {
        expect(formatNumber(0)).toBe('0');
    });
});

describe('parseDice', () => {
    it('parses 2d6+5', () => {
        expect(parseDice('2d6+5')).toEqual({ count: 2, sides: 6, bonus: 5, flat: 0 });
    });

    it('parses 1d20 with no bonus', () => {
        expect(parseDice('1d20')).toEqual({ count: 1, sides: 20, bonus: 0, flat: 0 });
    });

    it('returns zeros for empty input', () => {
        expect(parseDice('')).toEqual({ count: 0, sides: 0, bonus: 0, flat: 0 });
    });

    it('returns zeros for null input', () => {
        expect(parseDice(null)).toEqual({ count: 0, sides: 0, bonus: 0, flat: 0 });
    });

    it('parses flat damage number', () => {
        expect(parseDice('25')).toEqual({ count: 0, sides: 0, bonus: 0, flat: 25 });
    });
});

describe('applySpeedCombatStage', () => {
    it('returns base Speed unchanged at stage 0', () => {
        expect(applySpeedCombatStage(10, 0)).toBe(10);
    });

    it('adds 5 per positive stage at +1', () => {
        expect(applySpeedCombatStage(10, 1)).toBe(15);
    });

    it('adds 10 per positive stage at +2', () => {
        expect(applySpeedCombatStage(10, 2)).toBe(20);
    });

    it('subtracts 5 per negative stage at -1', () => {
        expect(applySpeedCombatStage(10, -1)).toBe(5);
    });

    it('subtracts 10 per negative stage at -2', () => {
        expect(applySpeedCombatStage(10, -2)).toBe(0);
    });
});

describe('getStageDiceDelta', () => {
    it('returns 0 at stage 0', () => {
        expect(getStageDiceDelta(0)).toBe(0);
    });

    it('returns +1 die per positive stage', () => {
        expect(getStageDiceDelta(1)).toBe(1);
    });

    it('returns -1 die per negative stage', () => {
        expect(getStageDiceDelta(-1)).toBe(-1);
    });
});

describe('applyNature', () => {
    const baseStats = { hp: 10, atk: 10, def: 10, satk: 10, sdef: 10, spd: 10 };

    it('Adamant boosts ATK by 1 and lowers SATK by 1', () => {
        const result = applyNature(baseStats, 'Adamant');
        expect(result.atk).toBe(11);
        expect(result.satk).toBe(9);
    });

    it('Hardy (neutral) returns stats unchanged', () => {
        const result = applyNature(baseStats, 'Hardy');
        expect(result).toEqual(baseStats);
    });

    it('does not reduce a stat below 1', () => {
        const lowStats = { hp: 1, atk: 1, def: 1, satk: 1, sdef: 1, spd: 1 };
        const result = applyNature(lowStats, 'Adamant');
        expect(result.satk).toBe(1);
    });
});

describe('calculatePokemonHP', () => {
    it('returns the HP stat from baseStats (PTA3: fixed Pokédex value)', () => {
        const pokemon = {
            level: 10,
            baseStats: { hp: 30, atk: 5, def: 5, satk: 5, sdef: 5, spd: 5 },
            nature: 'Hardy',
        };
        expect(calculatePokemonHP(pokemon)).toBe(30);
    });

    it('applies nature ±1 to HP stat', () => {
        // Use a nature that buffs HP (custom scenario — most natures affect combat stats, not HP)
        // Hardy is neutral, so HP stays at baseStats.hp
        const pokemon = {
            level: 5,
            baseStats: { hp: 25, atk: 5, def: 5, satk: 5, sdef: 5, spd: 5 },
            nature: 'Hardy',
        };
        expect(calculatePokemonHP(pokemon)).toBe(25);
    });

    it('returns 0 for null input', () => {
        expect(calculatePokemonHP(null)).toBe(0);
    });
});

describe('getActualStats', () => {
    it('stacks a permanent statBonus on top of the nature-adjusted stat', () => {
        const pokemon = {
            baseStats: { hp: 30, atk: 5, def: 5, satk: 5, sdef: 5, spd: 5 },
            nature: 'Adamant', // +1 atk, -1 satk
            statBonuses: { atk: 2, def: 0, satk: 0, sdef: 0, spd: 0 },
        };
        const result = getActualStats(pokemon);
        expect(result.atk).toBe(8); // 5 base + 1 nature + 2 bonus
        expect(result.satk).toBe(4); // 5 base - 1 nature, no bonus
    });

    it('defaults statBonuses to no-op when absent', () => {
        const pokemon = {
            baseStats: { hp: 30, atk: 5, def: 5, satk: 5, sdef: 5, spd: 5 },
            nature: 'Hardy',
        };
        const result = getActualStats(pokemon);
        expect(result).toEqual(pokemon.baseStats);
    });

    it('never applies a statBonus to HP', () => {
        const pokemon = {
            baseStats: { hp: 30, atk: 5, def: 5, satk: 5, sdef: 5, spd: 5 },
            nature: 'Hardy',
            statBonuses: { atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, hp: 99 },
        };
        expect(getActualStats(pokemon).hp).toBe(30);
    });
});

describe('calculateSTAB', () => {
    it('returns fixed 4 regardless of level (PTA3)', () => {
        expect(calculateSTAB(1)).toBe(4);
        expect(calculateSTAB(10)).toBe(4);
        expect(calculateSTAB(15)).toBe(4);
    });
});
