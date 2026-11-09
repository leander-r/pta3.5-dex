// ============================================================
// Battle Tab Component (Dice Roller)
// ============================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getTypeColor, getContrastTextColor } from '../../utils/typeUtils.js';
import { calculateSTAB, getActualStats, calculatePokemonHP, parseDice, applyCombatStage, parseHealFormula, parseCritThreshold, calcModifier } from '../../utils/dataUtils.js';
import toast from '../../utils/toast.js';
import { useGameData, useModal, useTrainerContext, usePokemonContext, useData, useUI } from '../../contexts/index.js';
import { MAX_ROLL_HISTORY, MAX_MOVE_TABLE, Z_MOVE_TABLE, TERA_CROWN_TABLE } from '../../data/constants.js';
import { getPokemonSprite, getPokemonDisplayImage, getMegaSprite, getGigantamaxSprite } from '../../utils/pokemonSprite.js';
import TypeMatchupDisplay from './TypeMatchupDisplay.jsx';
import StatusConditionUI from './StatusConditionUI.jsx';
import MegaEvolutionPanel from './MegaEvolutionPanel.jsx';
import HPTracker from './HPTracker.jsx';
import CombatStagesPanel from './CombatStagesPanel.jsx';
import MoveSelector from './MoveSelector.jsx';
import CustomDicePanel from './CustomDicePanel.jsx';
import HealModePanel from './HealModePanel.jsx';
import PokemonSpritePicker from './PokemonSpritePicker.jsx';
import RollHistory from './RollHistory.jsx';
import DiscordWebhookConfig from './DiscordWebhookConfig.jsx';

// Hardcoded battle form changes for Pokémon not covered by the Pokédex megaForms field.
// Zygarde's forms are now stored in pokedex.min.json megaForms, so no overrides needed here.
const BATTLE_FORM_CHANGES = {};

// PTA3 HB1 pp.106-109: only these three capabilities have explicit skill check rules.
// All other capabilities are passive/movement and cannot be rolled.
const POKEMON_CAPABILITY_STAT = {
    'Stealth': 'spd',   // HB1: stealth check, "adding their Speed modifier"
    'Tracker': 'satk',  // HB1: investigate check, "adding their Special Attack modifier"
    'Wired':   'satk',  // HB1: programming check, "adding their Special Attack modifier"
};
const getPokemonCapabilityStat = (capabilityName) =>
    POKEMON_CAPABILITY_STAT[capabilityName] ?? 'spd';

// Convert a CSS hex color string to a Discord integer color
const hexToDiscordColor = (hex) => parseInt((hex || '#667eea').replace('#', ''), 16);

// A trainer-attack option (Unarmed Strike, or one weapon's move), styled to match the
// move cards in MoveSelector.jsx so Pokémon moves and trainer attacks read as one system.
const TrainerAttackCard = ({ moveName, moveType, damage, frequency, isSelected, onSelect, subtitle }) => {
    const typeColor = getTypeColor(moveType);
    return (
        <div
            onClick={onSelect}
            className={isSelected ? 'detail-tile-filled' : 'detail-tile'}
            style={{
                borderTop: `3px solid ${typeColor}`,
                background: isSelected ? typeColor : undefined,
                color: isSelected ? getContrastTextColor(typeColor) : undefined,
                cursor: onSelect ? 'pointer' : 'default',
            }}
        >
            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                {moveName}
            </div>
            {subtitle && <span style={{ fontSize: '10px', opacity: 0.8 }}>{subtitle}</span>}
            <span style={{
                padding: '1px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                background: 'var(--moves-category-physical-bg)', color: 'var(--moves-category-physical-text)'
            }}>Physical</span>
            <div style={{ fontSize: '11px', opacity: 0.85 }}>{damage}</div>
            {frequency && <div style={{ fontSize: '10px', opacity: 0.7 }}>{frequency}</div>}
        </div>
    );
};


// Collect live battle context to attach to roll entries
const battleContext = (pokemon, hp, megaEvolved, currentMegaForm, isDynamaxed, canGigantamax) => ({
    attackerCurrentHP: hp.current,
    attackerMaxHP: hp.max,
    pokemonSpriteUrl: megaEvolved && currentMegaForm
        ? getMegaSprite(pokemon, currentMegaForm)
        : isDynamaxed && canGigantamax
            ? getGigantamaxSprite(pokemon)
            : getPokemonSprite(pokemon),
    activeStatuses: Object.entries(pokemon.statusConditions || {}).filter(([, v]) => v).map(([k]) => k),
    megaEvolved,
    megaFormName: megaEvolved && currentMegaForm ? currentMegaForm.name : null,
});

// Build a normalized roll-history entry for a Pokemon attack.
// Extra fields (typeColor, attackerCurrentHP, etc.) are spread through unchanged.
const buildPokemonRollEntry = ({
    pokemon, move, moveType, category,
    accRoll, accModifier, modifiedAccRoll, moveAC, acWasOverridden,
    isHit, isCrit, isStatus,
    dice, rolls, diceTotal, statBonus, stabBonus, total,
    ...extra
}) => ({
    type: 'pokemon',
    pokemon, move, moveType, category,
    accRoll, accModifier, modifiedAccRoll, moveAC, acWasOverridden,
    isHit, isCrit,
    isStatus: isStatus || false,
    dice: dice || null,
    rolls: rolls || [],
    diceTotal: diceTotal || 0,
    statBonus: statBonus || 0,
    stabBonus: stabBonus || 0,
    total: total || 0,
    timestamp: Date.now(),
    ...extra
});


