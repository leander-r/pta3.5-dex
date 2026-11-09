// ============================================================
// Save / Load Modal
// ============================================================
// FF-style named save slot system: 3 slots + auto-backup display.
// Slots persist to localStorage key 'pta-save-slots'.

import React, { useState, useEffect } from 'react';
import useModalKeyboard from '../../hooks/useModalKeyboard.js';
import { useModal, useUI } from '../../contexts/index.js';
import { useData } from '../../contexts/DataContext.jsx';

// ── Helpers ──────────────────────────────────────────────────

const formatDate = (isoStr) => {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        return (
            d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
            ' · ' +
            d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        );
    } catch {
        return '';
    }
};

const CLOSE_BTN_STYLE = {
    background: 'rgba(255,255,255,0.2)',
    border: '2px solid rgba(255,255,255,0.3)',
    fontSize: '18px',
    cursor: 'pointer',
    color: 'white',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    fontWeight: 'bold',
    flexShrink: 0
};

const BTN_BASE = {
    padding: '7px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity 0.15s'
};

// ── Slot Card ─────────────────────────────────────────────────

const SlotCard = ({ index, slot, onSave, onLoad, onDelete, onRename }) => {
    const [renaming, setRenaming] = useState(false);
    const [nameInput, setNameInput] = useState('');

    const startRename = () => {
        setNameInput(slot?.slotName || `Save ${index + 1}`);
        setRenaming(true);
    };

    const commitRename = () => {
        if (nameInput.trim()) onRename(index, nameInput.trim());
        setRenaming(false);
    };

    const handleNameKeyDown = (e) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') setRenaming(false);
    };

    const cardStyle = {
        border: '1px solid var(--border-medium)',
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '10px',
        background: slot ? 'var(--poke-cream)' : 'var(--bg-secondary)'
    };

    if (!slot) {
        return (
            <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{
                        fontSize: '11px', fontWeight: '700', letterSpacing: '1px',
                        color: 'var(--text-muted, #888)', textTransform: 'uppercase'
                    }}>
                        Slot {index + 1}
                    </span>
                    <span style={{ color: 'var(--text-muted, #888)', fontSize: '13px', fontStyle: 'italic' }}>
                        — Empty —
                    </span>
                </div>
                <button
                    onClick={() => onSave(index)}
                    style={{ ...BTN_BASE, background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}
                >
                    Save Here
                </button>
            </div>
        );
    }

    const preview = slot._preview || {};

    return (
        <div style={cardStyle}>
            {/* Header row: slot label + name (editable) + timestamp */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                    <span style={{
                        fontSize: '11px', fontWeight: '700', letterSpacing: '1px',
                        color: 'var(--text-muted, #888)', textTransform: 'uppercase', flexShrink: 0
                    }}>
                        Slot {index + 1}
                    </span>

                    {renaming ? (
                        <>
                            <input
                                type="text"
                                value={nameInput}
                                onChange={e => setNameInput(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={handleNameKeyDown}
                                autoFocus
                                style={{
                                    padding: '2px 8px',
                                    fontSize: '13px',
                                    borderRadius: '5px',
                                    border: '1px solid var(--border-medium)',
                                    background: 'var(--input-bg)',
                                    color: 'var(--text-primary)',
                                    width: '140px'
                                }}
                            />
                            <button
                                onMouseDown={(e) => { e.preventDefault(); commitRename(); }}
                                style={{ ...BTN_BASE, padding: '2px 8px', background: '#4caf50', color: 'white', fontSize: '12px' }}
                            >
                                Save
                            </button>
                            <button
                                onMouseDown={(e) => { e.preventDefault(); setRenaming(false); }}
                                style={{ ...BTN_BASE, padding: '2px 8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', fontSize: '12px' }}
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                                {slot.slotName}
                            </span>
                            <button
                                onClick={startRename}
                                title="Rename slot"
                                aria-label="Rename slot"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted, #888)',
                                    fontSize: '14px',
                                    padding: '0 2px',
                                    lineHeight: 1
                                }}
                            >
                                ✎
                            </button>
                        </>
                    )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)', flexShrink: 0, paddingTop: '2px' }}>
                    {formatDate(slot.savedAt)}
                </span>
            </div>

            {/* Preview info */}
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '10px' }}>
                <div>
                    <span style={{ fontWeight: '600' }}>{preview.trainerName}</span>
                    {preview.trainerLevel != null && <span> · Lv. {preview.trainerLevel}</span>}
                    {preview.honors != null && <span> · {preview.honors} Honors</span>}
                    {preview.money != null && <span> · ₽{preview.money.toLocaleString()}</span>}
                    {preview.trainerCount > 1 && (
                        <span style={{ color: 'var(--text-muted, #888)' }}> · {preview.trainerCount} trainers</span>
                    )}
                </div>
                {preview.partyNames?.length > 0 && (
                    <div style={{ marginTop: '2px', color: 'var(--text-muted, #888)', fontSize: '12px' }}>
                        {preview.partyNames.join(', ')}
                        {preview.partyCount != null && ` (${preview.partyCount}/6)`}
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                    onClick={() => onLoad(index)}
                    style={{ ...BTN_BASE, background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}
                >
                    Load
                </button>
                <button
                    onClick={() => onSave(index, slot.slotName)}
                    style={{
                        ...BTN_BASE,
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-medium)'
                    }}
                >
                    Overwrite
                </button>
                <button
                    onClick={() => onDelete(index)}
                    style={{ ...BTN_BASE, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', marginLeft: 'auto' }}
                >
                    Delete
                </button>
            </div>
        </div>
    );
};

// ── Auto-Save Card ─────────────────────────────────────────────

const AutoSaveCard = ({ autoSave, onLoad }) => {
    const cardStyle = {
        border: '1px solid var(--border-medium, #ddd)',
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '16px',
        background: 'var(--bg-secondary, #f8f8f8)'
    };

    if (!autoSave) {
        return (
            <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        fontSize: '11px', fontWeight: '700', letterSpacing: '1px',
                        color: 'var(--text-muted, #888)', textTransform: 'uppercase'
                    }}>
                        Auto Save
                    </span>
                    <span style={{ color: 'var(--text-muted, #888)', fontSize: '13px', fontStyle: 'italic' }}>
                        No auto-backup yet
                    </span>
                </div>
            </div>
        );
    }

    // Derive preview from raw trainer data — saveData() doesn't include _summary
    const savedAt = autoSave.lastSaved;
    const trainers = autoSave.trainers || [];
    const active = trainers.find(t => t.id === autoSave.activeTrainerId) || trainers[0];
    const partyNames = (active?.party || []).slice(0, 3).map(p => p.name || p.species || 'Unknown');

    return (
        <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{
                    fontSize: '11px', fontWeight: '700', letterSpacing: '1px',
                    color: 'var(--text-muted, #888)', textTransform: 'uppercase'
                }}>
                    Auto Save
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>
                    {formatDate(savedAt)}
                </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '10px' }}>
                <div>
                    <span style={{ fontWeight: '600' }}>{active?.name || 'Trainer'}</span>
                    {active?.level != null && <span> · Lv. {active.level}</span>}
                    {active?.honors != null && <span> · {active.honors} Honors</span>}
                    {trainers.length > 1 && (
                        <span style={{ color: 'var(--text-muted, #888)' }}> · {trainers.length} trainers</span>
                    )}
                </div>
                {partyNames.length > 0 && (
                    <div style={{ marginTop: '2px', color: 'var(--text-muted, #888)', fontSize: '12px' }}>
                        {partyNames.join(', ')} ({active?.party?.length || 0}/6)
                    </div>
                )}
            </div>
            <button
                onClick={onLoad}
                style={{
                    ...BTN_BASE,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-medium)'
                }}
            >
                Load Auto-Save
            </button>
        </div>
    );
};

