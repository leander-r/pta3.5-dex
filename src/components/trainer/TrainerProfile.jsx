// ============================================================
// Trainer Profile Component
// ============================================================

import React from 'react';
import { useTrainerContext, useModal, useUI } from '../../contexts/index.js';
import { CREATION_STAT_POINTS, HONOR_THRESHOLDS, MAX_TRAINER_LEVEL, HP_MILESTONE_LEVELS } from '../../data/constants.js';
import { HELP_BTN_STYLE } from '../common/helpBtnStyle.js';

/**
 * TrainerProfile - Trainer profile management
 * Uses TrainerContext for state management
 */
const TrainerProfile = () => {
    const {
        trainer,
        setTrainer,
        levelUpTrainer,
        levelDownTrainer,
        respecTrainer,
        calculateMaxHP,
        awardHonors
    } = useTrainerContext();
    const { showConfirm } = useModal();
    const { showHelp } = useUI();

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 150;
                    let width = img.width, height = img.height;
                    if (width > height) {
                        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                    } else {
                        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    setTrainer(prev => ({ ...prev, avatar: canvas.toDataURL('image/jpeg', 0.8) }));
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddBadge = () => {
        showConfirm({
            title: 'Add Badge',
            message: 'Enter badge name:',
            confirmLabel: 'Add',
            inputConfig: { placeholder: 'Badge name...', defaultValue: '' },
            onConfirm: (name) => {
                if (name?.trim()) {
                    setTrainer(prev => ({
                        ...prev,
                        badges: [...(prev.badges || []), {
                            name: name.trim(),
                            id: Date.now(),
                            earnedAt: new Date().toISOString()
                        }]
                    }));
                }
            }
        });
    };

    const handleRemoveBadge = (badgeId, badgeName, index) => {
        showConfirm({
            title: 'Remove Badge',
            message: `Remove "${badgeName}" badge?`,
            danger: true,
            onConfirm: () => {
                setTrainer(prev => ({
                    ...prev,
                    badges: (prev.badges || []).filter((b, i) => {
                        if (typeof b === 'string') return i !== index;
                        return b.id !== badgeId;
                    })
                }));
            }
        });
    };

    const isLevel0 = trainer.level === 0;
    const creationPointsRemaining = trainer.statPoints || 0;
    const hasClass = (trainer.classes || []).length > 0;
    const atMaxLevel = trainer.level >= MAX_TRAINER_LEVEL;
    const nextLevel = trainer.level + 1;
    const honorsForNext = HONOR_THRESHOLDS[nextLevel];
    const currentHonors = trainer.honors || 0;
    const honorsNeeded = !atMaxLevel && honorsForNext !== undefined
        ? Math.max(0, honorsForNext - currentHonors)
        : 0;
    const honorsMet = atMaxLevel || honorsForNext === undefined || currentHonors >= honorsForNext;
    const milestonesReached = HP_MILESTONE_LEVELS.filter(l => l <= trainer.level).length;
    const hpRollsPending = milestonesReached - (trainer.hpRolls || []).length;
    const statPointsPending = trainer.levelStatPoints || 0;
    // Note: unspent Creation points don't block Level 1 — the point-buy cost table's jumps
    // mean some legitimate stat spreads can never land on exactly 0 remaining (PHB1 caps the
    // budget at 30, it doesn't require spending every last point).
    const canLevelUp = isLevel0
        ? hasClass
        : honorsMet && hpRollsPending === 0 && statPointsPending === 0;
    const levelUpTitle = isLevel0
        ? (!canLevelUp ? 'Pick your first Trainer Class first' : 'Become Level 1')
        : atMaxLevel
            ? 'Maximum level reached'
            : hpRollsPending > 0
                ? `Roll your HP bonus first! (${hpRollsPending} pending — use 🎲 Roll HP Bonus in Stats)`
                : statPointsPending > 0
                    ? `Spend your ${statPointsPending} stat point${statPointsPending !== 1 ? 's' : ''} first! (use ⬆ in the Stats section)`
                    : !honorsMet
                        ? `Need ${honorsNeeded} more honor${honorsNeeded !== 1 ? 's' : ''} to reach Level ${nextLevel} (requires ${honorsForNext})`
                        : `Level up to ${nextLevel}`;
    const badges = trainer.badges || [];

    return (
        <div className="section-card-purple">

            {/* Header: avatar + name */}
            <h3 className="section-title-purple" aria-label="Trainer Profile">
                <div
                    style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
                    onClick={() => document.getElementById('trainerAvatarInput').click()}
                    title="Click to change avatar"
                >
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: trainer.avatar ? 'transparent' : 'linear-gradient(135deg, #667eea, #764ba2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        border: '2px solid rgba(102,126,234,0.35)'
                    }}>
                        {trainer.avatar
                            ? <img src={trainer.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: '20px' }}>👤</span>
                        }
                    </div>
                    <span style={{
                        position: 'absolute', bottom: '0px', right: '-2px',
                        fontSize: '10px', lineHeight: 1
                    }}>📷</span>
                    <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="trainerAvatarInput"
                        onChange={handleAvatarChange}
                    />
                </div>
                <input
                    type="text"
                    value={trainer.name}
                    onChange={(e) => setTrainer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Trainer Name..."
                    style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '2px solid rgba(102,126,234,0.35)',
                        outline: 'none',
                        fontSize: '16px',
                        fontWeight: '800',
                        color: 'var(--color-purple)',
                        padding: '2px 0',
                        fontFamily: 'inherit'
                    }}
                />
            </h3>

            {/* Gender + Age */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {[['male', '♂', '#1976d2'], ['female', '♀', '#c2185b']].map(([val, sym, col]) => (
                        <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontSize: '15px', color: col }}>
                            <input
                                type="radio"
                                name="trainerGender"
                                checked={trainer.gender === val}
                                onChange={() => setTrainer(prev => ({ ...prev, gender: val }))}
                                style={{ accentColor: col }}
                            />
                            {sym}
                        </label>
                    ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>Age</span>
                    <input
                        type="number"
                        value={trainer.age || ''}
                        onChange={(e) => setTrainer(prev => ({ ...prev, age: e.target.value }))}
                        placeholder="—"
                        min="1"
                        max="999"
                        style={{
                            width: '46px',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            textAlign: 'center',
                            border: '1px solid var(--border-medium, #ddd)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            outline: 'none'
                        }}
                    />
                </div>
            </div>

            {/* Class pills */}
            {(trainer.classes || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
                    {(trainer.classes || []).map((cls, i) => (
                        <span key={i} style={{
                            padding: '2px 8px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                            color: 'white'
                        }}>
                            {cls}
                        </span>
                    ))}
                </div>
            )}

            {/* Character Creation checklist (merged) — shown only at level 0 */}
            {isLevel0 && (
                <div style={{
                    padding: '10px 12px',
                    background: 'var(--warning-bg, #fff3e0)',
                    borderRadius: '8px',
                    border: '1px solid var(--warning-border, #ffcc80)',
                    fontSize: '12px',
                    marginBottom: '12px'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px', color: 'var(--warning-text, #e65100)' }}>
                        Character Creation — allocate stats, pick a class, then level up!
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: creationPointsRemaining === 0 ? '#2e7d32' : 'var(--text-muted)' }}>
                        <span>{creationPointsRemaining === 0 ? '✓' : 'ℹ'}</span>
                        <span>
                            Creation points spent: {CREATION_STAT_POINTS - creationPointsRemaining}/{CREATION_STAT_POINTS}
                            {creationPointsRemaining > 0 && ' (optional — unspent points are lost on level up)'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: hasClass ? '#2e7d32' : '#c62828' }}>
                        <span>{hasClass ? '✓' : '○'}</span>
                        <span>Pick your first class</span>
                    </div>
                </div>
            )}

            {/* Level Controls */}
            <div className="level-controls">
                <button
                    className="level-btn"
                    onClick={levelDownTrainer}
                    disabled={trainer.level <= 1}
                    aria-label="Decrease level"
                >−</button>
                <div className="level-display">
                    <div className="level-label">LEVEL</div>
                    <div className="level-value">{trainer.level}</div>
                </div>
                <button
                    className="level-btn"
                    onClick={levelUpTrainer}
                    disabled={!canLevelUp}
                    title={levelUpTitle}
                    aria-label="Increase level"
                >+</button>
            </div>
            {/* Honors progress toward next level */}
            {!isLevel0 && !atMaxLevel && (
                <div style={{ marginTop: '6px', fontSize: '11px', textAlign: 'center', color: honorsMet ? '#4caf50' : 'var(--text-muted)' }}>
                    {honorsMet
                        ? `✓ Ready to level up! (${currentHonors}/${honorsForNext} honors)`
                        : `${currentHonors}/${honorsForNext} honors for Lv ${nextLevel} — need ${honorsNeeded} more`
                    }
                </div>
            )}
            {atMaxLevel && (
                <div style={{ marginTop: '6px', fontSize: '11px', textAlign: 'center', color: '#9c27b0', fontWeight: '600' }}>
                    ★ Maximum level reached (15)
                </div>
            )}

            {/* Quick Stats — 3 boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '14px' }}>
                <div
                    style={{ textAlign: 'center', padding: '10px 6px', background: 'linear-gradient(180deg, #e5393525 0%, transparent 70%)', borderRadius: '8px', border: '1px solid #e5393955', borderTop: '3px solid #e53935' }}
                    title="Max HP: 20 base + 1d4 rolled at levels 3, 7, and 11"
                >
                    <div style={{ fontSize: '12px', color: '#e53935', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Max HP</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#e53935', lineHeight: 1.2 }}>{calculateMaxHP()}</div>
                </div>
                <div
                    style={{ textAlign: 'center', padding: '10px 6px', background: 'linear-gradient(180deg, #f5a62325 0%, transparent 70%)', borderRadius: '8px', border: '1px solid #f5a62355', borderTop: '3px solid #f5a623' }}
                    title="Honors represent your reputation. Earn them from Gym Badges, Contest Ribbons, and story milestones — they determine when you can level up. Separate from badge count."
                >
                    <div style={{ fontSize: '12px', color: '#e8941c', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        🎖 Honors
                        <button
                            onClick={(e) => { e.stopPropagation(); showHelp('honors'); }}
                            style={{ ...HELP_BTN_STYLE, padding: '0 3px', height: '14px', width: '14px', fontSize: '9px', lineHeight: '14px', minWidth: 0 }}
                            aria-label="Help: Honors & Leveling"
                            title="About Honors and leveling"
                        >?</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
                        <button
                            onClick={() => setTrainer(prev => ({ ...prev, honors: Math.max(0, (prev.honors || 0) - 1) }))}
                            disabled={!trainer.honors}
                            aria-label="Remove honor"
                            style={{ width: '22px', height: '22px', border: '1.5px solid #f5a62399', borderRadius: '4px', background: trainer.honors ? '#f5a62322' : 'transparent', color: trainer.honors ? '#f5a623' : 'var(--text-muted)', cursor: trainer.honors ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                        >−</button>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f5a623', lineHeight: 1, minWidth: '24px' }}>{trainer.honors || 0}</div>
                        <button
                            onClick={() => awardHonors(1)}
                            aria-label="Add honor"
                            style={{ width: '22px', height: '22px', border: '1.5px solid #f5a62399', borderRadius: '4px', background: '#f5a62322', color: '#f5a623', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
                        >+</button>
                    </div>
                </div>
                <div
                    style={{ textAlign: 'center', padding: '10px 6px', background: 'linear-gradient(180deg, #667eea25 0%, transparent 70%)', borderRadius: '8px', border: '1px solid #667eea55', borderTop: '3px solid #667eea', cursor: 'pointer' }}
                    title="Gym Badges earned (cosmetic tracking). Each badge typically earns 1 Honor — award Honors separately. Click to jump to badge list."
                    onClick={() => document.getElementById('trainer-badges-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                >
                    <div style={{ fontSize: '12px', color: '#667eea', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏅 Badges</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#667eea', lineHeight: 1.2 }}>{badges.length}</div>
                </div>
            </div>

            {/* Money */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: 'linear-gradient(135deg, #ffd700, #ffb300)',
                borderRadius: '8px',
                marginTop: '12px'
            }}>
                <span style={{ fontWeight: 'bold', color: '#5d4e00', fontSize: '14px' }}>💰</span>
                <span style={{ fontWeight: 'bold', color: '#5d4e00', fontSize: '16px' }}>₽</span>
                <input
                    type="number"
                    min="0"
                    value={trainer.money || 0}
                    onChange={(e) => setTrainer(prev => ({ ...prev, money: Math.max(0, parseInt(e.target.value) || 0) }))}
                    style={{
                        flex: 1,
                        padding: '3px 6px',
                        border: '2px solid #c9a800',
                        borderRadius: '5px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        textAlign: 'right',
                        background: 'rgba(255,255,255,0.88)',
                        minWidth: 0
                    }}
                />
            </div>
            {/* Respec — de-emphasised, separated from money */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                    onClick={respecTrainer}
                    className="trainer-respec-btn"
                    title="Reset trainer to Level 0 for character recreation (keeps Pokémon)"
                >
                    🔄 Respec
                </button>
            </div>

            {/* Badges */}
            <div id="trainer-badges-section" style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-purple, #667eea)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🏅 Badges ({badges.length})
                    </span>
                    <button
                        onClick={handleAddBadge}
                        style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: 'linear-gradient(135deg, var(--poke-orange, #f5a623), var(--poke-orange-dark, #e8941c))',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        + Add
                    </button>
                </div>

                {badges.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {badges.map((badge, index) => {
                            const badgeName = typeof badge === 'string' ? badge : badge.name;
                            const badgeId = typeof badge === 'string' ? index : badge.id;
                            return (
                                <div
                                    key={badgeId}
                                    className="trainer-badge-chip"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                                    }}
                                >
                                    <span>🏅</span>
                                    <span>{badgeName}</span>
                                    <button
                                        onClick={() => handleRemoveBadge(badgeId, badgeName, index)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: '11px', color: '#8d6e00', opacity: 0.7 }}
                                        title="Remove badge"
                                    >✕</button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: '8px',
                        color: 'var(--text-muted, #999)',
                        fontSize: '12px',
                        fontStyle: 'italic',
                        background: 'var(--bg-light, #f5f5f5)',
                        borderRadius: '6px'
                    }}>
                        No badges earned yet
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrainerProfile;
