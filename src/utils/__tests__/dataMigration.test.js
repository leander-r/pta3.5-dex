// ============================================================
// Data Migration Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
    isOldSaveFormat,
    migrateSaveData,
    cleanupLegacyFeatures,
    fixStatPointAccounting,
    capImportedPayloadSizes,
} from '../dataMigration.js';

// ── isOldSaveFormat ──────────────────────────────────────────

describe('isOldSaveFormat', () => {
    it('detects old format via stats.hp on the first trainer', () => {
        const data = { trainers: [{ stats: { hp: 10, atk: 8 } }] };
        expect(isOldSaveFormat(data)).toBe(true);
    });

    it('returns false for PTA3 format (no stats.hp)', () => {
        const data = { trainers: [{ stats: { atk: 3, def: 3, satk: 3, sdef: 3, spd: 3 } }] };
        expect(isOldSaveFormat(data)).toBe(false);
    });

    it('returns false when trainers array is empty', () => {
        expect(isOldSaveFormat({ trainers: [] })).toBe(false);
    });

    it('returns false for missing/malformed data', () => {
        expect(isOldSaveFormat(null)).toBe(false);
        expect(isOldSaveFormat({})).toBe(false);
        expect(isOldSaveFormat({ trainers: 'not-an-array' })).toBe(false);
    });
});

// ── migrateSaveData ──────────────────────────────────────────