// ── Main Modal ────────────────────────────────────────────────

const SaveLoadModal = () => {
    const { showSaveLoadModal, closeSaveLoadModal } = useModal();
    const { showHelp } = useUI();
    const { saveSlots, saveToSlot, loadFromSlot, deleteSlot, renameSlot, restoreAutoBackup } = useData();

    const [autoSave, setAutoSave] = useState(null);

    const { modalRef } = useModalKeyboard(showSaveLoadModal, closeSaveLoadModal);

    // Read auto-backup from localStorage when modal opens
    useEffect(() => {
        if (!showSaveLoadModal) return;
        try {
            const raw = localStorage.getItem('pta35-auto-backup');
            setAutoSave(raw ? JSON.parse(raw) : null);
        } catch {
            setAutoSave(null);
        }
    }, [showSaveLoadModal]);

    if (!showSaveLoadModal) return null;

    const slots = saveSlots || [null, null, null];

    return (
        <div className="modal-overlay" onClick={closeSaveLoadModal} role="presentation">
            <div
                ref={modalRef}
                className="modal"
                style={{ maxWidth: 'min(95vw, 520px)', width: '100%' }}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="save-load-modal-title"
            >
                {/* Header */}
                <div
                    className="modal-header"
                    style={{
                        background: 'linear-gradient(135deg, #f7971e, #ffd200)',
                        color: '#1a1a1a',
                        margin: '-25px -25px 20px -25px',
                        padding: '18px 20px',
                        borderRadius: '17px 17px 0 0',
                        borderBottom: 'none'
                    }}
                >
                    <h3
                        id="save-load-modal-title"
                        style={{
                            margin: 0,
                            fontSize: '18px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            textShadow: '0 1px 2px rgba(0,0,0,0.15)'
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>💾</span>
                        Save / Load
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                        <button
                            onClick={() => showHelp('save-slots')}
                            aria-label="Help: Save and Load"
                            title="About save slots and export"
                            style={{
                                background: 'rgba(0,0,0,0.1)',
                                border: '2px solid rgba(0,0,0,0.15)',
                                borderRadius: '50%',
                                width: '28px', height: '28px',
                                fontSize: '13px', fontWeight: 'bold',
                                cursor: 'pointer',
                                color: '#1a1a1a',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                            }}
                        >?</button>
                        <button
                            onClick={closeSaveLoadModal}
                            aria-label="Close modal"
                            title="Close"
                            style={{ ...CLOSE_BTN_STYLE, color: '#1a1a1a', background: 'rgba(0,0,0,0.1)', border: '2px solid rgba(0,0,0,0.15)' }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                                e.currentTarget.style.transform = 'rotate(90deg)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(0,0,0,0.1)';
                                e.currentTarget.style.transform = 'rotate(0deg)';
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '0 25px 20px 25px', overflowY: 'auto', maxHeight: '70vh' }}>
                    {/* Auto-save */}
                    <AutoSaveCard autoSave={autoSave} onLoad={restoreAutoBackup} />

                    {/* Divider label */}
                    <div style={{
                        fontSize: '11px', fontWeight: '700', letterSpacing: '1px',
                        color: 'var(--text-muted, #888)', textTransform: 'uppercase',
                        marginBottom: '10px'
                    }}>
                        Save Slots
                    </div>

                    {/* Slot cards */}
                    {slots.map((slot, i) => (
                        <SlotCard
                            key={i}
                            index={i}
                            slot={slot}
                            onSave={saveToSlot}
                            onLoad={loadFromSlot}
                            onDelete={deleteSlot}
                            onRename={renameSlot}
                        />
                    ))}

                    {/* Footer note */}
                    <div style={{
                        marginTop: '12px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-secondary, #f8f8f8)',
                        border: '1px solid var(--border-light, #eee)',
                        fontSize: '12px',
                        color: 'var(--text-muted, #888)',
                        lineHeight: '1.5'
                    }}>
                        ⚠ Slots save to this browser only. Use <strong>Export</strong> in the Trainer tab for a portable backup file.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaveLoadModal;
