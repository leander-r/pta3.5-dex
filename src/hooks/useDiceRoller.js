// ============================================================
// useDiceRoller Hook
// ============================================================
// Dice roller state and functions for PTA combat

import { useState, useCallback } from 'react';
import { calculateSTAB, getActualStats, calculatePokemonHP, parseDice, parseCritThreshold, getStageDiceDelta, calcModifier } from '../utils/dataUtils.js';
import { GAME_DATA } from '../data/configs.js';

/**
 * Roll dice
 * @param {number} count - Number of dice
 * @param {number} sides - Sides per die
 * @returns {number[]} - Array of individual rolls
 */
const rollDice = (count, sides) => {
    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    return rolls;
};

/**
 * Custom hook for dice rolling functionality
 * @param {Function} sendToDiscord - Function to send results to Discord
 * @returns {Object} - Dice roller state and functions
 */
export const useDiceRoller = (sendToDiscord = null) => {
    const [state, setState] = useState({
        mode: 'pokemon',           // 'pokemon', 'trainer', 'custom'
        selectedPokemon: null,
        selectedMove: null,
        selectedSkill: '',
        customDice: '',
        combatStages: { atk: 0, satk: 0, def: 0, sdef: 0, spd: 0, acc: 0, eva: 0 },
        rollHistory: [],
        stabApplied: false
    });

    // Update state helper
    const updateState = useCallback((updates) => {
        setState(prev => ({ ...prev, ...updates }));
    }, []);

    // Set combat stage
    const setCombatStage = useCallback((stat, value) => {
        setState(prev => ({
            ...prev,
            combatStages: { ...prev.combatStages, [stat]: value }
        }));
    }, []);

    // Reset combat stages
    const resetCombatStages = useCallback(() => {
        setState(prev => ({
            ...prev,
            combatStages: { atk: 0, satk: 0, def: 0, sdef: 0, spd: 0, acc: 0, eva: 0 }
        }));
    }, []);

    // Add to roll history
    const addToHistory = useCallback((roll) => {
        setState(prev => ({
            ...prev,
            rollHistory: [roll, ...prev.rollHistory].slice(0, 50) // Keep last 50 rolls
        }));
    }, []);

    // Clear roll history
    const clearHistory = useCallback(() => {
        setState(prev => ({ ...prev, rollHistory: [] }));
    }, []);

    /**
     * Roll a Pokemon move
     * @param {Object} pokemon - Pokemon object
     * @param {Object} move - Move object
     * @param {boolean} applyStab - Whether to apply STAB
     * @returns {Object} - Roll result
     */
    const rollPokemonMove = useCallback((pokemon, move, applyStab = true) => {
        if (!pokemon || !move) return null;

        const actualStats = getActualStats(pokemon);
        const isPhysical = move.category === 'Physical';
        const statKey = isPhysical ? 'atk' : 'satk';
        const baseStat = actualStats[statKey] || 0;

        // PTA3.5: the stat bonus to damage is always half the stat, rounded down — combat
        // stages no longer change the stat itself, they change the dice rolled (below).
        const modifier = calcModifier(baseStat);

        // PTA3.5: each stage of the attacker's own Attack/SpAttack adds (▲) or removes (▼) one
        // damage die (RAW also has the target's opposing Defense/SpDefense stage contribute a
        // die the same way — not modeled here, see getStageDiceDelta's doc comment).
        const stages = state.combatStages[statKey] || 0;
        const stageDiceDelta = getStageDiceDelta(stages);

        // Roll accuracy (1d20); check move-specific crit threshold
        const accRoll = Math.floor(Math.random() * 20) + 1;
        const critThreshold = parseCritThreshold(move.effect || move.description);
        const isCrit = accRoll >= critThreshold;

        // Parse damage dice
        const diceData = parseDice(move.damage);
        if (diceData.count === 0 && diceData.flat === 0) {
            // Status move
            const result = {
                type: 'pokemon',
                pokemon: pokemon.name || pokemon.species,
                move: move.name,
                moveType: move.type,
                category: move.category,
                accRoll,
                isCrit,
                isStatus: true,
                total: 0,
                timestamp: Date.now()
            };

            addToHistory(result);
            if (sendToDiscord) sendToDiscord(result, pokemon.name);
            return result;
        }

        let rolls, diceTotal, total, stabBonus = 0, diceLabel;

        if (diceData.flat > 0) {
            // Fixed Damage move (e.g. Dragon Rage): exact value, no dice/stat/STAB bonuses (RAW)
            rolls = [diceData.flat];
            diceTotal = diceData.flat;
            total = diceData.flat;
            diceLabel = `${diceData.flat} (fixed)`;
        } else {
            if (applyStab && pokemon.types && pokemon.types.includes(move.type)) {
                stabBonus = calculateSTAB();
            }

            // PTA3.5: combat stages add/remove whole dice before rolling. If a stage removes
            // every die the move has, it deals only its flat modifiers (stat bonus + STAB) — no
            // dice rolled.
            const diceCount = Math.max(0, diceData.count + stageDiceDelta);

            if (diceCount === 0) {
                rolls = [];
                diceTotal = 0;
                total = diceData.bonus + modifier + stabBonus;
                diceLabel = `0 dice (stages removed all power)`;
            } else {
                // PTA3.5: critical hit = all dice at max value (not double dice)
                rolls = isCrit
                    ? Array(diceCount).fill(diceData.sides)
                    : rollDice(diceCount, diceData.sides);
                diceTotal = rolls.reduce((sum, r) => sum + r, 0);
                total = diceTotal + diceData.bonus + modifier + stabBonus;
                diceLabel = `${diceCount}d${diceData.sides}${diceData.bonus ? '+' + diceData.bonus : ''}`;
            }
        }

        const result = {
            type: 'pokemon',
            pokemon: pokemon.name || pokemon.species,
            move: move.name,
            moveType: move.type,
            category: move.category,
            dice: diceLabel,
            rolls,
            diceTotal,
            statBonus: diceData.flat > 0 ? 0 : modifier,
            stageDiceDelta: diceData.flat > 0 ? 0 : stageDiceDelta,
            stabBonus,
            accRoll,
            isCrit,
            total,
            timestamp: Date.now()
        };

        addToHistory(result);
        if (sendToDiscord) sendToDiscord(result, pokemon.name);
        return result;
    }, [state.combatStages, addToHistory, sendToDiscord]);

    /**
     * Roll accuracy only
     * @param {Object} pokemon - Pokemon object
     * @returns {Object} - Roll result
     */
    const rollAccuracy = useCallback((pokemon) => {
        const accRoll = Math.floor(Math.random() * 20) + 1;
        const isCrit = accRoll === 20;

        const result = {
            type: 'accuracy',
            pokemon: pokemon?.name || pokemon?.species || 'Pokemon',
            total: accRoll,
            isCrit,
            timestamp: Date.now()
        };

        addToHistory(result);
        if (sendToDiscord) sendToDiscord(result, pokemon?.name);
        return result;
    }, [addToHistory, sendToDiscord]);

    /**
     * Roll a trainer skill check
     * @param {Object} trainer - Trainer object
     * @param {string} skillName - Skill name
     * @returns {Object} - Roll result
     */
    const rollTrainerSkill = useCallback((trainer, skillName) => {
        if (!trainer || !skillName) return null;

        const skillData = GAME_DATA.skills[skillName];
        if (!skillData) return null;

        const statKey = skillData.stat?.toLowerCase();
        const baseStat = trainer.stats?.[statKey] || 3;

        // PTA3: modifier = ⌊stat / 2⌋
        const modifier = calcModifier(baseStat);

        // Check talent level (handles both object and legacy array format)
        const skills = trainer.skills || {};
        const skillRank = Array.isArray(skills)
            ? (skills.includes(skillName) ? 1 : 0)
            : (skills[skillName] || 0);
        const hasSkill = skillRank > 0;
        // PTA3: 0 talents = +0, 1 talent = +2, 2 talents = +5
        const talentBonus = skillRank === 2 ? 5 : skillRank === 1 ? 2 : 0;

        // PTA3: Roll 1d20
        const rolls = rollDice(1, 20);
        const rollTotal = rolls[0];
        const total = rollTotal + modifier + talentBonus;

        const result = {
            type: 'trainer_skill',
            skill: skillName,
            skillStat: skillData.stat,
            dice: '1d20',
            rolls,
            baseStat,
            modifier,
            hasSkill,
            bonus: talentBonus,
            total,
            timestamp: Date.now()
        };

        addToHistory(result);
        if (sendToDiscord) sendToDiscord(result, trainer.name);
        return result;
    }, [addToHistory, sendToDiscord]);

    /**
     * Roll a d20 for trainer
     * @param {Object} trainer - Trainer object
     * @param {string} label - Roll label
     * @returns {Object} - Roll result
     */
    const rollTrainerD20 = useCallback((trainer, label = 'D20 Roll') => {
        const roll = Math.floor(Math.random() * 20) + 1;

        const result = {
            type: 'trainer_d20',
            skill: label,
            total: roll,
            timestamp: Date.now()
        };

        addToHistory(result);
        if (sendToDiscord) sendToDiscord(result, trainer?.name);
        return result;
    }, [addToHistory, sendToDiscord]);

    /**
     * Roll custom dice
     * @param {string} diceNotation - Dice notation (e.g., "2d6+5")
     * @returns {Object} - Roll result
     */
    const rollCustom = useCallback((diceNotation) => {
        const diceData = parseDice(diceNotation);
        if (diceData.count === 0 || diceData.sides === 0) return null;

        const rolls = rollDice(diceData.count, diceData.sides);
        const rollTotal = rolls.reduce((sum, r) => sum + r, 0);
        const total = rollTotal + diceData.bonus;

        const result = {
            type: 'custom',
            dice: diceNotation,
            rolls,
            rollTotal,
            bonus: diceData.bonus,
            total,
            timestamp: Date.now()
        };

        addToHistory(result);
        if (sendToDiscord) sendToDiscord(result);
        return result;
    }, [addToHistory, sendToDiscord]);

    return {
        state,
        updateState,
        setCombatStage,
        resetCombatStages,
        clearHistory,
        rollPokemonMove,
        rollAccuracy,
        rollTrainerSkill,
        rollTrainerD20,
        rollCustom
    };
};

export default useDiceRoller;
