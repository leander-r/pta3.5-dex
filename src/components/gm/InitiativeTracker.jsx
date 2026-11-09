// ============================================================
// Initiative Tracker — turn order for NPCs, players, and wild Pokémon
// ============================================================
// Session scratchpad: combatants are snapshots taken at add-time (not
// live references), persisted to localStorage so a page refresh doesn't
// lose an in-progress encounter. Not part of export/import/save slots —
// permanent HP changes are still applied back in the Trainer/Pokémon tab.

import React, { useState, useEffect, useMemo } from 'react';
import { useUI, useModal, useData, useTrainerContext, useGameData } from '../../contexts/index.js';
import { HELP_BTN_STYLE } from '../common/helpBtnStyle.js';
import { getPokemonDisplayImage } from '../../utils/pokemonSprite.js';
import { getTypeColor, getContrastTextColor } from '../../utils/typeUtils.js';
import { getActualStats, calculatePokemonHP } from '../../utils/dataUtils.js';
import toast from '../../utils/toast.js';

const STORAGE_KEY = 'pta35-initiative-tracker';
const STAT_KEYS = ['atk', 'def', 'satk', 'sdef', 'spd'];
const STAT_LABELS = { atk: 'ATK', def: 'DEF', satk: 'SATK', sdef: 'SDEF', spd: 'SPD' };

const loadTracker = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch {}
    return { combatants: [], round: 1, currentTurn: 0 };
};

const newId = () => Date.now() * 1000 + Math.floor(Math.random() * 999);

const hpColor = (current, max) => {
    if (max <= 0) return '#4caf50';
    const percent = (current / max) * 100;
    return percent > 50 ? '#4caf50' : percent > 25 ? '#ff9800' : '#f44336';
};

const KIND_LABELS = { trainer: 'Player', pokemon: "Player's Pokémon", npc: 'NPC', 'npc-pokemon': "NPC's Pokémon", custom: 'Custom' };
const KIND_COLORS = { trainer: '#2196f3', pokemon: '#4caf50', npc: '#e65100', 'npc-pokemon': '#ff9800', custom: '#9c27b0' };

const trainerToCombatant = (t) => ({
    id: newId(), sourceId: t.id, name: t.name || 'Unnamed Trainer', kind: 'trainer', level: t.level ?? 0,
    initiative: null, spd: t.stats?.spd ?? 3,
    hp: { current: Math.max(0, (20 + (t.hpRolls || []).reduce((s, v) => s + v, 0)) - (t.currentDamage || 0)), max: 20 + (t.hpRolls || []).reduce((s, v) => s + v, 0) },
    stats: { ...t.stats }, types: [], moves: [], features: (t.features || []).map(f => typeof f === 'object' ? f.name : f),
    avatar: t.avatar || ''
});

const pokemonToCombatant = (p, kind = 'pokemon') => {
    const actualStats = getActualStats(p);
    const maxHP = calculatePokemonHP(p);
    return {
        id: newId(), sourceId: p.id, name: p.name || p.species || 'Pokémon', kind, level: null,
        initiative: null, spd: actualStats.spd,
        hp: { current: Math.max(0, maxHP - (p.currentDamage || 0)), max: maxHP },
        stats: actualStats, types: p.types || [], moves: (p.moves || []).map(m => m.name), features: [],
        avatar: getPokemonDisplayImage(p) || ''
    };
};

// Features are gated to the NPC's level (GMG: NPCs get access to what all
// level-N trainers of their class have — not the whole class feature list).
// PTA3: trainers (NPCs included) get a flat 20 HP + 1d4 rolled at levels 3/7/11
// — see the matching hpRolls logic in NpcRoster.jsx.
const npcMaxHp = (n) => 20 + (n.hpRolls || []).reduce((s, v) => s + (v || 0), 0);

