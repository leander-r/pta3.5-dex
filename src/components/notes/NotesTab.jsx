// ============================================================
// Notes Tab Component
// ============================================================
// Campaign notes, session notes, and quest log

import React, { useState, useCallback, useRef } from 'react';
import { useTrainerContext, useModal, useUI } from '../../contexts/index.js';
import { HELP_BTN_STYLE } from '../common/helpBtnStyle.js';

const QUEST_STATUSES = [
    { key: 'active',     label: 'Active',     color: '#4caf50' },
    { key: 'completed',  label: 'Completed',  color: '#667eea' },
    { key: 'abandoned',  label: 'Abandoned',  color: '#9e9e9e' },
];

/**
 * NotesTab - Campaign notes, session notes, and quest log
 * Uses TrainerContext for trainer state
 */
const NotesTab = () => {
    const { trainer, setTrainer } = useTrainerContext();
    const { showConfirm } = useModal();
    const { showHelp } = useUI();
    const [noteTab, setNoteTab] = useState('campaign');
    const [isFocused, setIsFocused] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const saveTimerRef = useRef(null);

    // Quest log state
    const [newQuestTitle, setNewQuestTitle] = useState('');
    const [expandedQuestId, setExpandedQuestId] = useState(() => {
        try { return JSON.parse(localStorage.getItem('pta35-expanded-quest-id')); } catch { return null; }
    });

    const handleExpandQuest = (id) => {
        const next = expandedQuestId === id ? null : id;
        setExpandedQuestId(next);
        try { localStorage.setItem('pta35-expanded-quest-id', JSON.stringify(next)); } catch { /* quota */ }
    };
    const quests = trainer.quests || [];

    // ── Notes handlers ────────────────────────────────────────
    const markSaved = useCallback(() => {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setLastSaved(new Date()), 600);
    }, []);

    const handleCampaignChange = (e) => {
        setTrainer(prev => ({ ...prev, notes: e.target.value }));
        markSaved();
    };

    const handleSessionChange = (e) => {
        setTrainer(prev => ({ ...prev, sessionNotes: e.target.value }));
        markSaved();
    };

    const handleClearSession = () => {
        showConfirm({
            title: 'Clear Session Notes?',
            message: 'This will erase all current session notes. Campaign notes are unaffected.',
            confirmLabel: 'Clear',
            danger: true,
            onConfirm: () => setTrainer(prev => ({ ...prev, sessionNotes: '' }))
        });
    };

    // ── Quest handlers ────────────────────────────────────────
    const handleAddQuest = () => {
        const title = newQuestTitle.trim();
        if (!title) return;
        const quest = { id: Date.now(), title, status: 'active', notes: '' };
        setTrainer(prev => ({ ...prev, quests: [...(prev.quests || []), quest] }));
        setNewQuestTitle('');
    };

    const handleQuestStatus = (id, status) => {
        setTrainer(prev => ({
            ...prev,
            quests: (prev.quests || []).map(q => q.id === id ? { ...q, status } : q)
        }));
    };

    const handleQuestNotes = (id, notes) => {
        setTrainer(prev => ({
            ...prev,
            quests: (prev.quests || []).map(q => q.id === id ? { ...q, notes } : q)
        }));
    };

    const handleDeleteQuest = (id) => {
        showConfirm({
            title: 'Delete Quest?',
            message: 'Remove this quest from the log?',
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: () => setTrainer(prev => ({
                ...prev,
                quests: (prev.quests || []).filter(q => q.id !== id)
            }))
        });
    };

    // ── Computed ──────────────────────────────────────────────
    const isCampaign = noteTab === 'campaign';
    const isSession = noteTab === 'session';
    const isQuests = noteTab === 'quests';
    const activeText = isCampaign ? (trainer.notes || '') : (trainer.sessionNotes || '');
    const wordCount = activeText.trim().split(/\s+/).filter(Boolean).length;
    const activeCount = quests.filter(q => q.status === 'active').length;

    return (
        <div>
            <h2 className="section-title">
                Notes
                <button
                    onClick={() => showHelp('notes')}
                    style={{ ...HELP_BTN_STYLE, marginLeft: '8px' }}
                    aria-label="Help: Campaign Notes"
                    title="About campaign notes"
                >?</button>
            </h2>
            <p className="section-description">
                Track your adventure — quests, NPCs, story events, and session highlights.
            </p>

            {/* Tab switcher */}
            <div className="tabs" style={{ marginBottom: '15px' }}>
                <button className={`tab ${isCampaign ? 'active' : ''}`} onClick={() => setNoteTab('campaign')}>
                    📖 Campaign
                </button>
                <button className={`tab ${isSession ? 'active' : ''}`} onClick={() => setNoteTab('session')}>
                    🗒️ Session
                </button>
                <button className={`tab ${isQuests ? 'active' : ''}`} onClick={() => setNoteTab('quests')}>
                    📋 Quests{activeCount > 0 && ` (${activeCount})`}
                </button>
            </div>

            {/* ── Notes tabs ─────────────────────────────────── */}
            {(isCampaign || isSession) && (
                <div className="section-card-purple" style={{
                    transition: 'box-shadow 0.2s ease',
                    boxShadow: isFocused ? '0 0 0 3px rgba(102, 126, 234, 0.2)' : 'none'
                }}>
                    <h3
                        className="section-title-purple"
                        style={{ marginBottom: '12px' }}
                        aria-label={isCampaign ? `${trainer.name || 'Trainer'}'s Campaign Notes` : 'Session Notes'}
                    >
                        <span>{isCampaign ? '📝' : '🗒️'}</span>
                        {isCampaign ? `${trainer.name || 'Trainer'}'s Campaign Notes` : 'Session Notes'}
                        {isSession && (
                            <button
                                onClick={handleClearSession}
                                style={{
                                    marginLeft: 'auto', padding: '4px 10px',
                                    background: '#f44336', color: 'white',
                                    border: 'none', borderRadius: '4px',
                                    cursor: 'pointer', fontSize: '11px', fontWeight: 'bold'
                                }}
                                title="Clear session notes (campaign notes unaffected)"
                            >
                                Clear
                            </button>
                        )}
                    </h3>

                    {isSession && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', marginTop: '-4px' }}>
                            Quick notes for this session. Clear between sessions without touching campaign notes.
                        </p>
                    )}

                    <textarea
                        key={noteTab}
                        value={activeText}
                        onChange={isCampaign ? handleCampaignChange : handleSessionChange}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        aria-label={isCampaign ? 'Campaign notes' : 'Session notes'}
                        placeholder={isCampaign
                            ? `Write your campaign notes, quest logs, NPC info, or anything else here...

Examples:
• Current quest objectives
• Important NPCs and their locations
• Storyline events and plot points
• Battle strategies and team compositions`
                            : `Quick notes for this session...

Examples:
• What happened today
• Items found or rewards
• New leads or rumors
• Reminders for next session`}
                        style={{
                            width: '100%', minHeight: '500px', padding: '16px',
                            fontSize: '14px', lineHeight: '1.7',
                            border: `2px solid ${isFocused ? 'var(--poke-orange, #667eea)' : 'var(--border-light, #e8e3f3)'}`,
                            borderRadius: '10px', resize: 'vertical', fontFamily: 'inherit',
                            background: isFocused ? 'var(--input-bg, #fff)' : 'var(--hover-bg, #fafafa)',
                            color: 'var(--text-primary, #333)',
                            transition: 'border-color 0.2s ease, background-color 0.2s ease', outline: 'none'
                        }}
                    />

                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginTop: '12px', padding: '8px 4px', fontSize: '12px',
                        color: 'var(--text-muted, #666)', borderTop: '1px solid var(--border-light, #e8e3f3)'
                    }}>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <span><strong>{activeText.length}</strong> characters</span>
                            <span><strong>{wordCount}</strong> words</span>
                        </div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: lastSaved ? '#4caf50' : 'var(--text-muted)' }}>
                            <span style={{ width: '6px', height: '6px', background: lastSaved ? '#4caf50' : 'var(--border-medium)', borderRadius: '50%', display: 'inline-block' }}></span>
                            {lastSaved
                                ? `Saved at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : 'Changes auto-save'}
                        </span>
                    </div>
                </div>
            )}

            {/* ── Quest Log tab ───────────────────────────────── */}
            {isQuests && (
                <div className="section-card-purple">
                    <h3 className="section-title-purple" style={{ marginBottom: '14px' }}>
                        <span>📋</span> Quest Log
                        <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                            {activeCount} active · {quests.filter(q => q.status === 'completed').length} done
                        </span>
                    </h3>

                    {/* Add quest */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <input
                            type="text"
                            value={newQuestTitle}
                            onChange={(e) => setNewQuestTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddQuest()}
                            placeholder="Quest title..."
                            aria-label="New quest title"
                            style={{
                                flex: 1, padding: '8px 12px', borderRadius: '6px',
                                border: '1px solid var(--border-medium)',
                                background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '13px'
                            }}
                        />
                        <button
                            onClick={handleAddQuest}
                            disabled={!newQuestTitle.trim()}
                            style={{
                                padding: '8px 14px', background: newQuestTitle.trim() ? '#667eea' : '#ccc',
                                color: 'white', border: 'none', borderRadius: '6px',
                                cursor: newQuestTitle.trim() ? 'pointer' : 'not-allowed',
                                fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap'
                            }}
                        >
                            + Add Quest
                        </button>
                    </div>

                    {/* Quest list grouped by status */}
                    {quests.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            No quests yet. Add your first quest above.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {QUEST_STATUSES.map(({ key, label, color }) => {
                                const group = quests.filter(q => q.status === key);
                                if (!group.length) return null;
                                return (
                                    <div key={key}>
                                        <div style={{ fontSize: '11px', fontWeight: 'bold', color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                            {label} ({group.length})
                                        </div>
                                        {group.map(quest => (
                                            <div key={quest.id} style={{
                                                marginBottom: '6px', borderRadius: '8px',
                                                border: `1px solid var(--border-medium)`,
                                                borderLeft: `4px solid ${color}`,
                                                background: 'var(--input-bg)',
                                                overflow: 'hidden'
                                            }}>
                                                {/* Quest header row */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-expanded={expandedQuestId === quest.id}
                                                        aria-label={`${quest.title} — click to ${expandedQuestId === quest.id ? 'collapse' : 'expand'} notes`}
                                                        style={{ flex: 1, fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', textDecoration: key === 'abandoned' ? 'line-through' : 'none', color: key === 'abandoned' ? 'var(--text-muted)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                        onClick={() => handleExpandQuest(quest.id)}
                                                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleExpandQuest(quest.id)}
                                                    >
                                                        <svg
                                                            width="11" height="11" viewBox="0 0 24 24" fill="none"
                                                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                                                            style={{ flexShrink: 0, transition: 'transform 0.15s ease', transform: expandedQuestId === quest.id ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--text-muted)' }}
                                                            aria-hidden="true"
                                                        >
                                                            <polyline points="9 18 15 12 9 6"/>
                                                        </svg>
                                                        {quest.title}
                                                        {quest.notes && <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '2px' }}>📝</span>}
                                                    </div>
                                                    {/* Status cycle */}
                                                    <select
                                                        value={quest.status}
                                                        onChange={(e) => handleQuestStatus(quest.id, e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        aria-label={`Status for quest: ${quest.title}`}
                                                        style={{
                                                            padding: '3px 6px', borderRadius: '4px',
                                                            border: `1px solid ${color}`, background: color,
                                                            color: 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
                                                        }}
                                                    >
                                                        {QUEST_STATUSES.map(s => (
                                                            <option key={s.key} value={s.key}>{s.label}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => handleDeleteQuest(quest.id)}
                                                        style={{ padding: '3px 7px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                                        title="Delete quest"
                                                        aria-label={`Delete quest: ${quest.title}`}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>

                                                {/* Expandable notes */}
                                                {expandedQuestId === quest.id && (
                                                    <div style={{ padding: '0 12px 10px' }}>
                                                        <textarea
                                                            value={quest.notes || ''}
                                                            onChange={(e) => handleQuestNotes(quest.id, e.target.value)}
                                                            aria-label={`Notes for quest: ${quest.title}`}
                                                            placeholder="Quest notes, clues, progress..."
                                                            rows={3}
                                                            style={{
                                                                width: '100%', padding: '8px', borderRadius: '6px',
                                                                border: '1px solid var(--border-medium)',
                                                                background: 'var(--hover-bg)', color: 'var(--text-primary)',
                                                                fontSize: '12px', lineHeight: '1.5', resize: 'vertical', fontFamily: 'inherit'
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotesTab;