describe('migrateSaveData', () => {
    it('is a no-op on already-migrated (PTA3) data', () => {
        const data = {
            trainers: [{ stats: { atk: 3, def: 3, satk: 3, sdef: 3, spd: 3 } }],
        };
        const result = migrateSaveData(data);
        expect(result.migrated).toBe(false);
        expect(result.data).toBe(data); // same reference — untouched
    });

    it('is idempotent: running twice produces the same result as running once', () => {
        const oldData = {
            trainers: [{
                stats: { hp: 10, atk: 14, def: 10, satk: 20, sdef: 6, spd: 30 },
                level: 5,
                experience: 1200,
            }],
        };
        const once = migrateSaveData(oldData);
        const twice = migrateSaveData(once.data);
        expect(twice.migrated).toBe(false);
        expect(twice.data).toEqual(once.data);
    });

    it('drops stats.hp and scales the remaining 5 stats into 1-10 range', () => {
        const oldData = {
            trainers: [{
                stats: { hp: 10, atk: 14, def: 10, satk: 20, sdef: 6, spd: 30 },
                level: 5,
            }],
        };
        const { data, migrated } = migrateSaveData(oldData);
        expect(migrated).toBe(true);
        const stats = data.trainers[0].stats;
        expect(stats.hp).toBeUndefined();
        // scaleStatToNew: round(old / 2.5), clamped 1-10
        expect(stats.atk).toBe(6);   // round(14/2.5) = round(5.6) = 6
        expect(stats.def).toBe(4);   // round(10/2.5) = 4
        expect(stats.satk).toBe(8);  // round(20/2.5) = 8
        expect(stats.sdef).toBe(2);  // round(6/2.5) = round(2.4) = 2
        expect(stats.spd).toBe(10);  // round(30/2.5) = 12, clamped to 10
    });

    it('clamps scaled stats to a 1-10 range at both ends', () => {
        // atk:1 -> round(1/2.5)=0, clamped up to 1. def:100 -> clamped down to 10.
        const oldData = { trainers: [{ stats: { hp: 1, atk: 1, def: 100 } }] };
        const { data } = migrateSaveData(oldData);
        expect(data.trainers[0].stats.atk).toBe(1);  // floor clamp
        expect(data.trainers[0].stats.def).toBe(10); // ceiling clamp
    });

    it('sets fixed PTA3 HP fields: maxHp 20, empty hpRolls', () => {
        const oldData = { trainers: [{ stats: { hp: 10, atk: 10 }, level: 3 }] };
        const { data } = migrateSaveData(oldData);
        expect(data.trainers[0].maxHp).toBe(20);
        expect(data.trainers[0].hpRolls).toEqual([]);
    });

    it('converts trainer level into honors 1:1', () => {
        const oldData = { trainers: [{ stats: { hp: 10, atk: 10 }, level: 7 }] };
        const { data } = migrateSaveData(oldData);
        expect(data.trainers[0].honors).toBe(7);
    });

    it('defaults honors to 0 when level is missing', () => {
        const oldData = { trainers: [{ stats: { hp: 10, atk: 10 } }] };
        const { data } = migrateSaveData(oldData);
        expect(data.trainers[0].honors).toBe(0);
    });

    it('caps statPoints at 30 (PTA3.5 creation budget) but keeps a lower existing value', () => {
        const over = migrateSaveData({ trainers: [{ stats: { hp: 10 }, statPoints: 999 }] });
        expect(over.data.trainers[0].statPoints).toBe(30);

        const under = migrateSaveData({ trainers: [{ stats: { hp: 10 }, statPoints: 4 }] });
        expect(under.data.trainers[0].statPoints).toBe(4);

        const missing = migrateSaveData({ trainers: [{ stats: { hp: 10 } }] });
        expect(missing.data.trainers[0].statPoints).toBe(30);
    });

    it('resets classLevels to {} (re-derived elsewhere from trainer.level)', () => {
        const oldData = { trainers: [{ stats: { hp: 10 }, classLevels: { 'Old Class': 9 } }] };
        const { data } = migrateSaveData(oldData);
        expect(data.trainers[0].classLevels).toEqual({});
    });

    it('marks the migrated payload with _migrated: true', () => {
        const oldData = { trainers: [{ stats: { hp: 10 } }] };
        const { data } = migrateSaveData(oldData);
        expect(data._migrated).toBe(true);
    });

    it('merges baseStats + addedStats for every party and reserve Pokemon', () => {
        const oldData = {
            trainers: [{
                stats: { hp: 10 },
                party: [{
                    species: 'Charmander',
                    baseStats: { hp: 20, atk: 5, def: 4, satk: 6, sdef: 4, spd: 6 },
                    addedStats: { hp: 3, atk: 2, def: 0, satk: 1, sdef: 0, spd: 1 },
                }],
                reserve: [{
                    species: 'Squirtle',
                    baseStats: { hp: 22, atk: 4, def: 6, satk: 4, sdef: 6, spd: 4 },
                    addedStats: {},
                }],
            }],
        };
        const { data } = migrateSaveData(oldData);
        expect(data.trainers[0].party[0].baseStats).toEqual({
            hp: 23, atk: 7, def: 4, satk: 7, sdef: 4, spd: 7,
        });
        expect(data.trainers[0].reserve[0].baseStats).toEqual({
            hp: 22, atk: 4, def: 6, satk: 4, sdef: 6, spd: 4,
        });
    });

    it('strips stat-allocation fields from migrated Pokemon', () => {
        const oldData = {
            trainers: [{
                stats: { hp: 10 },
                party: [{
                    species: 'Charmander',
                    baseStats: { hp: 20 },
                    addedStats: { hp: 3 },
                    statAllocationHistory: [{ level: 2, stat: 'hp' }],
                    statPointsAvailable: 2,
                }],
                reserve: [],
            }],
        };
        const { data } = migrateSaveData(oldData);
        const poke = data.trainers[0].party[0];
        expect(poke.addedStats).toBeUndefined();
        expect(poke.statAllocationHistory).toBeUndefined();
        expect(poke.statPointsAvailable).toBeUndefined();
    });

    it('normalizes old move frequency strings to PTA3 format', () => {
        const oldData = {
            trainers: [{
                stats: { hp: 10 },
                party: [{
                    species: 'Pikachu',
                    baseStats: {},
                    moves: [
                        { name: 'Thunderbolt', frequency: 'At-Will' },
                        { name: 'Thunder',      frequency: 'Battle - 1' },
                        { name: 'Agility',      frequency: 'Battle - 2' },
                        { name: 'Rest',         frequency: 'EOT' },
                    ],
                }],
                reserve: [],
            }],
        };
        const { data } = migrateSaveData(oldData);
        const freqs = data.trainers[0].party[0].moves.map(m => m.frequency);
        expect(freqs).toEqual(['At-Will', '1/day', '3/day', '1/day']);
    });

    it('handles a trainer with no party/reserve arrays at all', () => {
        const oldData = { trainers: [{ stats: { hp: 10 } }] };
        expect(() => migrateSaveData(oldData)).not.toThrow();
        const { data } = migrateSaveData(oldData);
        expect(data.trainers[0].party).toEqual([]);
        expect(data.trainers[0].reserve).toEqual([]);
    });

    it('migrates every trainer in a multi-trainer roster', () => {
        const oldData = {
            trainers: [
                { name: 'Ash', stats: { hp: 10, atk: 10 }, level: 2 },
                { name: 'Misty', stats: { hp: 10, atk: 16 }, level: 4 },
            ],
        };
        const { data } = migrateSaveData(oldData);
        expect(data.trainers).toHaveLength(2);
        expect(data.trainers[0].honors).toBe(2);
        expect(data.trainers[1].honors).toBe(4);
    });
});