const npcToCombatant = (n, GAME_DATA) => {
    const level = n.level ?? 1;
    const maxHp = npcMaxHp(n);
    const features = Object.entries(GAME_DATA?.features || {})
        .filter(([, f]) => f.category === n.trainerClass)
        .map(([name, f]) => [name, parseInt((f.prerequisites || '').match(/Level\s+(\d+)/i)?.[1] || 99)])
        .filter(([, lv]) => lv <= level)
        .sort((a, b) => a[1] - b[1])
        .map(([name]) => name);
    return {
        id: newId(), sourceId: n.id, name: n.name, kind: 'npc', level,
        initiative: null, spd: n.stats?.spd ?? 3,
        hp: { current: Math.max(0, maxHp - (n.currentDamage || 0)), max: maxHp },
        stats: { ...n.stats }, types: [], moves: [], features,
        avatar: ''
    };
};

const HPStepper = ({ current, max, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button onClick={() => onChange(Math.max(0, current - 1))} title="Damage 1"
            style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: '#f44336', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>−</button>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: hpColor(current, max), minWidth: '52px', textAlign: 'center' }}>{current}/{max}</span>
        <button onClick={() => onChange(Math.min(max, current + 1))} title="Heal 1"
            style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: '#4caf50', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>+</button>
    </div>
);

// Shared "already in the tracker?" check — combatant.sourceId points back to the
// original NPC/trainer/Pokémon id, separate from combatant.id (a fresh synthetic id
// per add, since the same Pokémon can't otherwise be told apart from a duplicate add).
const isAlreadyAdded = (combatants, kind, sourceId) => combatants.some(c => c.kind === kind && c.sourceId === sourceId);

