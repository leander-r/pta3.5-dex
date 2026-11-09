import React, { useState } from 'react';
import { applySpeedCombatStage, getStageDiceDelta } from '../../utils/dataUtils.js';
import { HELP_BTN_STYLE } from '../common/helpBtnStyle.js';

const STATS = [
    { key: 'atk',  label: 'ATK',  color: '#f44336', mode: 'dice', desc: 'Attack — each stage adds/removes 1 damage die on your Physical moves.' },
    { key: 'def',  label: 'DEF',  color: '#2196f3', mode: 'dice', desc: 'Defense — each stage adds/removes 1 damage die on Physical moves used against you.' },
    { key: 'satk', label: 'SATK', color: '#9c27b0', mode: 'dice', desc: 'Special Attack — each stage adds/removes 1 damage die on your Special moves.' },
    { key: 'sdef', label: 'SDEF', color: '#ff9800', mode: 'dice', desc: 'Special Defense — each stage adds/removes 1 damage die on Special moves used against you.' },
    { key: 'spd',  label: 'SPD',  color: '#00bcd4', mode: 'stat', desc: 'Speed — the only stat whose combat stages still modify the stat directly. Determines turn order and how hard Effect moves are to land.' },
    { key: 'acc',  label: 'ACC',  color: '#4caf50', mode: 'flat', desc: 'Accuracy — no base stat. Each stage directly adds ±1 to your attack rolls (1d20). Shown as a flat modifier.' },
    { key: 'eva',  label: 'EVA',  color: '#607d8b', mode: 'flat', desc: 'Evasion — no base stat. Each stage directly subtracts ±1 from opponent attack rolls against you. Shown as a flat modifier.' },
];

const CombatStagesPanel = ({ selectedPokemon, combatStages, getStatsWithMega, updateCombatStage, resetCombatStages, onHelp }) => {
    const [show, setShow] = useState(false);

    if (!selectedPokemon) return null;

    const actualStats = getStatsWithMega(selectedPokemon);

    return (
        <div style={{ marginBottom: '12px' }}>
            <div
                role="button"
                tabIndex={0}
                aria-expanded={show}
                aria-label={`${show ? 'Hide' : 'Show'} combat stages`}
                onClick={() => setShow(v => !v)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShow(v => !v)}
                className="combat-stages-header"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', marginBottom: show ? '8px' : 0 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                        style={{ fontSize: '12px', fontWeight: 'bold' }}
                        title="Combat Stages track buffs and debuffs. ATK/DEF/SATK/SDEF stages add or remove damage dice (not the stat); Speed stages still add/subtract 5 from the stat directly. Same-sign stages don't stack, opposite signs cancel 1-for-1."
                    >
                        Combat Stages
                    </span>
                    {onHelp && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onHelp(); }}
                            style={HELP_BTN_STYLE}
                            aria-label="Help: Combat Stages"
                            title="About combat stages"
                        >?</button>
                    )}
                    <span className="text-muted" style={{ fontSize: '12px', marginLeft: '2px' }}>Buffs & debuffs from moves</span>
                </div>
                <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    style={{ color: 'var(--text-secondary)', transition: 'transform 0.2s ease', transform: show ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
                    aria-hidden="true"
                >
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </div>
            {show && (
                <div className="combat-stages-content" style={{ padding: '10px', borderRadius: '6px' }}>
                    <div className="text-muted" style={{ fontSize: '12px', marginBottom: '8px', textAlign: 'center' }}>
                        ATK/DEF/SATK/SDEF: ±1 stage = ±1 damage die | SPD: ±1 stage = ±5 to stat | Same sign doesn't stack, opposite signs cancel
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {STATS.map(stat => {
                            const baseStat = actualStats[stat.key] || 0;
                            const stages = combatStages[stat.key] || 0;
                            const diceDelta = stat.mode === 'dice' ? getStageDiceDelta(stages) : 0;
                            const modifiedStat = stat.mode === 'stat' ? applySpeedCombatStage(baseStat, stages) : null;
                            return (
                                <div key={stat.key} className="combat-stat-box" style={{ textAlign: 'center', padding: '6px', borderRadius: '4px' }} title={stat.desc}>
                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: stat.color }}>{stat.label}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {stat.mode === 'flat' &&
                                            <span title="Flat roll modifier — no base stat">mod: <strong style={{ color: stages !== 0 ? (stages > 0 ? '#4caf50' : '#f44336') : 'var(--text-primary)' }}>{(stages >= 0 ? '+' : '') + stages}</strong></span>
                                        }
                                        {stat.mode === 'dice' &&
                                            <span title="Damage dice added/removed — base stat is unaffected">dice: <strong style={{ color: diceDelta !== 0 ? (diceDelta > 0 ? '#4caf50' : '#f44336') : 'var(--text-primary)' }}>{(diceDelta >= 0 ? '+' : '') + diceDelta}</strong></span>
                                        }
                                        {stat.mode === 'stat' &&
                                            <>{baseStat} → <strong style={{ color: stages !== 0 ? (stages > 0 ? '#4caf50' : '#f44336') : 'var(--text-primary)' }}>{modifiedStat}</strong></>
                                        }
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
                                        <button
                                            onClick={() => updateCombatStage(stat.key, -1)}
                                            className="combat-stage-btn"
                                            style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', background: '#ffcdd2', cursor: 'pointer', fontSize: '14px' }}
                                            aria-label={`Decrease ${stat.label}`}
                                        >−</button>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: stages > 0 ? '#4caf50' : stages < 0 ? '#f44336' : '#999', minWidth: '20px' }}>
                                            {stages > 0 ? '+' : ''}{stages}
                                        </span>
                                        <button
                                            onClick={() => updateCombatStage(stat.key, 1)}
                                            className="combat-stage-btn"
                                            style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', background: '#c8e6c9', cursor: 'pointer', fontSize: '14px' }}
                                            aria-label={`Increase ${stat.label}`}
                                        >+</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <button
                        onClick={resetCombatStages}
                        style={{ marginTop: '8px', width: '100%', padding: '6px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                    >
                        Reset All Stages
                    </button>
                </div>
            )}
        </div>
    );
};

export default CombatStagesPanel;