// ── cleanupLegacyFeatures ────────────────────────────────────

describe('cleanupLegacyFeatures', () => {
    const known = { 'Capable': {}, 'Skilled': {} };

    it('removes unknown string features but keeps known ones', () => {
        const data = { trainers: [{ features: ['Capable', 'OldDeprecatedFeature'] }] };
        const result = cleanupLegacyFeatures(data, known);
        expect(result.cleaned).toBe(true);
        expect(result.data.trainers[0].features).toEqual(['Capable']);
    });

    it('always keeps object-shaped features regardless of name', () => {
        const data = { trainers: [{ features: [{ name: 'Custom Stat Boost' }, 'Capable'] }] };
        const result = cleanupLegacyFeatures(data, known);
        expect(result.cleaned).toBe(false);
        expect(result.data.trainers[0].features).toHaveLength(2);
    });

    it('is a no-op when nothing changes', () => {
        const data = { trainers: [{ features: ['Capable', 'Skilled'] }] };
        const result = cleanupLegacyFeatures(data, known);
        expect(result.cleaned).toBe(false);
        expect(result.data).toBe(data);
    });

    it('handles missing/empty trainers gracefully', () => {
        expect(cleanupLegacyFeatures(null, known)).toEqual({ data: null, cleaned: false });
        expect(cleanupLegacyFeatures({ trainers: [{}] }, known).cleaned).toBe(false);
    });
});

// ── fixStatPointAccounting ───────────────────────────────────

describe('fixStatPointAccounting', () => {
    it('recomputes statPoints from absolute point-buy cost for a Level 0 trainer', () => {
        // 3/3/3/3/3 costs 5 * 3 = 15 of the 30-pt budget -> 15 remaining
        const data = { trainers: [{ level: 0, stats: { atk: 3, def: 3, satk: 3, sdef: 3, spd: 3 }, statPoints: 30 }] };
        const result = fixStatPointAccounting(data);
        expect(result.fixed).toBe(true);
        expect(result.data.trainers[0].statPoints).toBe(15);
    });

    it('leaves trainers above Level 0 untouched', () => {
        const data = { trainers: [{ level: 1, stats: { atk: 3, def: 3, satk: 3, sdef: 3, spd: 3 }, statPoints: 999 }] };
        const result = fixStatPointAccounting(data);
        expect(result.fixed).toBe(false);
        expect(result.data.trainers[0].statPoints).toBe(999);
    });

    it('is idempotent once statPoints already matches the correct value', () => {
        const data = { trainers: [{ level: 0, stats: { atk: 3, def: 3, satk: 3, sdef: 3, spd: 3 }, statPoints: 15 }] };
        const result = fixStatPointAccounting(data);
        expect(result.fixed).toBe(false);
        expect(result.data).toBe(data);
    });

    it('never produces a negative remaining-points value when overspent', () => {
        const data = { trainers: [{ level: 0, stats: { atk: 6, def: 6, satk: 6, sdef: 6, spd: 6 }, statPoints: 0 }] };
        // 5 * 11 = 55 cost, far over the 30-pt budget
        const result = fixStatPointAccounting(data);
        expect(result.data.trainers[0].statPoints).toBe(0);
    });
});