const AddFromNpcRoster = ({ npcs, onAdd, GAME_DATA, combatants }) => (
    <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-medium)', maxHeight: '260px', overflowY: 'auto' }}>
        {npcs.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No saved NPCs — build one in NPC Roster first.</div>}
        {npcs.map(n => {
            const team = n.team || [];
            const npcAdded = isAlreadyAdded(combatants, 'npc', n.id);
            const allTeamAdded = team.length > 0 && team.every(p => isAlreadyAdded(combatants, 'npc-pokemon', p.id));
            return (
                <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ flex: 1, fontSize: '13px', fontWeight: 'bold' }}>{n.name}{n.level != null && <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}> · Lv {n.level}</span>}</span>
                        <button onClick={() => onAdd(npcToCombatant(n, GAME_DATA))}
                            disabled={npcAdded}
                            title={npcAdded ? 'Already in the tracker' : undefined}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-primary)', cursor: npcAdded ? 'not-allowed' : 'pointer', fontSize: '11px', opacity: npcAdded ? 0.5 : 1 }}>
                            {npcAdded ? '✓ NPC' : '＋ NPC'}
                        </button>
                        <button onClick={() => {
                                if (!npcAdded) onAdd(npcToCombatant(n, GAME_DATA));
                                team.forEach(p => { if (!isAlreadyAdded(combatants, 'npc-pokemon', p.id)) onAdd(pokemonToCombatant(p, 'npc-pokemon')); });
                            }}
                            disabled={team.length === 0 || (npcAdded && allTeamAdded)}
                            title={team.length === 0 ? undefined : (npcAdded && allTeamAdded) ? 'Already in the tracker' : undefined}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', cursor: (team.length === 0 || (npcAdded && allTeamAdded)) ? 'not-allowed' : 'pointer', fontSize: '11px', opacity: (team.length === 0 || (npcAdded && allTeamAdded)) ? 0.5 : 1 }}>
                            ＋ NPC + Team
                        </button>
                    </div>
                    {team.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '4px' }}>
                            {team.map(p => {
                                const added = isAlreadyAdded(combatants, 'npc-pokemon', p.id);
                                return (
                                    <button key={p.id} onClick={() => onAdd(pokemonToCombatant(p, 'npc-pokemon'))}
                                        disabled={added}
                                        title={added ? 'Already in the tracker' : undefined}
                                        style={{ padding: '3px 8px', borderRadius: '10px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-primary)', cursor: added ? 'not-allowed' : 'pointer', fontSize: '10px', opacity: added ? 0.5 : 1 }}>
                                        {added ? '✓' : '＋'} {p.name || p.species}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);

const AddFromPlayers = ({ trainers, onAdd, combatants }) => (
    <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-medium)', maxHeight: '260px', overflowY: 'auto' }}>
        {trainers.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No trainers found.</div>}
        {trainers.map(t => {
            const trainerAdded = isAlreadyAdded(combatants, 'trainer', t.id);
            const party = t.party || [];
            const allPartyAdded = party.length > 0 && party.every(p => isAlreadyAdded(combatants, 'pokemon', p.id));
            return (
                <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ flex: 1, fontSize: '13px', fontWeight: 'bold' }}>{t.name || 'Unnamed'}<span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}> · Lv {t.level ?? 0}</span></span>
                        <button onClick={() => onAdd(trainerToCombatant(t))}
                            disabled={trainerAdded}
                            title={trainerAdded ? 'Already in the tracker' : undefined}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-primary)', cursor: trainerAdded ? 'not-allowed' : 'pointer', fontSize: '11px', opacity: trainerAdded ? 0.5 : 1 }}>
                            {trainerAdded ? '✓ Trainer' : '＋ Trainer'}
                        </button>
                        <button onClick={() => {
                                if (!trainerAdded) onAdd(trainerToCombatant(t));
                                party.forEach(p => { if (!isAlreadyAdded(combatants, 'pokemon', p.id)) onAdd(pokemonToCombatant(p, 'pokemon')); });
                            }}
                            disabled={party.length === 0 || (trainerAdded && allPartyAdded)}
                            title={party.length === 0 ? undefined : (trainerAdded && allPartyAdded) ? 'Already in the tracker' : undefined}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', cursor: (party.length === 0 || (trainerAdded && allPartyAdded)) ? 'not-allowed' : 'pointer', fontSize: '11px', opacity: (party.length === 0 || (trainerAdded && allPartyAdded)) ? 0.5 : 1 }}>
                            ＋ Trainer + Party
                        </button>
                    </div>
                    {party.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '4px' }}>
                            {party.map(p => {
                                const added = isAlreadyAdded(combatants, 'pokemon', p.id);
                                return (
                                    <button key={p.id} onClick={() => onAdd(pokemonToCombatant(p, 'pokemon'))}
                                        disabled={added}
                                        title={added ? 'Already in the tracker' : undefined}
                                        style={{ padding: '3px 8px', borderRadius: '10px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-primary)', cursor: added ? 'not-allowed' : 'pointer', fontSize: '10px', opacity: added ? 0.5 : 1 }}>
                                        {added ? '✓' : '＋'} {p.name || p.species}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);

const AddCustom = ({ onAdd }) => {
    const [name, setName] = useState('');
    const [hpMax, setHpMax] = useState(20);
    const [spd, setSpd] = useState(3);

    const submit = () => {
        if (!name.trim()) { toast.warning('Enter a name first.'); return; }
        onAdd({
            id: newId(), name: name.trim(), kind: 'custom',
            initiative: null, spd: parseInt(spd) || 0,
            hp: { current: hpMax, max: hpMax },
            stats: null, types: [], moves: [], features: [], avatar: ''
        });
        setName(''); setHpMax(20); setSpd(3);
    };

    return (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-medium)' }}>
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
                style={{ flex: '1 1 140px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '13px' }} />
            <input type="number" placeholder="Max HP" value={hpMax} onChange={(e) => setHpMax(parseInt(e.target.value) || 0)}
                style={{ width: '80px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '13px' }} />
            <input type="number" placeholder="Speed" title="Speed stat — determines default turn order and the optional d20 + Speed roll" value={spd} onChange={(e) => setSpd(e.target.value)}
                style={{ width: '80px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '13px' }} />
            <button onClick={submit} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Add</button>
        </div>
    );
};

// Lightweight, book-accurate GM check: 1d20 + ⌊stat/2⌋ (or a manual flat bonus), with an
// optional opposing target number — the same resolution the HB1 combat demo uses for GM-side
// rolls (e.g. "1d20 + Special Attack vs the defender's raw Special Defense"). Deliberately not
// a move-damage roll: combatant snapshots here only keep move *names*, not full move data —
// use the Dice Roller (Battle tab) for that, which now also supports NPCs and their teams.
const QuickCheckPanel = ({ c, onRoll }) => {
    const [mode, setMode] = useState(c.stats ? 'stat' : 'flat');
    const [statKey, setStatKey] = useState(c.stats ? STAT_KEYS[0] : '');
    const [flatMod, setFlatMod] = useState('0');
    const [vsTarget, setVsTarget] = useState('');
    const [lastResult, setLastResult] = useState(null);

    const modifier = mode === 'stat' ? Math.floor((c.stats?.[statKey] || 0) / 2) : (parseInt(flatMod) || 0);
    const label = mode === 'stat' ? STAT_LABELS[statKey] : 'Flat';

    const roll = () => {
        const d20 = 1 + Math.floor(Math.random() * 20);
        const total = d20 + modifier;
        const target = vsTarget !== '' ? (parseInt(vsTarget) || null) : null;
        const success = target != null ? total >= target : null;
        const result = { d20, mod: modifier, total, label, target, success };
        setLastResult(result);
        onRoll?.({ combatantName: c.name, combatantKind: c.kind, ...result, timestamp: Date.now() });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px', borderRadius: '6px', background: 'var(--bg-section)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Rolls 1d20 + a modifier — for anything that isn't a full move (an opposed check, a reaction, an ad hoc ruling). Set a target to auto-resolve Success/Fail, or leave it blank and judge the total yourself.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setMode('stat')} disabled={!c.stats}
                    title={c.stats ? "Use ⌊stat/2⌋ as the modifier — the same math the book uses when a GM rolls an NPC's stat" : 'No stats on this entry — use Flat instead'}
                    style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border-medium)', cursor: c.stats ? 'pointer' : 'not-allowed', fontSize: '11px', fontWeight: 'bold', opacity: c.stats ? 1 : 0.4, background: mode === 'stat' ? '#667eea' : 'var(--input-bg)', color: mode === 'stat' ? 'white' : 'var(--text-primary)' }}>
                    Stat
                </button>
                <button onClick={() => setMode('flat')}
                    title="Enter your own modifier by hand — e.g. a trained skill's talent bonus"
                    style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border-medium)', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', background: mode === 'flat' ? '#667eea' : 'var(--input-bg)', color: mode === 'flat' ? 'white' : 'var(--text-primary)' }}>
                    Flat
                </button>
            </div>
            {mode === 'stat' ? (
                <select value={statKey} onChange={(e) => setStatKey(e.target.value)}
                    style={{ padding: '4px 6px', borderRadius: '5px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '12px' }}>
                    {STAT_KEYS.map(k => (
                        <option key={k} value={k}>{STAT_LABELS[k]} {c.stats?.[k] ?? '—'} (⌊{c.stats?.[k] ?? 0}/2⌋ = +{Math.floor((c.stats?.[k] || 0) / 2)})</option>
                    ))}
                </select>
            ) : (
                <input type="number" value={flatMod} onChange={(e) => setFlatMod(e.target.value)} title="Manual modifier — e.g. a trained skill's talent bonus"
                    style={{ width: '60px', padding: '4px 6px', borderRadius: '5px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'center' }} />
            )}
            <input type="number" value={vsTarget} onChange={(e) => setVsTarget(e.target.value)} placeholder="vs (optional)" title="Opposing target number — leave blank to just show the total"
                style={{ width: '92px', padding: '4px 6px', borderRadius: '5px', border: '1px solid var(--border-medium)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'center' }} />
            <button onClick={roll} disabled={mode === 'stat' && !statKey}
                style={{ padding: '5px 12px', borderRadius: '5px', border: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                🎲 Roll
            </button>
            {lastResult && (
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                    {lastResult.d20} {lastResult.mod >= 0 ? '+' : ''}{lastResult.mod} = {lastResult.total}
                    {lastResult.target != null && (
                        <span style={{ marginLeft: '6px', color: lastResult.success ? '#4caf50' : '#f44336' }}>
                            vs {lastResult.target} → {lastResult.success ? 'Success' : 'Fail'}
                        </span>
                    )}
                </span>
            )}
            </div>
        </div>
    );
};

const CombatantRow = ({ c, isActive, onRoll, onHpChange, onRemove, onQuickRoll }) => {
    const [checkOpen, setCheckOpen] = useState(false);
    return (
    <div style={{
        display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 12px', borderRadius: '8px',
        background: isActive ? 'rgba(102,126,234,0.12)' : 'var(--input-bg)',
        border: isActive ? '2px solid #667eea' : '1px solid var(--border-medium)'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
                title={c.initiative != null ? `Rolled: 1d20 + ${c.spd} Speed` : `Sorted by raw Speed (${c.spd}) — click 🎲 to roll instead`}
                style={{
                    minWidth: '30px', textAlign: 'center', padding: '3px 6px', borderRadius: '6px',
                    background: c.initiative != null ? '#667eea' : 'var(--bg-section)',
                    border: c.initiative != null ? 'none' : '1px dashed var(--border-medium)',
                    color: c.initiative != null ? 'white' : 'var(--text-muted)', fontWeight: 'bold', fontSize: '13px'
                }}>
                {c.initiative ?? c.spd}
            </span>
            {c.avatar ? <img src={c.avatar} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} /> : null}
            <span style={{ fontWeight: 'bold', fontSize: '13px', flex: '1 1 auto' }}>
                {c.name}
                {c.level != null && <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}> · Lv {c.level}</span>}
            </span>
            <span style={{ padding: '2px 8px', borderRadius: '8px', background: `${KIND_COLORS[c.kind]}22`, color: KIND_COLORS[c.kind], fontSize: '10px', fontWeight: 'bold' }}>
                {KIND_LABELS[c.kind]}
            </span>
            {(c.types || []).map(t => (
                <span key={t} style={{ padding: '1px 6px', borderRadius: '8px', background: getTypeColor(t), color: getContrastTextColor(getTypeColor(t)), fontSize: '9px', fontWeight: 'bold' }}>{t}</span>
            ))}
            <button onClick={onRoll} title="Optional variant rule: roll 1d20 + Speed instead of sorting by raw Speed"
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--bg-section)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px' }}>🎲</button>
            <button onClick={() => setCheckOpen(v => !v)} title="Quick Check — a fast 1d20 + modifier roll for anything that isn't a full move (opposed checks, reactions, ad hoc rulings)"
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: checkOpen ? '#667eea' : 'var(--bg-section)', color: checkOpen ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🎯 Check</button>
            <HPStepper current={c.hp.current} max={c.hp.max} onChange={onHpChange} />
            <button onClick={onRemove} title="Remove" style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>
        {checkOpen && <QuickCheckPanel c={c} onRoll={onQuickRoll} />}
        {(c.stats || c.moves?.length > 0 || c.features?.length > 0) && (
            <details>
                <summary style={{ cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)' }}>▸ Details</summary>
                <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {c.stats && <div>{STAT_KEYS.map(k => `${STAT_LABELS[k]} ${c.stats[k]}`).join('  ·  ')}</div>}
                    {c.moves?.length > 0 && <div><strong>Moves:</strong> {c.moves.join(', ')}</div>}
                    {c.features?.length > 0 && <div><strong>Features:</strong> {c.features.join(', ')}</div>}
                </div>
            </details>
        )}
    </div>
    );
};

const InitiativeTracker = () => {
    const initial = useMemo(loadTracker, []);
    const [combatants, setCombatants] = useState(initial.combatants || []);
    const [round, setRound] = useState(initial.round || 1);
    const [currentTurn, setCurrentTurn] = useState(initial.currentTurn || 0);
    const [addPanel, setAddPanel] = useState('none'); // 'none' | 'npc' | 'player' | 'custom'
    const [recentRolls, setRecentRolls] = useState([]); // session-only quick-check feed, not persisted

    const { npcs, sendToDiscord } = useData();
    const { trainers } = useTrainerContext();
    const { GAME_DATA } = useGameData();
    const { showHelp } = useUI();
    const { showConfirm } = useModal();

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ combatants, round, currentTurn })); } catch {}
    }, [combatants, round, currentTurn]);

    // PTA3 default rule (PHB1 "Rules of Engagement"): turn order is raw Speed,
    // highest first — no roll required. "Roll For Initiative" (d20 + Speed) is
    // an explicitly optional variant rule, offered here per-combatant via 🎲.
    // Ties under the default rule are broken by an opposed Speed check — GMs
    // can roll just the tied combatants with 🎲 to break them.
    const sorted = useMemo(() => {
        return [...combatants].sort((a, b) => {
            const av = a.initiative ?? a.spd;
            const bv = b.initiative ?? b.spd;
            return bv - av;
        });
    }, [combatants]);

    const activeIndex = combatants.length > 0 ? Math.min(currentTurn, sorted.length - 1) : 0;

    const addCombatant = (c) => setCombatants(prev => [...prev, c]);

    const rollOne = (id) => {
        setCombatants(prev => prev.map(c => {
            if (c.id !== id) return c;
            const roll = 1 + Math.floor(Math.random() * 20);
            return { ...c, initiative: roll + c.spd };
        }));
    };

    const rollAll = () => {
        setCombatants(prev => prev.map(c => {
            if (c.initiative != null) return c;
            const roll = 1 + Math.floor(Math.random() * 20);
            return { ...c, initiative: roll + c.spd };
        }));
    };

    const clearRolls = () => setCombatants(prev => prev.map(c => ({ ...c, initiative: null })));

    // currentTurn is a raw index into the sorted turn order. Removing a combatant shrinks
    // and re-indexes that list, so without adjustment the same numeric index can silently
    // point at a different combatant after the removal (e.g. removing 2nd of 4 leaves index
    // 2 pointing at what was the 4th combatant instead of the 3rd).
    const removeCombatant = (id) => {
        const removedIndex = sorted.findIndex(c => c.id === id);
        setCombatants(prev => prev.filter(c => c.id !== id));
        if (removedIndex === -1) return;
        setCurrentTurn(prev => (removedIndex < prev ? Math.max(0, prev - 1) : prev));
    };

    const handleQuickRoll = (result) => {
        setRecentRolls(prev => [result, ...prev].slice(0, 8));
        if (sendToDiscord) sendToDiscord({ type: 'quick_check', ...result }, result.combatantName);
    };

    const nextTurn = () => {
        if (sorted.length === 0) return;
        const next = activeIndex + 1;
        if (next >= sorted.length) {
            setCurrentTurn(0);
            setRound(r => r + 1);
        } else {
            setCurrentTurn(next);
        }
    };

    const clearAll = () => {
        showConfirm({
            title: 'Clear Initiative Tracker?',
            message: 'This removes every combatant and resets the round counter.',
            danger: true,
            confirmLabel: 'Clear',
            onConfirm: () => { setCombatants([]); setRound(1); setCurrentTurn(0); }
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="section-card-purple">
                <h3 className="section-title-purple" aria-label="Initiative Tracker">
                    🎯 Initiative Tracker
                    <button
                        onClick={(e) => { e.stopPropagation(); showHelp('gm-initiative'); }}
                        style={HELP_BTN_STYLE}
                        aria-label="Help: Initiative Tracker"
                        title="About the initiative tracker"
                    >?</button>
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    Session scratchpad for turn order. Add combatants from your NPC Roster, player trainers, or a one-off custom entry. Turn order defaults to raw Speed, highest first (PTA3 default rule) — use 🎲 per combatant only if your table prefers the optional "Roll For Initiative" variant (1d20 + Speed). Need a roll that isn't a full move — an opposed check, a reaction, anything ad hoc — without leaving this screen? Use 🎯 Check on any row.
                </p>
                <p style={{ fontSize: '11px', color: '#ff9800', background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '6px', padding: '8px 12px', marginBottom: '14px' }}>
                    ⚠️ Combatants here are snapshots, not live links — damage and HP changes in this tracker do <strong>not</strong> sync back to your saved Trainers, Pokémon, or NPC Roster.
                </p>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <button onClick={() => setAddPanel(p => p === 'npc' ? 'none' : 'npc')}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: addPanel === 'npc' ? '#667eea' : 'var(--input-bg)', color: addPanel === 'npc' ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        ＋ From NPC Roster
                    </button>
                    <button onClick={() => setAddPanel(p => p === 'player' ? 'none' : 'player')}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: addPanel === 'player' ? '#667eea' : 'var(--input-bg)', color: addPanel === 'player' ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        ＋ From Players
                    </button>
                    <button onClick={() => setAddPanel(p => p === 'custom' ? 'none' : 'custom')}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: addPanel === 'custom' ? '#667eea' : 'var(--input-bg)', color: addPanel === 'custom' ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        ＋ Custom
                    </button>
                </div>

                {addPanel === 'npc' && <div style={{ marginBottom: '14px' }}><AddFromNpcRoster npcs={npcs} onAdd={addCombatant} GAME_DATA={GAME_DATA} combatants={combatants} /></div>}
                {addPanel === 'player' && <div style={{ marginBottom: '14px' }}><AddFromPlayers trainers={trainers} onAdd={addCombatant} combatants={combatants} /></div>}
                {addPanel === 'custom' && <div style={{ marginBottom: '14px' }}><AddCustom onAdd={addCombatant} /></div>}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px', padding: '10px 14px', borderRadius: '8px', background: 'var(--input-bg)' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Round {round}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={rollAll} disabled={combatants.length === 0} title='Optional variant rule: roll 1d20 + Speed for everyone still sorted by raw Speed'
                            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--bg-section)', color: 'var(--text-primary)', cursor: combatants.length === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: combatants.length === 0 ? 0.5 : 1 }}>
                            🎲 Roll All
                        </button>
                        <button onClick={clearRolls} disabled={combatants.length === 0} title="Revert to the default rule: sort by raw Speed only"
                            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--bg-section)', color: 'var(--text-primary)', cursor: combatants.length === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: combatants.length === 0 ? 0.5 : 1 }}>
                            Clear Rolls
                        </button>
                        <button onClick={nextTurn} disabled={combatants.length === 0}
                            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', cursor: combatants.length === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: combatants.length === 0 ? 0.5 : 1 }}>
                            ⏭ Next Turn
                        </button>
                        <button onClick={clearAll} disabled={combatants.length === 0}
                            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-medium)', background: 'var(--bg-section)', color: '#f44336', cursor: combatants.length === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: combatants.length === 0 ? 0.5 : 1 }}>
                            Clear All
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {sorted.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', background: 'var(--input-bg)', borderRadius: '8px' }}>
                            No combatants yet — add some above.
                        </div>
                    )}
                    {sorted.map((c, idx) => (
                        <CombatantRow
                            key={c.id}
                            c={c}
                            isActive={idx === activeIndex}
                            onRoll={() => rollOne(c.id)}
                            onHpChange={(val) => setCombatants(prev => prev.map(x => x.id === c.id ? { ...x, hp: { ...x.hp, current: val } } : x))}
                            onRemove={() => removeCombatant(c.id)}
                            onQuickRoll={handleQuickRoll}
                        />
                    ))}
                </div>

                {recentRolls.length > 0 && (
                    <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px' }}>Recent Quick Rolls</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {recentRolls.map((r, i) => (
                                <div key={i} style={{ fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold' }}>{r.combatantName}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                                    <span>{r.d20} {r.mod >= 0 ? '+' : ''}{r.mod} = <strong>{r.total}</strong></span>
                                    {r.target != null && (
                                        <span style={{ color: r.success ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
                                            vs {r.target} → {r.success ? 'Success' : 'Fail'}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InitiativeTracker;