const BattleTab = () => {
    const { GAME_DATA, pokedex } = useGameData();
    const { showDetail } = useModal();
    const { trainer, setTrainer, party, reserve, calculateMaxHP, restAndRecover } = useTrainerContext();
    const { updatePokemon } = usePokemonContext();
    const { sendToDiscord, inventory, setInventory, npcs, setNpcs } = useData();
    const { showHelp, setActiveTab } = useUI();

    const [mode, setMode] = useState('pokemon');
    const [actorSource, setActorSource] = useState('player'); // 'player' | 'npc' — who the roller acts for
    const [selectedNpcId, setSelectedNpcId] = useState(null);
    const [selectedMove, setSelectedMove] = useState(null);
    const [selectedSkill, setSelectedSkill] = useState('');
    const [customDice, setCustomDice] = useState('');
    const [rollHistory, setRollHistory] = useState(() => {
        try { return JSON.parse(localStorage.getItem('pta35-roll-history') || '[]'); } catch (e) { console.warn('Roll history corrupted, resetting:', e); return []; }
    });
    const [combatStages, setCombatStages] = useState({ atk: 0, satk: 0, def: 0, sdef: 0, spd: 0, acc: 0, eva: 0 });
    const [applyStab, setApplyStab] = useState(true);
    const [selectedPokemonId, setSelectedPokemonId] = useState(null);
    const [acOverride, setAcOverride] = useState('');
    const [megaEvolved, setMegaEvolved] = useState(false);
    const [currentMegaForm, setCurrentMegaForm] = useState(null);
    const [zMoveUsed, setZMoveUsed] = useState(false);
    const [zMoveActive, setZMoveActive] = useState(false);
    const [isDynamaxed, setIsDynamaxed] = useState(false);
    const [gMaxMoveUsed, setGMaxMoveUsed] = useState(false);
    const [isTerastallized, setIsTerastallized] = useState(false);
    const [teraBlastUsesLeft, setTeraBlastUsesLeft] = useState(3);
    const [preDynamaxMaxHp, setPreDynamaxMaxHp] = useState(null);
    const [pokemonHP, setPokemonHP] = useState(null); // override for Dynamax HP scaling
    const [trainerSubmode, setTrainerSubmode] = useState('skill'); // 'skill' | 'attack' | 'weapon'
    const [selectedWeapon, setSelectedWeapon] = useState('');
    const [trainerAcOverride, setTrainerAcOverride] = useState('');
    const [pokemonSubmode, setPokemonSubmode] = useState('move'); // 'move' | 'skill'
    const [selectedPokemonSkill, setSelectedPokemonSkill] = useState('');

    const anyMechanicActive = megaEvolved || isDynamaxed || isTerastallized;

    const selectedNpc = useMemo(() => npcs.find(n => n.id === selectedNpcId) || null, [npcs, selectedNpcId]);

    // The "actor" the roller currently acts for — the active player trainer, or a chosen NPC.
    // NPCs (NpcRoster.jsx) don't track individualized skill talents, only stats/class/level,
    // so `skills` is intentionally omitted for NPC actors (treated as untrained everywhere).
    const actor = useMemo(() => {
        if (actorSource === 'npc' && selectedNpc) {
            return {
                id: selectedNpc.id, name: selectedNpc.name || 'NPC', level: selectedNpc.level ?? null,
                stats: selectedNpc.stats, maxHp: selectedNpc.maxHp ?? 20, currentDamage: selectedNpc.currentDamage || 0,
                avatar: '', isNpc: true,
            };
        }
        return {
            id: trainer.id, name: trainer.name || 'Trainer', level: trainer.level ?? 1,
            stats: trainer.stats, maxHp: calculateMaxHP(), currentDamage: trainer.currentDamage || 0,
            avatar: trainer.avatar, skills: trainer.skills, isNpc: false,
        };
    }, [actorSource, selectedNpc, trainer, calculateMaxHP]);

    const actorMaxHP = actor.maxHp;
    const actorCurrentHP = Math.max(0, actorMaxHP - (actor.currentDamage || 0));

    const actorParty = actorSource === 'npc' && selectedNpc ? (selectedNpc.team || []) : party;

    // Apply damage/heal to whichever actor is active — an NPC's own record (via setNpcs) or the
    // real player trainer (via setTrainer). Never let NPC HP writes fall through to the player.
    const handleActorDamage = (val) => {
        if (actor.isNpc) {
            setNpcs(prev => prev.map(n => n.id === actor.id ? { ...n, currentDamage: Math.min(n.maxHp ?? 20, (n.currentDamage || 0) + val) } : n));
        } else {
            setTrainer(prev => ({ ...prev, currentDamage: Math.min(actorMaxHP, (prev.currentDamage || 0) + val) }));
        }
    };
    const handleActorHeal = (val) => {
        if (actor.isNpc) {
            setNpcs(prev => prev.map(n => n.id === actor.id ? { ...n, currentDamage: Math.max(0, (n.currentDamage || 0) - val) } : n));
        } else {
            setTrainer(prev => ({ ...prev, currentDamage: Math.max(0, (prev.currentDamage || 0) - val) }));
        }
    };
    const handleActorFull = () => {
        if (actor.isNpc) {
            setNpcs(prev => prev.map(n => n.id === actor.id ? { ...n, currentDamage: 0 } : n));
        } else {
            setTrainer(prev => ({ ...prev, currentDamage: 0 }));
        }
    };

    // Apply a Pokémon-data patch to whichever actor owns it — an NPC's team member (via setNpcs)
    // or a real persisted player Pokémon (via updatePokemon). NPC team Pokémon aren't tracked by
    // PokemonContext, so routing NPC patches through updatePokemon would silently no-op.
    const updateActorPokemon = (pokemonId, patch) => {
        if (actorSource === 'npc' && selectedNpc) {
            setNpcs(prev => prev.map(n => n.id === selectedNpc.id
                ? { ...n, team: (n.team || []).map(p => p.id === pokemonId ? { ...p, ...patch } : p) }
                : n));
        } else {
            updatePokemon(pokemonId, patch);
        }
    };

    const selectedPokemon = useMemo(() => actorParty.find(p => p.id === selectedPokemonId) || null, [actorParty, selectedPokemonId]);

    // Clear stale selection if the selected Pokemon is no longer in the active party
    useEffect(() => {
        if (selectedPokemonId && !actorParty.some(p => p.id === selectedPokemonId)) {
            setSelectedPokemonId(null);
        }
    }, [actorParty, selectedPokemonId]);

    // Weapon submode requires player inventory/equipment — not tracked for NPCs
    useEffect(() => {
        if (actor.isNpc && trainerSubmode === 'weapon') setTrainerSubmode('skill');
    }, [actor.isNpc, trainerSubmode]);

    // Keep the weapon selection in sync with what's actually equipped. Without this, unequipping
    // the selected weapon (e.g. from Inventory) left `selectedWeapon` pointing at a phantom item —
    // "No weapons equipped" would show, but the stale selection still passed getWeaponInfo() and
    // left "Roll Weapon Attack!" enabled, letting a trainer roll an attack with a weapon they no
    // longer had (PHB2 Weapons Master requires actually "holding a weapon").
    useEffect(() => {
        const equippedWeaponNames = (trainer.equippedItems || []).filter(name =>
            (GAME_DATA?.items?.[name]?.type || '').toLowerCase() === 'weapon'
        );
        if (selectedWeapon && !equippedWeaponNames.includes(selectedWeapon)) {
            setSelectedWeapon('');
        }
    }, [trainer.equippedItems, GAME_DATA?.items, selectedWeapon]);

    // Heal mode always acts on the player's own inventory/party — force the source back
    useEffect(() => {
        if (mode === 'heal' && actorSource === 'npc') setActorSource('player');
    }, [mode, actorSource]);

    const megaForms = useMemo(() => {
        if (!selectedPokemon || !pokedex) return [];
        const fromPokedex = pokedex.find(p => p.species === selectedPokemon.species)?.megaForms || [];
        const fromOverride = BATTLE_FORM_CHANGES[selectedPokemon.species] || [];
        return [...fromPokedex, ...fromOverride];
    }, [selectedPokemon, pokedex]);

    const healingInventory = useMemo(() => inventory.filter(item => {
        const t = (item.type || '').toLowerCase();
        if (t !== 'healing' && t !== 'berry') return false;
        return parseHealFormula(item.effect || '').type !== 'none';
    }), [inventory]);

    useEffect(() => {
        try {
            localStorage.setItem('pta35-roll-history', JSON.stringify(rollHistory));
        } catch (e) {
            if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                toast.warning('Storage full — roll history could not be saved.');
            }
        }
    }, [rollHistory]);

    useEffect(() => {
        setMegaEvolved(false);
        setCurrentMegaForm(null);
        setAcOverride('');
        setZMoveUsed(false);
        setZMoveActive(false);
        setIsDynamaxed(false);
        setGMaxMoveUsed(false);
        setIsTerastallized(false);
        setTeraBlastUsesLeft(3);
        setPreDynamaxMaxHp(null);
        setPokemonHP(null);
    }, [selectedPokemonId]);

    const HELD_ITEM_BONUSES = {
        'Choice Band': { atk: 2 }, 'Choice Scarf': { spd: 2 }, 'Choice Specs': { satk: 2 },
    };

    // Apply mega stat boosts and Tera def/sdef bonus to actual stats
    const getStatsWithMega = useCallback((pokemon) => {
        const baseStats = getActualStats(pokemon);
        // Pokedex megaForms carry absolute `stats`; legacy BATTLE_FORM_CHANGES use `statBoosts` deltas.
        const afterMega = !megaEvolved ? baseStats
            : currentMegaForm?.stats      ? { ...baseStats, ...currentMegaForm.stats }
            : currentMegaForm?.statBoosts ? {
                hp:   baseStats.hp   + (currentMegaForm.statBoosts.hp   || 0),
                atk:  baseStats.atk  + (currentMegaForm.statBoosts.atk  || 0),
                def:  baseStats.def  + (currentMegaForm.statBoosts.def  || 0),
                satk: baseStats.satk + (currentMegaForm.statBoosts.satk || 0),
                sdef: baseStats.sdef + (currentMegaForm.statBoosts.sdef || 0),
                spd:  baseStats.spd  + (currentMegaForm.statBoosts.spd  || 0),
            }
            : baseStats;
        const afterTera = (!isTerastallized) ? afterMega : { ...afterMega, def: afterMega.def + 3, sdef: afterMega.sdef + 3 };
        // Apply special form (Alpha / Totem / Titan) stat overrides
        let afterForm = { ...afterTera };
        const sf = pokemon.specialForm;
        if (sf === 'alpha' || sf === 'totem') {
            afterForm.hp  = afterForm.hp * 2;
            afterForm.atk = afterForm.atk + 5;
            afterForm.satk = afterForm.satk + 5;
            const defStat = pokemon.specialFormDefStat || 'def';
            afterForm[defStat] = Math.max(afterForm[defStat], 15);
        } else if (sf === 'titan') {
            afterForm.hp = afterForm.hp * 10;
        }
        // Apply temporary stat boosts and held item bonuses
        const boosts = pokemon.tempStatBoosts || {};
        const heldBonus = HELD_ITEM_BONUSES[pokemon.heldItem] || {};
        const stats = { ...afterForm };
        Object.keys(stats).forEach(k => {
            if (boosts[k]) stats[k] = (stats[k] || 0) + boosts[k];
            if (heldBonus[k]) stats[k] = (stats[k] || 0) + heldBonus[k];
        });
        return stats;
    }, [megaEvolved, currentMegaForm, isTerastallized]);

    const gMaxData = useMemo(() => {
        if (!selectedPokemon?.species) return null;
        return GAME_DATA.gigantamaxForms?.[selectedPokemon.species] || null;
    }, [selectedPokemon]);

    const canGigantamax = !!gMaxData;

    const hasZMoves = useMemo(() => {
        if (!selectedPokemon) return false;
        return selectedPokemon.moves?.some(m => Z_MOVE_TABLE[m.type]) || !!(GAME_DATA.uniqueZMoves?.[selectedPokemon.species]);
    }, [selectedPokemon]);

    // Transform the move list based on the active battle mode.
    const displayedMoves = useMemo(() => {
        if (!selectedPokemon?.moves?.length) return selectedPokemon?.moves || [];

        // ── Dynamax / Gigantamax ────────────────────────────────────────────
        if (isDynamaxed) {
            const seen = new Set();
            const maxMoves = selectedPokemon.moves.reduce((acc, m) => {
                let maxMove;
                if (m.category === 'Status') {
                    maxMove = { name: 'Max Guard', type: 'Normal', category: 'Status', damage: null, frequency: '3/day', range: 'Self', isMaxMove: true, isMaxGuard: true, effect: 'Prevent the next 30 damage you would receive until your next action.' };
                } else {
                    const entry = MAX_MOVE_TABLE[m.type];
                    maxMove = entry
                        ? { name: entry.name, type: m.type, category: m.category, damage: '4d12', frequency: 'At-Will', range: 'Ranged (80ft, 30ft blast)', isMaxMove: true, isMaxGuard: false, effect: entry.effect }
                        : m;
                }
                if (!seen.has(maxMove.name)) { seen.add(maxMove.name); acc.push(maxMove); }
                return acc;
            }, []);
            if (gMaxData?.gMaxMove) {
                const gm = gMaxData.gMaxMove;
                maxMoves.unshift({ name: gm.name, type: gm.type, category: 'Special', damage: gm.damage, frequency: '1/GMAX', range: 'Ranged (80ft, 30ft blast)', isMaxMove: true, isGMaxMove: true, isMaxGuard: false, effect: gm.effect });
            }
            return maxMoves;
        }

        // ── Z-Move mode ─────────────────────────────────────────────────────
        if (zMoveActive) {
            const seen = new Set();
            const result = [];
            const uniqueZ = GAME_DATA.uniqueZMoves?.[selectedPokemon.species];
            if (uniqueZ) {
                result.push({ name: uniqueZ.name, type: uniqueZ.type, category: uniqueZ.category, damage: uniqueZ.damage, range: uniqueZ.range, frequency: '1/day', isZMove: true, isUniqueZ: true, effect: uniqueZ.effect || '' });
                seen.add(uniqueZ.name);
            }
            selectedPokemon.moves.forEach(m => {
                if (m.category === 'Status') return;
                const zMove = Z_MOVE_TABLE[m.type];
                if (zMove && !seen.has(zMove.name)) {
                    seen.add(zMove.name);
                    result.push({ name: zMove.name, type: m.type, category: m.category, damage: zMove.damage, range: zMove.range, frequency: '1/day', isZMove: true, isUniqueZ: false, effect: '' });
                }
            });
            return result;
        }

        // ── Terastallized ───────────────────────────────────────────────────
        if (isTerastallized && selectedPokemon.teraType) {
            const crown = TERA_CROWN_TABLE[selectedPokemon.teraType];
            const prepended = [
                { name: 'Tera Blast', type: selectedPokemon.teraType, category: 'Special', damage: '3d12', range: 'Ranged (40ft beam, 10ft blast)', frequency: '3/day', isTeraMove: true, isTeraBlast: true, effect: 'Uses higher of ATK or SATK.' },
            ];
            if (crown) {
                prepended.push({ name: crown.move, type: selectedPokemon.teraType, category: crown.category, damage: crown.damage, range: crown.range, frequency: 'At-Will', isTeraMove: true, isTeraCrown: true, effect: '' });
            }
            return [...prepended, ...selectedPokemon.moves];
        }

        return selectedPokemon.moves;
    }, [selectedPokemon, isDynamaxed, gMaxData, zMoveActive, isTerastallized, teraBlastUsesLeft]);

    const handleMegaEvolve = (megaForm) => {
        setCurrentMegaForm(megaForm);
        setMegaEvolved(true);
        setZMoveActive(false);
        setSelectedMove(null);
        // Clear any residual Dynamax HP override so the new form's HP is recalculated
        if (!isDynamaxed) setPokemonHP(null);
    };
    const handleMegaRevert = () => { setMegaEvolved(false); setCurrentMegaForm(null); setSelectedMove(null); };

    const handleZMoveActivate = () => { setZMoveActive(true); setSelectedMove(null); };
    const handleZMoveDeactivate = () => { setZMoveActive(false); setSelectedMove(null); };
    const handleZMoveReset = () => { setZMoveUsed(false); };

    const handleDynamax = () => {
        if (!selectedPokemon) return;
        setSelectedMove(null);
        setZMoveActive(false);
        const base = getPokemonBaseHP(selectedPokemon);
        const newMax = base.max * 5;
        // Preserve proportional HP on activation, mirroring handleDynamaxRevert — Dynamaxing
        // isn't a heal, so a Pokémon at 10/50 HP should become 50/250, not jump to full.
        const ratio = base.max > 0 ? base.current / base.max : 1;
        const current = Math.max(0, Math.floor(newMax * ratio));
        setPreDynamaxMaxHp(base.max);
        setPokemonHP({ current, max: newMax });
        setIsDynamaxed(true);
    };

    const handleDynamaxRevert = () => {
        const base = preDynamaxMaxHp;
        setPokemonHP(prev => {
            // Preserve proportional HP: 60% during Dynamax → 60% on revert
            const ratio = prev ? prev.current / prev.max : 1;
            const current = Math.max(0, Math.floor(base * ratio));
            return { current, max: base };
        });
        setIsDynamaxed(false);
        setGMaxMoveUsed(false);
        setPreDynamaxMaxHp(null);
        setSelectedMove(null);
    };

    const handleTerastallize = () => { setZMoveActive(false); setSelectedMove(null); setIsTerastallized(true); };
    const handleTeraRevert = () => setIsTerastallized(false);

    // Roll a special mechanic move (Z-Move, G-Max, Tera Blast) into roll history.
    // PTA3's general damage formula is "Dice + modifier + STAB + type bonus" for every
    // Physical/Special attack (GameRulesSection.jsx) — nothing exempts these from it, and
    // Tera Blast's own text is explicit: "you may use your Attack stat instead of your
    // Special Attack stat when rolling to hit and calculating damage" (gmg_raw.txt ~12928-12932).
    // statKey: 'atk' | 'satk' | 'higher' (Tera Blast — pick whichever is currently higher).
    const rollSpecialMove = ({ moveName, moveType, category, damage, effect, statKey: statKeyOverride, forceStab }) => {
        if (!selectedPokemon) return;
        const diceData = parseDice(damage);
        if (diceData.count === 0) return;

        const actualStats = getStatsWithMega(selectedPokemon);
        let statKey = statKeyOverride || (category === 'Physical' ? 'atk' : 'satk');
        if (statKey === 'higher') {
            const atkAdj = applyCombatStage(actualStats.atk || 0, combatStages.atk || 0);
            const satkAdj = applyCombatStage(actualStats.satk || 0, combatStages.satk || 0);
            statKey = atkAdj >= satkAdj ? 'atk' : 'satk';
        }
        const adjustedStat = applyCombatStage(actualStats[statKey] || 0, combatStages[statKey] || 0);
        const statMod = calcModifier(adjustedStat);
        const stabBonus = (applyStab && (forceStab || selectedPokemon.types?.includes(moveType))) ? calculateSTAB() : 0;

        const rolls = rollDice(diceData.count, diceData.sides);
        const diceTotal = rolls.reduce((s, r) => s + r, 0);
        const total = diceTotal + diceData.bonus + statMod + stabBonus;
        const hp = getActivePokemonHP(selectedPokemon);
        addToHistory(buildPokemonRollEntry({
            pokemon: selectedPokemon.name || selectedPokemon.species,
            move: moveName, moveType, category,
            accRoll: 20, accModifier: 0, modifiedAccRoll: 20, moveAC: null, acWasOverridden: false,
            isHit: true, isCrit: false, isStatus: false,
            dice: `${diceData.count}d${diceData.sides}`,
            rolls, diceTotal, diceBonus: diceData.bonus, statBonus: statMod, stabBonus, total,
            typeColor: 0,
            attackerCurrentHP: hp.current, attackerMaxHP: hp.max,
            pokemonSpriteUrl: getPokemonSprite(selectedPokemon),
            activeStatuses: [],
            megaEvolved: false, megaFormName: null,
            ...(effect ? { specialEffect: effect } : {}),
        }));
    };

    const handleZMoveRoll = (zMove) => {
        rollSpecialMove({ moveName: zMove.name, moveType: zMove.type, category: zMove.category, damage: zMove.damage, effect: zMove.effect });
        setZMoveUsed(true);
    };

    const handleGMaxRoll = (gMaxMove) => {
        rollSpecialMove({ moveName: gMaxMove.name, moveType: gMaxMove.type, category: 'Special', damage: gMaxMove.damage, effect: gMaxMove.effect });
        setGMaxMoveUsed(true);
    };


    const handleTeraBlastRoll = () => {
        if (!selectedPokemon) return;
        // RAW: "you may use your Attack stat instead of your Special Attack stat" — auto-picking
        // whichever is currently higher matches a rational trainer's choice under that option.
        // Its type always matches the Terastallized type, so STAB always applies (forceStab).
        rollSpecialMove({ moveName: 'Tera Blast', moveType: selectedPokemon.teraType || 'Normal', category: 'Special', damage: '3d12', effect: '', statKey: 'higher', forceStab: true });
        // Frequency (3/day) is tracked for reference but doesn't block further rolls — clamped
        // at 0 so the "X/3 left" display doesn't go negative once a table plays past it.
        setTeraBlastUsesLeft(prev => Math.max(0, prev - 1));
    };

    // Base HP from Pokémon data, including mega stat boosts (ignores Dynamax override)
    const getPokemonBaseHP = (poke) => {
        if (!poke) return { current: 0, max: 0 };
        // Use getStatsWithMega so mega HP boosts (e.g. Zygarde Complete +11) are reflected
        const max = getStatsWithMega(poke).hp;
        return { current: Math.max(0, max - (poke.currentDamage || 0)), max };
    };

    // Active HP: use Dynamax override if present, else base
    const getActivePokemonHP = (poke) => {
        if (!poke) return { current: 0, max: 0 };
        if (pokemonHP && poke.id === selectedPokemonId) return pokemonHP;
        return getPokemonBaseHP(poke);
    };

    const getPokemonHP = (poke) => getActivePokemonHP(poke);

    const updateCombatStage = (stat, delta) => {
        setCombatStages(prev => ({ ...prev, [stat]: Math.max(-6, Math.min(6, (prev[stat] || 0) + delta)) }));
    };
    const resetCombatStages = () => setCombatStages({ atk: 0, satk: 0, def: 0, sdef: 0, spd: 0, acc: 0, eva: 0 });

    const rollDice = (count, sides) => {
        const rolls = [];
        for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
        return rolls;
    };

    const addToHistory = (roll) => {
        const entry = { ...roll, actorName: actor.name, actorKind: actor.isNpc ? 'npc' : 'player' };
        setRollHistory(prev => [entry, ...prev].slice(0, MAX_ROLL_HISTORY));
        if (sendToDiscord) sendToDiscord(entry, actor.name);
    };

    const rollPokemonMove = () => {
        if (!selectedPokemon || !selectedMove) return;

        // Z-Move — 8d12 (or species-specific damage), 1/day. Frequency is tracked but not
        // enforced here — a table can decide for itself whether to allow a second use.
        if (selectedMove.isZMove) {
            handleZMoveRoll(selectedMove);
            return;
        }

        // Tera Blast — 3d12, 3/day (tracked, not enforced — see handleTeraBlastRoll).
        if (selectedMove.isTeraBlast) {
            handleTeraBlastRoll();
            return;
        }

        // Tera Crown At-Will move — treated like a normal At-Will (no accuracy roll needed)
        if (selectedMove.isTeraCrown) {
            rollSpecialMove({ moveName: selectedMove.name, moveType: selectedMove.type, category: selectedMove.category, damage: selectedMove.damage, effect: selectedMove.effect });
            return;
        }

        // Max Moves bypass the normal accuracy/stat roll — always hit, flat 4d12
        if (selectedMove.isMaxMove) {
            if (selectedMove.isGMaxMove) {
                handleGMaxRoll({ name: selectedMove.name, type: selectedMove.type, damage: selectedMove.damage, effect: selectedMove.effect });
                return;
            }
            if (selectedMove.isMaxGuard) {
                // Max Guard — log as a status action (no damage)
                const hp = getActivePokemonHP(selectedPokemon);
                const canGigantamax = !!(GAME_DATA.gigantamaxForms?.[selectedPokemon.species]);
                const ctx = battleContext(selectedPokemon, hp, megaEvolved, currentMegaForm, isDynamaxed, canGigantamax);
                addToHistory(buildPokemonRollEntry({
                    pokemon: selectedPokemon.name || selectedPokemon.species,
                    move: 'Max Guard', moveType: 'Normal', category: 'Status',
                    accRoll: 20, accModifier: 0, modifiedAccRoll: 20, moveAC: null, acWasOverridden: false,
                    isHit: true, isCrit: false, isStatus: true,
                    dice: null, rolls: [], diceTotal: 0, statBonus: 0, stabBonus: 0, total: 0,
                    ...ctx
                }));
            } else {
                rollSpecialMove({ moveName: selectedMove.name, moveType: selectedMove.type, category: selectedMove.category || 'Special', damage: '4d12', effect: selectedMove.effect });
            }
            return;
        }

        const actualStats = getStatsWithMega(selectedPokemon);
        const category = selectedMove.category; // 'Physical', 'Special', 'Status'
        const isPhysical = category === 'Physical';
        const statKey = isPhysical ? 'atk' : 'satk'; // stat used for damage
        // PTA3: Physical → ATK accuracy mod vs DEF; Special → SATK mod vs SDEF; Status → EFF mod vs SPD
        const accModKey = isPhysical ? 'atk' : category === 'Status' ? 'eff' : 'satk';
        // PTA3: combat stages adjust the full stat; damage modifier = ⌊adjusted_stat/2⌋
        const adjustedStat = applyCombatStage(actualStats[statKey] || 0, combatStages[statKey] || 0);
        const statMod = calcModifier(adjustedStat);

        // PTA3: accuracy = 1d20 + acc combat stages + Pokémon's accuracy bonus (from Pokédex)
        const accStageMod = combatStages.acc || 0;
        const pokemonAccBonus = selectedPokemon.accuracyMods?.[accModKey] || 0;
        const accModifier = accStageMod + pokemonAccBonus; // total acc bonus shown in roll

        // Target stat value (DEF/SDEF/SPD) entered via override field; null = GM call (always hit)
        const moveAC = acOverride !== '' ? (parseInt(acOverride) || null) : null;
        const critThreshold = parseCritThreshold(selectedMove.effect || selectedMove.description);
        const accRoll = Math.floor(Math.random() * 20) + 1;
        const modifiedAccRoll = accRoll + accModifier;
        const isCrit = accRoll >= critThreshold;
        const isHit = isCrit || moveAC === null || modifiedAccRoll >= moveAC;
        const acWasOverridden = acOverride !== '';

        const hp = getPokemonHP(selectedPokemon);
        const canGigantamax = !!(GAME_DATA.gigantamaxForms?.[selectedPokemon.species]);
        const ctx = battleContext(selectedPokemon, hp, megaEvolved, currentMegaForm, isDynamaxed, canGigantamax);
        const typeColor = hexToDiscordColor(getTypeColor(selectedMove.type));

        const commonFields = {
            pokemon: selectedPokemon.name || selectedPokemon.species,
            move: selectedMove.name, moveType: selectedMove.type, category: selectedMove.category,
            accRoll, accModifier, modifiedAccRoll, moveAC, acWasOverridden, isHit, isCrit, critThreshold,
            typeColor, ...ctx,
        };

        const diceData = parseDice(selectedMove.damage);

        // Collect non-zero combat stages relevant to this roll
        const statLabel = isPhysical ? 'ATK' : 'SATK';
        const baseStatVal = actualStats[statKey] || 0;
        const stageBonus = adjustedStat - baseStatVal; // raw stat change from combat stages
        const relevantStages = [
            combatStages.acc ? { label: 'ACC', stage: combatStages.acc, bonus: combatStages.acc, isFlat: true } : null,
            diceData.count > 0 && combatStages[statKey] ? { label: statLabel, stage: combatStages[statKey], bonus: stageBonus, base: baseStatVal, boosted: adjustedStat } : null,
        ].filter(Boolean);

        if (diceData.count === 0 && diceData.flat === 0) {
            addToHistory(buildPokemonRollEntry({ ...commonFields, isStatus: true, relevantStages }));
            return;
        }

        let rolls = [], diceTotal = 0, stabBonus = 0, total = 0, diceCount = 0;
        if (isHit) {
            if (diceData.flat > 0) {
                // Flat damage move (e.g. Dragon Rage): fixed value, no dice, no added bonuses
                rolls = [diceData.flat];
                diceTotal = diceData.flat;
                total = diceData.flat;
            } else {
                diceCount = diceData.count;
                // PTA3: critical hit = all dice at max value (not double dice)
                rolls = isCrit
                    ? Array(diceCount).fill(diceData.sides)
                    : rollDice(diceCount, diceData.sides);
                diceTotal = rolls.reduce((sum, r) => sum + r, 0);
                if (applyStab && selectedPokemon.types?.includes(selectedMove.type)) {
                    stabBonus = calculateSTAB();
                }
                total = diceTotal + diceData.bonus + statMod + stabBonus;
            }
        }

        addToHistory(buildPokemonRollEntry({
            ...commonFields,
            dice: isHit ? (diceData.flat > 0 ? `${diceData.flat} (fixed)` : `${diceCount}d${diceData.sides}`) : null,
            diceBonus: diceData.bonus,
            rolls, diceTotal, statBonus: diceData.flat > 0 ? 0 : statMod, stabBonus, total, relevantStages
        }));
    };

    const rollTrainerSkill = () => {
        if (!selectedSkill) return;
        const skillData = GAME_DATA.skills[selectedSkill];
        if (!skillData) return;

        const statKey = skillData.stat?.toLowerCase();
        const baseStat = actor.stats?.[statKey] || 3;
        const modifier = calcModifier(baseStat);

        const skills = actor.skills || {};
        const skillRank = Array.isArray(skills)
            ? (skills.includes(selectedSkill) ? 1 : 0)
            : (skills[selectedSkill] || 0);
        const hasSkill = skillRank > 0;
        // PTA3: 0 talents = +0, 1 talent = +2, 2 talents = +5
        const talentBonus = skillRank === 2 ? 5 : skillRank === 1 ? 2 : 0;

        const rolls = rollDice(1, 20);
        const rollTotal = rolls[0];
        const total = rollTotal + modifier + talentBonus;

        addToHistory({ type: 'trainer_skill', skill: selectedSkill, skillStat: skillData.stat, dice: '1d20', rolls, baseStat, modifier, hasSkill, bonus: talentBonus, total, trainerCurrentHP: actorCurrentHP, trainerMaxHP: actorMaxHP, timestamp: Date.now() });
    };

    const rollPokemonSkill = () => {
        if (!selectedPokemon || !selectedPokemonSkill) return;
        const statKey = getPokemonCapabilityStat(selectedPokemonSkill);
        const baseStat = (selectedPokemon.baseStats || selectedPokemon.stats)?.[statKey] || 0;
        const modifier = calcModifier(baseStat);
        const rolls = rollDice(1, 20);
        const total = rolls[0] + modifier;
        const hp = getPokemonHP(selectedPokemon);
        addToHistory({
            type: 'pokemon_skill',
            pokemon: selectedPokemon.name || selectedPokemon.species,
            skill: selectedPokemonSkill,
            skillStat: statKey.toUpperCase(),
            dice: '1d20',
            rolls,
            baseStat,
            modifier,
            total,
            pokemonCurrentHP: hp.current,
            pokemonMaxHP: hp.max,
            timestamp: Date.now(),
        });
    };

    // Parse move name and type from a weapon item's effect string
    // e.g. "Branch Poke — Melee Grass At-Will 2d6. Requires Weapons Master."
    const getWeaponInfo = (weaponName) => {
        const item = GAME_DATA?.items?.[weaponName];
        if (!item?.effect) return { moveName: 'Weapon Attack', moveType: 'Normal' };
        const nameMatch = item.effect.match(/^([^—\-]+)/);
        const typeMatch = item.effect.match(/Melee (\w+)/);
        return {
            moveName: nameMatch ? nameMatch[1].trim() : weaponName,
            moveType: typeMatch ? typeMatch[1] : 'Normal',
        };
    };

    const rollTrainerAttack = () => {
        const isWeapon = trainerSubmode === 'weapon';
        const atkStat = actor.stats?.atk || 3;
        const atkMod = calcModifier(atkStat);
        const moveAC = trainerAcOverride !== '' ? (parseInt(trainerAcOverride) || null) : null;
        const accRoll = Math.floor(Math.random() * 20) + 1;
        const isCrit = accRoll === 20;
        const isHit = isCrit || moveAC === null || (accRoll + atkMod) >= moveAC;

        // HB1 "Trainer Attacks": Cut/Pound/Tackle are At-Will 2d6 regardless of whether
        // the trainer is using a blade/club or just throwing themselves into the fight —
        // the book doesn't have a weaker unarmed tier.
        const [count, sides] = [2, 6];
        const damageRolls = isHit ? (isCrit ? Array(count).fill(sides) : rollDice(count, sides)) : [];
        const diceTotal = damageRolls.reduce((s, r) => s + r, 0);
        const total = isHit ? diceTotal + atkMod : 0;

        let moveName = 'Unarmed Strike', moveType = 'Normal', weaponName = null;
        if (isWeapon && selectedWeapon) {
            weaponName = selectedWeapon;
            const wInfo = getWeaponInfo(selectedWeapon);
            moveName = wInfo.moveName;
            moveType = wInfo.moveType;
        }

        addToHistory({
            type: 'trainer_attack',
            attackType: isWeapon ? 'weapon' : 'unarmed',
            moveName,
            weaponName,
            moveType,
            accRoll,
            accModifier: atkMod,
            modifiedAccRoll: accRoll + atkMod,
            moveAC,
            isHit,
            isCrit,
            dice: `${count}d${sides}`,
            rolls: damageRolls,
            diceTotal,
            atkMod,
            total,
            timestamp: Date.now(),
        });
    };

    const rollCustomDice = () => {
        const diceData = parseDice(customDice);
        if (diceData.count === 0 || diceData.sides === 0) {
            toast.warning('Invalid dice format. Use format like "2d6+5" or "1d20"');
            return;
        }
        const rolls = rollDice(diceData.count, diceData.sides);
        const rollTotal = rolls.reduce((sum, r) => sum + r, 0);
        addToHistory({ type: 'custom', dice: customDice, rolls, rollTotal, bonus: diceData.bonus, total: rollTotal + diceData.bonus, timestamp: Date.now() });
    };

    const rollHealItem = (itemName) => {
        const target = actorParty.find(p => p.id === selectedPokemonId);
        if (!target) { toast.warning('Select a Pokémon first.'); return; }
        const invItem = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (!invItem) return;
        const formula = parseHealFormula(invItem.effect || '');
        const maxHP = calculatePokemonHP(target);
        let amount = 0, rolls = [], bonus = 0, desc = '';
        if (formula.type === 'dice') {
            const d = parseDice(formula.formula);
            rolls = rollDice(d.count, d.sides);
            bonus = d.bonus;
            amount = rolls.reduce((a, b) => a + b, 0) + bonus;
            desc = formula.formula;
        } else if (formula.type === 'fraction') {
            amount = Math.floor(maxHP * formula.num / formula.denom);
            desc = `${formula.num}/${formula.denom} Max HP`;
        } else if (formula.type === 'full') {
            amount = maxHP;
            desc = 'Full Restore';
        } else if (formula.type === 'flat') {
            amount = formula.amount;
            desc = `${formula.amount} HP`;
        } else {
            toast.info(`Used ${itemName} (status effect only).`);
        }
        const hpBefore = maxHP - (target.currentDamage || 0);
        const hpAfter = Math.min(maxHP, hpBefore + amount);
        if (amount > 0) {
            updatePokemon(target.id, { currentDamage: Math.max(0, (target.currentDamage || 0) - amount) });
        }
        setInventory(prev => {
            const idx = prev.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
            if (idx === -1) return prev;
            const qty = prev[idx].quantity || 1;
            if (qty <= 1) return prev.filter((_, i) => i !== idx);
            const next = [...prev];
            next[idx] = { ...next[idx], quantity: qty - 1 };
            return next;
        });
        addToHistory({ type: 'heal', pokemon: target.name || target.species, item: itemName, formula: desc, rolls, bonus, amount, hpBefore, hpAfter, hpMax: maxHP, pokemonSpriteUrl: getPokemonSprite(target), timestamp: Date.now() });
    };

    return (
        <div>
            <h2 className="section-title">Dice Roller</h2>
            <p className="section-description">
                Roll attacks, skills, and custom dice. Results can be sent to Discord via webhook.
            </p>

            {/* Mode Selector */}
            <div className="tabs" style={{ marginBottom: '15px' }}>
                <button className={`tab ${mode === 'pokemon'  ? 'active' : ''}`} onClick={() => setMode('pokemon')}>Pokemon</button>
                <button className={`tab ${mode === 'trainer'  ? 'active' : ''}`} onClick={() => setMode('trainer')}>Trainer</button>
                <button className={`tab ${mode === 'custom'   ? 'active' : ''}`} onClick={() => setMode('custom')}>Custom Dice</button>
                <button className={`tab ${mode === 'heal'     ? 'active' : ''}`} onClick={() => setMode('heal')}>🩹 Heal</button>
            </div>

            {/* Actor Source — who the roller acts for. Heal mode always uses the player's own
                inventory/party, so the toggle is hidden there (see the effect above that forces
                actorSource back to 'player' on entering Heal mode). Custom Dice doesn't need an
                actor either, but is left showing the last-picked one for Discord attribution. */}
            {mode !== 'heal' && (
                <div style={{ marginBottom: '15px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            onClick={() => setActorSource('player')}
                            style={{
                                flex: '0 0 auto', padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                fontSize: '12px', fontWeight: 'bold',
                                background: actorSource === 'player' ? '#667eea' : 'var(--input-bg)',
                                color: actorSource === 'player' ? 'white' : 'var(--text-secondary)',
                            }}
                        >
                            🧑 Player Trainer
                        </button>
                        <button
                            onClick={() => setActorSource('npc')}
                            style={{
                                flex: '0 0 auto', padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                fontSize: '12px', fontWeight: 'bold',
                                background: actorSource === 'npc' ? '#667eea' : 'var(--input-bg)',
                                color: actorSource === 'npc' ? 'white' : 'var(--text-secondary)',
                            }}
                        >
                            🎭 NPC
                        </button>
                    </div>
                    {actorSource === 'npc' && (
                        npcs.length === 0 ? (
                            <div style={{ marginTop: '10px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    No NPCs yet — create one in GM Tools → NPC Roster.
                                </span>
                            </div>
                        ) : (
                            <div className="detail-tile-grid" style={{ marginTop: '10px' }}>
                                {npcs.map(n => {
                                    const isSelected = selectedNpcId === n.id;
                                    return (
                                        <button
                                            key={n.id}
                                            onClick={() => setSelectedNpcId(n.id)}
                                            aria-pressed={isSelected}
                                            className={isSelected ? 'detail-tile-filled' : 'detail-tile'}
                                            style={{
                                                cursor: 'pointer',
                                                borderTop: '3px solid #667eea',
                                                background: isSelected ? 'rgba(102,126,234,0.15)' : undefined,
                                                border: isSelected ? '2px solid #667eea' : undefined,
                                            }}
                                        >
                                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{n.name}</span>
                                            {n.level != null && (
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lv {n.level}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>
            )}

            <div className="grid-responsive-2">
                {/* Left: Roll Controls */}
                <div className="section-card-purple">
                    <h3 className="section-title-purple">
                        <span>{mode === 'heal' ? '🩹' : '🎲'}</span>{' '}
                        {mode === 'pokemon' ? 'Pokemon' : mode === 'trainer' ? 'Trainer' : mode === 'heal' ? 'Use Healing Item' : 'Custom Roll'}
                    </h3>

                    {mode === 'pokemon' && (
                        <div>
                            {/* Pokemon Selector */}
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>Select Pokemon</label>
                                <PokemonSpritePicker
                                    party={actorParty}
                                    selectedId={selectedPokemonId}
                                    onSelect={(id) => {
                                        setSelectedPokemonId(id);
                                        setSelectedMove(null);
                                        resetCombatStages();
                                    }}
                                    getHP={getPokemonHP}
                                    emptyMessage={actor.isNpc ? `${actor.name} has no Pokémon on its team — add one in GM Tools → NPC Roster.` : undefined}
                                />
                            </div>

                            {/* Pokemon sub-mode tabs */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                                {[
                                    { id: 'move',  label: '⚔️ Move' },
                                    { id: 'skill', label: '🎯 Skill Check' },
                                ].map(({ id, label }) => (
                                    <button
                                        key={id}
                                        onClick={() => setPokemonSubmode(id)}
                                        style={{
                                            flex: 1, padding: '5px 12px', borderRadius: '6px', border: 'none',
                                            cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                            background: pokemonSubmode === id ? '#667eea' : 'var(--bg-secondary)',
                                            color: pokemonSubmode === id ? 'white' : 'var(--text-secondary)',
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Empty state */}
                            {!selectedPokemon && (
                                <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎲</div>
                                    Select a Pokémon above to roll moves, track HP, and manage battle mechanics.
                                </div>
                            )}

                            {/* Pokemon Sprite */}
                            {selectedPokemon && (() => {
                                const isGmax = isDynamaxed && !!(GAME_DATA.gigantamaxForms?.[selectedPokemon.species]);
                                const img = megaEvolved && currentMegaForm
                                    ? getMegaSprite(selectedPokemon, currentMegaForm)
                                    : isGmax
                                        ? getGigantamaxSprite(selectedPokemon)
                                        : getPokemonDisplayImage(selectedPokemon);
                                if (!img) return null;
                                return (
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                                        <img
                                            src={img}
                                            alt={selectedPokemon.name || selectedPokemon.species}
                                            style={{ width: '96px', height: '96px', objectFit: 'contain', imageRendering: !selectedPokemon.avatar ? 'pixelated' : 'auto' }}
                                        />
                                    </div>
                                );
                            })()}

                            {/* Held Item */}
                            {selectedPokemon?.heldItem && (() => {
                                const itemData = GAME_DATA?.items?.[selectedPokemon.heldItem];
                                return (
                                    <div
                                        onClick={() => { if (showDetail && itemData) showDetail('item', selectedPokemon.heldItem, itemData); }}
                                        style={{ marginBottom: '12px', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px', cursor: showDetail && itemData ? 'pointer' : 'default' }}
                                        title={itemData ? 'Click to view item details' : selectedPokemon.heldItem}
                                    >
                                        <span style={{ fontSize: '16px' }}>🎒</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>Held Item</div>
                                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{selectedPokemon.heldItem}</div>
                                            {itemData?.effect && (
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{itemData.effect}</div>
                                            )}
                                        </div>
                                        {showDetail && itemData && (
                                            <span style={{ fontSize: '13px', color: '#667eea', flexShrink: 0 }}>Details →</span>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Pokemon HP Tracker */}
                            {selectedPokemon && (() => {
                                const hp = getPokemonHP(selectedPokemon);
                                // During Dynamax, track HP locally (scaled ×5); otherwise persist to Pokémon data
                                const handleDamage = (val) => {
                                    if (isDynamaxed) {
                                        setPokemonHP(prev => ({ ...prev, current: Math.max(0, (prev?.current ?? hp.current) - val) }));
                                    } else {
                                        updateActorPokemon(selectedPokemon.id, { currentDamage: Math.min(hp.max, (selectedPokemon.currentDamage || 0) + val) });
                                    }
                                };
                                const handleHeal = (val) => {
                                    if (isDynamaxed) {
                                        setPokemonHP(prev => ({ ...prev, current: Math.min(prev?.max ?? hp.max, (prev?.current ?? hp.current) + val) }));
                                    } else {
                                        updateActorPokemon(selectedPokemon.id, { currentDamage: Math.max(0, (selectedPokemon.currentDamage || 0) - val) });
                                    }
                                };
                                const handleFull = () => {
                                    if (isDynamaxed) {
                                        setPokemonHP(prev => ({ ...prev, current: prev?.max ?? hp.max }));
                                    } else {
                                        updateActorPokemon(selectedPokemon.id, { currentDamage: 0 });
                                    }
                                };
                                return (
                                    <HPTracker
                                        label={isDynamaxed ? 'HP (Dynamax)' : 'HP'}
                                        currentHP={hp.current}
                                        maxHP={hp.max}
                                        onDamage={handleDamage}
                                        onHeal={handleHeal}
                                        onFull={handleFull}
                                    />
                                );
                            })()}

                            {(() => {
                                const activeTypes = isTerastallized && selectedPokemon?.teraType
                                    ? [selectedPokemon.teraType]
                                    : (megaEvolved && currentMegaForm?.types?.length ? currentMegaForm.types : selectedPokemon?.types);
                                return (
                                    <TypeMatchupDisplay
                                        selectedPokemon={selectedPokemon}
                                        megaEvolved={megaEvolved}
                                        currentMegaForm={currentMegaForm}
                                        activeTypes={isTerastallized && selectedPokemon?.teraType ? activeTypes : undefined}
                                    />
                                );
                            })()}

                            <StatusConditionUI selectedPokemon={selectedPokemon} updatePokemon={updateActorPokemon} />

                            {(() => {
                                return (
                                    <>
                                        <MegaEvolutionPanel
                                            selectedPokemon={selectedPokemon}
                                            megaForms={megaForms}
                                            megaEvolved={megaEvolved}
                                            currentMegaForm={currentMegaForm}
                                            onMegaEvolve={handleMegaEvolve}
                                            onMegaRevert={handleMegaRevert}
                                            label={BATTLE_FORM_CHANGES[selectedPokemon?.species] ? 'Form Change' : 'Mega Evolution'}
                                            isFormChange={!!BATTLE_FORM_CHANGES[selectedPokemon?.species]}
                                            disabled={anyMechanicActive && !megaEvolved}
                                        />
                                    </>
                                );
                            })()}

                            <CombatStagesPanel
                                selectedPokemon={selectedPokemon}
                                combatStages={combatStages}
                                getStatsWithMega={getStatsWithMega}
                                updateCombatStage={updateCombatStage}
                                resetCombatStages={resetCombatStages}
                                onHelp={() => showHelp('combat-stages')}
                            />

                            {pokemonSubmode === 'move' && (<>
                            {/* STAB Toggle & AC Override */}
                            {selectedPokemon && (
                                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <label
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                        title="Same Type Attack Bonus (STAB): Fixed +4 damage when using a move matching the Pokémon's type."
                                    >
                                        <input type="checkbox" checked={applyStab} onChange={(e) => setApplyStab(e.target.checked)} />
                                        <span style={{ fontSize: '13px' }}>Apply STAB</span>
                                    </label>
                                    <span
                                        style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                                        title="Same Type Attack Bonus (STAB): Fixed +4 damage when using a move matching the Pokémon's type."
                                    >
                                        (+{calculateSTAB()} for matching type)
                                    </span>
                                    {selectedMove && selectedPokemon?.accuracyMods && (() => {
                                        const k = selectedMove.category === 'Physical' ? 'atk' : selectedMove.category === 'Status' ? 'eff' : 'satk';
                                        const bonus = selectedPokemon.accuracyMods[k];
                                        return bonus != null ? (
                                            <span
                                                style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                                                title={`This Pokémon's accuracy bonus for ${selectedMove.category} moves (from its Pokédex entry). Added to the 1d20 accuracy roll.`}
                                            >
                                                Acc: +{bonus}
                                            </span>
                                        ) : null;
                                    })()}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }} title="Enter the target's relevant stat value (DEF/SDEF/SPD). Leave blank and GM decides hit/miss.">
                                        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#667eea' }}>
                                            {selectedMove?.category === 'Physical' ? 'vs DEF:' : selectedMove?.category === 'Status' ? 'vs SPD:' : 'vs SDEF:'}
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={acOverride}
                                            onChange={(e) => setAcOverride(e.target.value)}
                                            placeholder="—"
                                            style={{ width: '50px', padding: '4px 8px', borderRadius: '4px', border: acOverride !== '' ? '2px solid #667eea' : '1px solid var(--border-medium)', fontSize: '13px', textAlign: 'center', background: acOverride !== '' ? 'var(--input-bg-hover)' : 'var(--input-bg)' }}
                                        />
                                        {acOverride !== '' && (
                                            <button onClick={() => setAcOverride('')} style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }} title="Clear target stat" aria-label="Clear target stat">✕</button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <MoveSelector
                                selectedPokemon={selectedPokemon}
                                moves={displayedMoves}
                                selectedMove={selectedMove}
                                onSelectMove={setSelectedMove}
                                showDetail={showDetail}
                                showHelp={showHelp}
                                gameData={GAME_DATA}
                                isDynamaxed={isDynamaxed}
                                canGigantamax={canGigantamax}
                                gMaxMoveUsed={gMaxMoveUsed}
                                onDynamaxActivate={handleDynamax}
                                onDynamaxRevert={handleDynamaxRevert}
                                dynamaxDisabled={(anyMechanicActive || zMoveActive) && !isDynamaxed}
                                zMoveActive={zMoveActive}
                                zMoveUsed={zMoveUsed}
                                hasZMoves={hasZMoves}
                                onZMoveActivate={handleZMoveActivate}
                                onZMoveDeactivate={handleZMoveDeactivate}
                                onZMoveReset={handleZMoveReset}
                                zMoveDisabled={anyMechanicActive}
                                isTerastallized={isTerastallized}
                                teraType={selectedPokemon?.teraType || ''}
                                teraBlastUsesLeft={teraBlastUsesLeft}
                                onTeraActivate={handleTerastallize}
                                onTeraRevert={handleTeraRevert}
                                teraDisabled={(anyMechanicActive || zMoveActive) && !isTerastallized}
                            />

                            {/* Roll Button */}
                            {(() => {
                                const m = selectedMove;
                                // Frequency (1/day, 3/day, 1/GMAX, etc.) is tracked and shown for reference,
                                // but never blocks the roll — how strictly to enforce it is a table's own call.
                                const isDisabled = !selectedPokemon || !m;
                                const bg = !selectedPokemon || !m ? '#ccc'
                                    : m.isGMaxMove ? 'linear-gradient(135deg, #b8860b, #ffd700)'
                                    : m.isZMove ? 'linear-gradient(135deg, #c62828, #e53935)'
                                    : m.isTeraMove ? `linear-gradient(135deg, ${getTypeColor(selectedPokemon?.teraType || 'Normal')}, ${getTypeColor(selectedPokemon?.teraType || 'Normal')}cc)`
                                    : isDynamaxed ? 'linear-gradient(135deg, #4a0080, #9b27af)'
                                    : 'linear-gradient(135deg, #667eea, #764ba2)';
                                const fg = !selectedPokemon || !m ? '#555'
                                    : m.isGMaxMove ? '#1a1a00'
                                    : 'white';
                                const label = !m ? 'Roll Attack!'
                                    : m.isMaxGuard ? 'Log Max Guard'
                                    : m.isGMaxMove ? `Roll G-Max! (${m.damage})${gMaxMoveUsed ? ' — already used' : ''}`
                                    : m.isMaxMove ? 'Roll Max Move! (4d12)'
                                    : m.isZMove ? `Roll Z-Move! (${m.damage})${zMoveUsed ? ' — already used' : ''}`
                                    : m.isTeraBlast ? `Roll Tera Blast! (3d12) — ${teraBlastUsesLeft}/3 left`
                                    : m.isTeraCrown ? `Roll ${m.name}! (${m.damage})`
                                    : 'Roll Attack!';
                                return (
                                    <button
                                        onClick={rollPokemonMove}
                                        disabled={isDisabled}
                                        style={{ width: '100%', padding: '15px', background: isDisabled ? '#ccc' : bg, color: isDisabled ? '#555' : fg, border: 'none', borderRadius: '8px', cursor: isDisabled ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}
                                    >
                                        {label}
                                    </button>
                                );
                            })()}
                            </>)}

                            {/* Pokémon Skill Check Panel */}
                            {pokemonSubmode === 'skill' && (
                                <div>
                                    {(() => {
                                        const rollableSkills = (selectedPokemon?.pokemonSkills || [])
                                            .filter(s => s.name in POKEMON_CAPABILITY_STAT);
                                        if (selectedPokemon && rollableSkills.length === 0) {
                                            return (
                                                <div style={{ padding: '12px', borderRadius: '6px', background: 'var(--bg-secondary)', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                    This Pokémon has no rollable capabilities (Stealth, Tracker, or Wired).
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    <select
                                        value={selectedPokemonSkill}
                                        onChange={e => setSelectedPokemonSkill(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-medium)', marginBottom: '8px' }}
                                    >
                                        <option value="">— select capability —</option>
                                        {(selectedPokemon?.pokemonSkills || [])
                                            .filter(s => s.name in POKEMON_CAPABILITY_STAT)
                                            .map(s => (
                                                <option key={s.name} value={s.name}>{s.name}</option>
                                            ))}
                                    </select>

                                    {selectedPokemonSkill && (() => {
                                        const statKey = getPokemonCapabilityStat(selectedPokemonSkill);
                                        const baseStat = (selectedPokemon?.baseStats || selectedPokemon?.stats)?.[statKey] || 0;
                                        const mod = calcModifier(baseStat);
                                        return (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0' }}>
                                                1d20 + ⌊{statKey.toUpperCase()} {baseStat}/2⌋ = 1d20 +{mod}
                                            </div>
                                        );
                                    })()}

                                    <button
                                        onClick={rollPokemonSkill}
                                        disabled={!selectedPokemon || !selectedPokemonSkill}
                                        className="roll-button"
                                        style={{ width: '100%', padding: '15px', marginTop: '8px', background: (!selectedPokemon || !selectedPokemonSkill) ? '#ccc' : 'linear-gradient(135deg, #26a69a, #00796b)', color: (!selectedPokemon || !selectedPokemonSkill) ? '#555' : 'white', border: 'none', borderRadius: '8px', cursor: (!selectedPokemon || !selectedPokemonSkill) ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}
                                    >
                                        🎯 Roll {selectedPokemonSkill || 'Skill'} Check
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'trainer' && (
                        <div>
                            {/* Trainer Stats Display */}
                            <div className="trainer-stats-display" style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                                    {actor.name}{actor.level != null && <> — Level {actor.level}</>}
                                    {actor.isNpc && <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '8px', background: '#e6510022', color: '#e65100', fontSize: '10px', fontWeight: 'bold', verticalAlign: 'middle' }}>NPC</span>}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                                    {[
                                        { key: 'atk',  label: 'ATK',  color: '#ff5722' },
                                        { key: 'def',  label: 'DEF',  color: '#2196f3' },
                                        { key: 'satk', label: 'SATK', color: '#9c27b0' },
                                        { key: 'sdef', label: 'SDEF', color: '#ff9800' },
                                        { key: 'spd',  label: 'SPD',  color: '#00bcd4' },
                                    ].map(stat => {
                                        const value = actor.stats?.[stat.key] || 3;
                                        const mod = calcModifier(value);
                                        return (
                                            <div key={stat.key} className="trainer-stat-mini-box" style={{ textAlign: 'center', padding: '4px', borderRadius: '4px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: stat.color }}>{stat.label}</div>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{value}</div>
                                                <div style={{ fontSize: '12px', color: mod >= 0 ? '#4caf50' : '#f44336' }}>{mod >= 0 ? '+' : ''}{mod}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Actor HP Tracker */}
                            <HPTracker
                                label={actor.isNpc ? `${actor.name} HP` : 'Trainer HP'}
                                currentHP={actorCurrentHP}
                                maxHP={actorMaxHP}
                                onDamage={handleActorDamage}
                                onHeal={handleActorHeal}
                                onFull={handleActorFull}
                            />

                            {/* Submode tabs */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                {[
                                    { id: 'skill',  label: 'Skill Check' },
                                    { id: 'attack', label: 'Unarmed Attack' },
                                    ...(!actor.isNpc ? [{ id: 'weapon', label: 'Weapon Attack' }] : []),
                                ].map(({ id, label }) => (
                                    <button
                                        key={id}
                                        onClick={() => setTrainerSubmode(id)}
                                        style={{
                                            padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                            background: trainerSubmode === id ? '#667eea' : 'var(--bg-secondary)',
                                            color: trainerSubmode === id ? 'white' : 'var(--text-secondary)',
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* ── Skill Check ── */}
                            {trainerSubmode === 'skill' && (
                                <>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>Select Skill</label>
                                    <select
                                        value={selectedSkill}
                                        onChange={(e) => setSelectedSkill(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-medium)', marginBottom: '8px' }}
                                    >
                                        <option value="">Choose a skill...</option>
                                        {Object.entries(GAME_DATA.skills || {}).map(([name, data]) => {
                                            const skills = actor.skills || {};
                                            const rank = Array.isArray(skills) ? (skills.includes(name) ? 1 : 0) : (skills[name] || 0);
                                            return (
                                                <option key={name} value={name}>
                                                    {name} ({data.stat}) {rank > 0 ? (rank === 2 ? '✓✓ +5' : '✓ +2') : ''}
                                                </option>
                                            );
                                        })}
                                    </select>

                                    {actor.isNpc && (
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                            NPCs roll skill checks untrained (stat modifier only) — the roster doesn't track individual talents.
                                        </div>
                                    )}

                                    {selectedSkill && GAME_DATA.skills?.[selectedSkill] && (() => {
                                        const skillData = GAME_DATA.skills[selectedSkill];
                                        const statKey = skillData.stat?.toLowerCase();
                                        const baseStat = actor.stats?.[statKey] || 3;
                                        const modifier = calcModifier(baseStat);
                                        const skills = actor.skills || {};
                                        const skillRank = Array.isArray(skills) ? (skills.includes(selectedSkill) ? 1 : 0) : (skills[selectedSkill] || 0);
                                        const talentBonus = skillRank === 2 ? 5 : skillRank === 1 ? 2 : 0;
                                        return (
                                            <div className="skill-info-box" style={{ marginBottom: '12px', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
                                                <div><strong>{selectedSkill}</strong> ({skillData.stat})</div>
                                                <div style={{ marginTop: '4px' }}>
                                                    1d20 +{modifier} (stat){skillRank > 0 && <span style={{ color: '#4caf50' }}> +{talentBonus} (talent)</span>}
                                                </div>
                                                <div className="text-muted" style={{ marginTop: '2px' }}>{skillData.description}</div>
                                            </div>
                                        );
                                    })()}

                                    <button
                                        onClick={rollTrainerSkill}
                                        disabled={!selectedSkill}
                                        style={{ width: '100%', padding: '15px', background: selectedSkill ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#ccc', color: selectedSkill ? 'white' : '#555', border: 'none', borderRadius: '8px', cursor: selectedSkill ? 'pointer' : 'not-allowed', fontSize: '16px', fontWeight: 'bold' }}
                                    >
                                        Roll Skill Check!
                                    </button>
                                </>
                            )}

                            {/* ── Unarmed Attack ── */}
                            {trainerSubmode === 'attack' && (() => {
                                const atkVal = actor.stats?.atk || 3;
                                const atkMod = calcModifier(atkVal);
                                return (
                                    <>
                                        <div className="detail-tile-grid" style={{ marginBottom: '8px' }}>
                                            <TrainerAttackCard
                                                moveName="Unarmed Strike" moveType="Normal"
                                                damage={`2d6 +${atkMod} (ATK)`} frequency="At-Will"
                                                isSelected
                                            />
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#667eea', whiteSpace: 'nowrap' }}>vs DEF:</label>
                                            <input
                                                type="number" min="1" max="20"
                                                value={trainerAcOverride}
                                                onChange={(e) => setTrainerAcOverride(e.target.value)}
                                                placeholder="—"
                                                style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: trainerAcOverride !== '' ? '2px solid #667eea' : '1px solid var(--border-medium)', fontSize: '13px', textAlign: 'center' }}
                                            />
                                            {trainerAcOverride !== '' && (
                                                <button onClick={() => setTrainerAcOverride('')} style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                                            )}
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Leave blank = always hit</span>
                                        </div>

                                        <button
                                            onClick={rollTrainerAttack}
                                            style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #ff5722, #e64a19)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
                                        >
                                            Roll Unarmed Attack!
                                        </button>
                                    </>
                                );
                            })()}

                            {/* ── Weapon Attack ── */}
                            {trainerSubmode === 'weapon' && (() => {
                                const atkVal = trainer.stats?.atk || 3;
                                const atkMod = calcModifier(atkVal);
                                // Rules: "If you are holding a weapon" — only equipped weapons are usable.
                                // Check the official catalog first, then fall back to the inventory item's
                                // own `type` field so custom/homebrew weapons (never in GAME_DATA.items)
                                // are recognized too.
                                const equippedWeapons = (trainer.equippedItems || []).filter(name => {
                                    const catalogType = GAME_DATA?.items?.[name]?.type;
                                    const invType = inventory.find(i => i.name.toLowerCase() === name.toLowerCase())?.type;
                                    return (catalogType || invType || '').toLowerCase() === 'weapon';
                                });
                                return (
                                    <>
                                        {equippedWeapons.length === 0 ? (
                                            <div style={{ padding: '12px', borderRadius: '6px', background: 'var(--bg-secondary)', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                                No weapons equipped. Requires the <strong>Weapons Master</strong> feature (Martial Artist Lv 6).{' '}
                                                <button onClick={() => setActiveTab('inventory')} style={{ background: 'none', border: 'none', color: 'var(--color-purple, #667eea)', cursor: 'pointer', padding: 0, fontSize: '13px', textDecoration: 'underline' }}>Go to Inventory →</button>
                                            </div>
                                        ) : (
                                            <div className="detail-tile-grid" style={{ marginBottom: '8px' }}>
                                                {equippedWeapons.map(name => {
                                                    const info = getWeaponInfo(name);
                                                    return (
                                                        <TrainerAttackCard
                                                            key={name}
                                                            moveName={info.moveName} moveType={info.moveType} subtitle={name}
                                                            damage={`2d6 +${atkMod} (ATK)`} frequency="At-Will"
                                                            isSelected={selectedWeapon === name}
                                                            onSelect={() => setSelectedWeapon(name)}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#667eea', whiteSpace: 'nowrap' }}>vs DEF:</label>
                                            <input
                                                type="number" min="1" max="20"
                                                value={trainerAcOverride}
                                                onChange={(e) => setTrainerAcOverride(e.target.value)}
                                                placeholder="—"
                                                style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: trainerAcOverride !== '' ? '2px solid #667eea' : '1px solid var(--border-medium)', fontSize: '13px', textAlign: 'center' }}
                                            />
                                            {trainerAcOverride !== '' && (
                                                <button onClick={() => setTrainerAcOverride('')} style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                                            )}
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Leave blank = always hit</span>
                                        </div>

                                        <button
                                            onClick={rollTrainerAttack}
                                            disabled={!selectedWeapon}
                                            style={{ width: '100%', padding: '15px', background: selectedWeapon ? 'linear-gradient(135deg, #b71c1c, #e53935)' : '#ccc', color: selectedWeapon ? 'white' : '#555', border: 'none', borderRadius: '8px', cursor: selectedWeapon ? 'pointer' : 'not-allowed', fontSize: '16px', fontWeight: 'bold' }}
                                        >
                                            Roll Weapon Attack!
                                        </button>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {mode === 'custom' && (
                        <CustomDicePanel customDice={customDice} setCustomDice={setCustomDice} onRoll={rollCustomDice} />
                    )}

                    {mode === 'heal' && (
                        <>
                            <HealModePanel
                                selectedPokemonId={selectedPokemonId}
                                setSelectedPokemonId={setSelectedPokemonId}
                                party={party}
                                healingInventory={healingInventory}
                                onUseItem={rollHealItem}
                            />
                            {/* Rest & Recovery */}
                            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-light)' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>🌙 Rest & Recovery</div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                                    Trainer recovers 1d6 HP. Each Pokémon recovers ⌊max HP ÷ 6⌋. Daily equipment bonuses reset.
                                </p>
                                <button
                                    onClick={() => {
                                        const allPkmn = [...party, ...(reserve || [])].map(p => ({ pokemon: p, maxHp: calculatePokemonHP(p) }));
                                        restAndRecover(updatePokemon, allPkmn);
                                    }}
                                    style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                                >
                                    🌙 Rest
                                </button>
                            </div>
                        </>
                    )}

                    <DiscordWebhookConfig />
                </div>

                {/* Right: Roll History */}
                <RollHistory rollHistory={rollHistory} setRollHistory={setRollHistory} />
            </div>
        </div>
    );
};

export default BattleTab;