// ── capImportedPayloadSizes ──────────────────────────────────

describe('capImportedPayloadSizes', () => {
    it('caps an oversized trainers array down to the max', () => {
        const data = { trainers: Array.from({ length: 60 }, (_, i) => ({ name: `T${i}` })) };
        const result = capImportedPayloadSizes(data);
        expect(result.trainers).toHaveLength(50);
    });

    it('caps a trainer party to MAX_PARTY_SIZE and reserve to the reserve cap', () => {
        const data = {
            trainers: [{
                name: 'Ash',
                party: Array.from({ length: 20 }, (_, i) => ({ id: i, species: 'Rattata' })),
                reserve: Array.from({ length: 600 }, (_, i) => ({ id: i, species: 'Rattata' })),
            }],
        };
        const result = capImportedPayloadSizes(data);
        expect(result.trainers[0].party).toHaveLength(6);
        expect(result.trainers[0].reserve).toHaveLength(500);
    });

    it('caps a Pokemon\'s moves array to the 6-move cap', () => {
        const data = {
            trainers: [{
                name: 'Ash',
                party: [{ id: 1, species: 'Pikachu', moves: Array.from({ length: 50 }, (_, i) => ({ name: `Move${i}` })) }],
            }],
        };
        const result = capImportedPayloadSizes(data);
        expect(result.trainers[0].party[0].moves).toHaveLength(6);
    });

    it('caps pathologically long name/notes strings', () => {
        const data = { trainers: [{ name: 'A'.repeat(5000), notes: 'B'.repeat(50000) }] };
        const result = capImportedPayloadSizes(data);
        expect(result.trainers[0].name.length).toBe(200);
        expect(result.trainers[0].notes.length).toBe(10000);
    });

    it('caps top-level catalog arrays (inventory, customSpecies, etc.)', () => {
        const data = {
            inventory: Array.from({ length: 5000 }, (_, i) => ({ name: `Item${i}`, quantity: 1 })),
            customSpecies: Array.from({ length: 5000 }, (_, i) => ({ species: `Mon${i}` })),
        };
        const result = capImportedPayloadSizes(data);
        expect(result.inventory).toHaveLength(2000);
        expect(result.customSpecies).toHaveLength(2000);
    });

    it('caps the singular `trainer` field used by single-trainer import files', () => {
        const data = { trainer: { name: 'A'.repeat(5000), party: Array.from({ length: 20 }, (_, i) => ({ id: i })) } };
        const result = capImportedPayloadSizes(data);
        expect(result.trainer.name.length).toBe(200);
        expect(result.trainer.party).toHaveLength(6);
    });

    it('leaves a normal, well-formed payload untouched in shape', () => {
        const data = {
            app: 'pta3',
            trainers: [{ name: 'Ash', party: [{ id: 1, species: 'Pikachu', moves: [{ name: 'Tackle' }] }], reserve: [] }],
        };
        const result = capImportedPayloadSizes(data);
        expect(result.app).toBe('pta3');
        expect(result.trainers[0].name).toBe('Ash');
        expect(result.trainers[0].party[0].moves).toEqual([{ name: 'Tackle' }]);
    });

    it('handles missing/malformed data gracefully', () => {
        expect(capImportedPayloadSizes(null)).toBe(null);
        expect(capImportedPayloadSizes({})).toEqual({ trainers: undefined, trainer: undefined, inventory: undefined, customSpecies: undefined, customMoves: undefined, customOrigins: undefined, npcs: undefined });
    });
});
