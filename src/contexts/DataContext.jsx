// ============================================================
// Data Context
// ============================================================
// Manages data persistence: save, load, import, export

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storageUtils.js';
import { getActualStats, calculatePokemonHP } from '../utils/dataUtils.js';
import { getPokemonBadges } from '../utils/exportUtils.js';
import { migrateSaveData, cleanupLegacyFeatures, fixStatPointAccounting, capImportedPayloadSizes } from '../utils/dataMigration.js';
import { gameDataLoadPromise } from '../data/gameDataLoader.js';
import { buildEmbed } from '../utils/discordEmbeds.js';
import toast from '../utils/toast.js';
import { useUI } from './UIContext.jsx';
import { useModal } from './ModalContext.jsx';
import { useTrainerContext } from './TrainerContext.jsx';
import { useGameData } from './GameDataContext.jsx';
import {
    MAX_TRAINER_IMPORT_BYTES,
    MS_PER_DAY,
    BACKUP_REMINDER_DAYS,
    AUTOSAVE_DEBOUNCE_MS,
    AUTOSAVE_INTERVAL_MS
} from '../data/constants.js';
import { createDemoTrainer } from '../data/demoTrainer.js';

const DataContext = createContext(null);

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within DataProvider');
    }
    return context;
};

export const DataProvider = ({ children }) => {
    const { triggerSaveIndicator } = useUI();
    const { showConfirm } = useModal();
    const { trainers, setTrainers, activeTrainerId, setActiveTrainerId } = useTrainerContext();
    const { customSpecies, setCustomSpecies, customMoves, setCustomMoves, customOrigins, setCustomOrigins, GAME_DATA } = useGameData();

    // Inventory owned here; shared with PokemonProvider via useData()
    const [inventory, setInventory] = useState([]);

    // GM-only NPC roster (saved stat blocks + Pokémon teams); owned here so it
    // rides the same save/export/import/save-slot pipeline as inventory/customSpecies
    const [npcs, setNpcs] = useState([]);

    // Save slots — 3 named snapshot slots persisted to localStorage
    const [saveSlots, setSaveSlots] = useState(() => {
        try {
            const raw = localStorage.getItem('pta35-save-slots');
            if (raw) return JSON.parse(raw);
        } catch {}
        return [null, null, null];
    });

    // Discord webhook state
    const [discordWebhook, setDiscordWebhook] = useState(() => {
        try {
            const saved = localStorage.getItem('pta35-discord-webhook');
            return saved ? JSON.parse(saved) : { url: '', enabled: false, showSettings: false };
        } catch {
            return { url: '', enabled: false, showSettings: false };
        }
    });

    // Auto-save refs
    const dataLoadedRef = useRef(false);
    const lastAutoSaveDataRef = useRef(null);
    const saveDataRef = useRef(null);
    const isImportingRef = useRef(false);

    // Save Discord webhook settings
    useEffect(() => {
        try {
            localStorage.setItem('pta35-discord-webhook', JSON.stringify({
                url: discordWebhook.url,
                enabled: discordWebhook.enabled,
                showSettings: false
            }));
        } catch (e) {
            console.warn('Could not save Discord webhook settings');
        }
    }, [discordWebhook.url, discordWebhook.enabled]);

    // Note: dataLoadedRef is now set in loadData after data is actually loaded

    // Save data to storage
    const saveData = useCallback(async (isAuto = false) => {
        try {
            // Auto-backup: snapshot the previous save before overwriting. When cloud storage
            // is active, the previous save lives in window.storage, not localStorage — reading
            // localStorage unconditionally here silently froze the backup on whatever was last
            // written before cloud storage took over, making restoreAutoBackup useless for
            // cloud-storage users.
            try {
                let prev;
                if (window.storage) {
                    const result = await window.storage.get('pta35-save-data');
                    prev = result?.value;
                } else {
                    prev = localStorage.getItem('pta35-save-data');
                }
                if (prev) localStorage.setItem('pta35-auto-backup', prev);
            } catch {}

            const savePayload = {
                app: 'pta3',
                trainers,
                activeTrainerId,
                inventory,
                customSpecies,
                customMoves,
                customOrigins,
                npcs,
                lastSaved: new Date().toISOString(),
                version: '2.1'
            };

            let saveSuccess = false;

            if (window.storage) {
                const result = await window.storage.set('pta35-save-data', JSON.stringify(savePayload));
                saveSuccess = !!result;
            } else {
                saveSuccess = safeLocalStorageSet('pta35-save-data', savePayload);
            }

            if (saveSuccess) {
                triggerSaveIndicator(isAuto);
            }
        } catch (error) {
            console.error('Error saving data:', error);
            toast.error('Failed to save. Check your browser storage settings.');
        }
    }, [trainers, activeTrainerId, inventory, customSpecies, customMoves, customOrigins, npcs, triggerSaveIndicator]);

    // Keep ref current so auto-save effects always call the latest version
    useEffect(() => { saveDataRef.current = saveData; });

    // Migrate old data format
    const migrateOldData = useCallback((loadedData) => {
        const migrateSkillsToObject = (skills) => {
            if (!skills) return {};
            if (Array.isArray(skills)) {
                return skills.reduce((acc, skill) => {
                    acc[skill] = 1;
                    return acc;
                }, {});
            }
            return skills;
        };

        const migratePokemonToPartyReserve = (trainerData) => {
            if (trainerData.party !== undefined || trainerData.reserve !== undefined) {
                return {
                    ...trainerData,
                    party: trainerData.party || [],
                    reserve: trainerData.reserve || []
                };
            }

            const allPokemon = trainerData.pokemon || [];
            return {
                ...trainerData,
                party: allPokemon.slice(0, 6),
                reserve: allPokemon.slice(6),
                pokemon: undefined
            };
        };

        if (loadedData.trainer && !loadedData.trainers) {
            let trainerData = loadedData.trainer;

            if (!trainerData.classes) {
                const migratedClasses = [];
                if (trainerData.class) migratedClasses.push(trainerData.class);
                if (trainerData.advancedClass) migratedClasses.push(trainerData.advancedClass);
                trainerData = { ...trainerData, classes: migratedClasses };
            }

            trainerData = {
                ...trainerData,
                id: trainerData.id || Date.now(),
                pokemon: loadedData.pokemon || trainerData.pokemon || []
            };

            trainerData = migratePokemonToPartyReserve(trainerData);
            trainerData = {
                ...trainerData,
                skills: migrateSkillsToObject(trainerData.skills)
            };

            return {
                trainers: [trainerData],
                activeTrainerId: trainerData.id,
                inventory: loadedData.inventory || []
            };
        }

        if (loadedData.trainers) {
            return {
                ...loadedData,
                trainers: loadedData.trainers.map(t => {
                    const migrated = {
                        ...migratePokemonToPartyReserve(t),
                        skills: migrateSkillsToObject(t.skills)
                    };
                    // If trainer has classes but no classLevels, initialise each class
                    // to the trainer's current level (conservative: assume taken at Lv 1)
                    if (Array.isArray(migrated.classes) && migrated.classes.length > 0 && !migrated.classLevels) {
                        migrated.classLevels = Object.fromEntries(
                            migrated.classes.map(cls => [cls, migrated.level || 1])
                        );
                    }
                    return migrated;
                })
            };
        }

        return loadedData;
    }, []);

    // Load data from storage
    const loadData = useCallback(async () => {
        try {
            let loadedData = null;

            if (window.storage) {
                try {
                    const result = await window.storage.get('pta35-save-data');
                    if (result && result.value) {
                        loadedData = JSON.parse(result.value);
                    }
                } catch (storageErr) {
                    console.warn('Cloud storage not available, falling back to localStorage');
                }
            }

            if (!loadedData) {
                loadedData = safeLocalStorageGet('pta35-save-data', null);
            }

            // One-time migration: pick up existing saves stored under the old key name
            if (!loadedData) {
                const legacy = safeLocalStorageGet('pta-enhanced-save-data', null);
                if (legacy && typeof legacy === 'object') {
                    loadedData = legacy;
                    // Persist under new key immediately; old key is left in place (harmless)
                    try { safeLocalStorageSet('pta35-save-data', legacy); } catch {}
                }
            }

            if (loadedData) {
                if (typeof loadedData !== 'object') {
                    console.error('Invalid data format loaded');
                    toast.error('Save data appears corrupt. Starting with a fresh trainer.');
                    return;
                }

                // Reject saves from a different app
                if (loadedData.app && loadedData.app !== 'pta3') {
                    toast.error('This save is from a different version of the app and cannot be loaded here.');
                    dataLoadedRef.current = true;
                    return;
                }

                // Step 1: structural migration (single-trainer → trainers array, skills array → object)
                let migratedData = migrateOldData(loadedData);

                // Step 2: PTA3 rules migration (old stats/moves → new format); no-op on already-migrated saves
                const { data: pta3Data, migrated: wasMigrated } = migrateSaveData(migratedData);
                if (wasMigrated) {
                    migratedData = pta3Data;
                    toast.info('Save data migrated to PTA3 format. Please review your trainer stats.');
                    // Persist the migration immediately so it does not re-trigger on next load
                    try {
                        safeLocalStorageSet('pta35-save-data', pta3Data);
                    } catch {}
                }

                // Step 3: Strip old-PTA feature strings that have no PTA3 equivalent.
                // Wait for game data so GAME_DATA.features is populated before cleaning.
                await gameDataLoadPromise.catch(() => {});
                const { data: cleanedData, cleaned: wasFeaturesCleaned } = cleanupLegacyFeatures(migratedData, GAME_DATA?.features || {});
                if (wasFeaturesCleaned) {
                    migratedData = cleanedData;
                    // Persist immediately so old features don't reappear
                    try {
                        safeLocalStorageSet('pta35-save-data', cleanedData);
                    } catch {}
                }

                // Step 4: Fix stat-point accounting for trainers still mid-creation (Level 0)
                const { data: statFixedData, fixed: wasStatFixed } = fixStatPointAccounting(migratedData);
                if (wasStatFixed) {
                    migratedData = statFixedData;
                    try {
                        safeLocalStorageSet('pta35-save-data', statFixedData);
                    } catch {}
                }

                if (migratedData.trainers && Array.isArray(migratedData.trainers) && migratedData.trainers.length > 0) {
                    // Validate activeTrainerId exists in trainers array, otherwise use first trainer
                    const validActiveId = migratedData.trainers.some(t => t.id === migratedData.activeTrainerId)
                        ? migratedData.activeTrainerId
                        : migratedData.trainers[0].id;
                    setTrainers(migratedData.trainers);
                    setActiveTrainerId(validActiveId);
                }
                setInventory(Array.isArray(migratedData.inventory) ? migratedData.inventory : []);
                setCustomSpecies(Array.isArray(migratedData.customSpecies) ? migratedData.customSpecies : []);
                setCustomMoves(Array.isArray(migratedData.customMoves) ? migratedData.customMoves : []);
                setCustomOrigins(Array.isArray(migratedData.customOrigins) ? migratedData.customOrigins : []);
                setNpcs(Array.isArray(migratedData.npcs) ? migratedData.npcs : []);
            }
            // Mark data as loaded AFTER loading completes
            dataLoadedRef.current = true;

            // Backup reminder — nudge after 7 days without export
            try {
                const lastBackup = parseInt(localStorage.getItem('pta35-last-backup') || '0');
                const daysSince = lastBackup ? Math.floor((Date.now() - lastBackup) / MS_PER_DAY) : -1;
                if (daysSince > BACKUP_REMINDER_DAYS) {
                    setTimeout(() => toast.info(`It's been ${daysSince} days since your last backup. Consider exporting your data!`), 3000);
                }
            } catch {}
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Could not load saved data. Starting fresh.');
            // Still enable auto-save on error so user can save their work
            dataLoadedRef.current = true;
        }
    }, [migrateOldData, GAME_DATA, setTrainers, setActiveTrainerId, setInventory, setCustomSpecies, setCustomMoves, setCustomOrigins, setNpcs]);

    // Restore from the rolling auto-backup snapshot
    const restoreAutoBackup = useCallback(() => {
        showConfirm({
            title: 'Restore Auto-Backup',
            message: 'This will replace your current data with the snapshot taken before your last save. Any changes since then will be lost. Continue?',
            danger: true,
            confirmLabel: 'Restore',
            onConfirm: () => {
                try {
                    const backup = localStorage.getItem('pta35-auto-backup');
                    if (!backup) {
                        toast.warning('No auto-backup found. Save at least once to create a backup snapshot.');
                        return;
                    }
                    const parsed = JSON.parse(backup);
                    // Run the same migration pipeline as loadData (structural → PTA3 rules →
                    // legacy feature cleanup → stat-point accounting fix) — an auto-backup
                    // taken before a migration shipped would otherwise be restored unconverted.
                    let migrated = migrateOldData(parsed);
                    const { data: pta3Data } = migrateSaveData(migrated);
                    migrated = pta3Data;
                    const { data: cleanedData } = cleanupLegacyFeatures(migrated, GAME_DATA?.features || {});
                    migrated = cleanedData;
                    const { data: statFixedData } = fixStatPointAccounting(migrated);
                    migrated = statFixedData;

                    if (migrated.trainers && Array.isArray(migrated.trainers) && migrated.trainers.length > 0) {
                        const validActiveId = migrated.trainers.some(t => t.id === migrated.activeTrainerId)
                            ? migrated.activeTrainerId
                            : migrated.trainers[0].id;
                        setTrainers(migrated.trainers);
                        setActiveTrainerId(validActiveId);
                    }
                    setInventory(Array.isArray(migrated.inventory) ? migrated.inventory : []);
                    setCustomSpecies(Array.isArray(migrated.customSpecies) ? migrated.customSpecies : []);
                    setCustomMoves(Array.isArray(migrated.customMoves) ? migrated.customMoves : []);
                    setCustomOrigins(Array.isArray(migrated.customOrigins) ? migrated.customOrigins : []);
                    setNpcs(Array.isArray(migrated.npcs) ? migrated.npcs : []);
                    toast.success('Auto-backup restored successfully!');
                } catch (err) {
                    console.error('Restore auto-backup error:', err);
                    toast.error('Could not restore auto-backup. The snapshot may be corrupt.');
                }
            }
        });
    }, [showConfirm, migrateOldData, GAME_DATA, setTrainers, setActiveTrainerId, setInventory, setCustomSpecies, setCustomMoves, setCustomOrigins, setNpcs]);

    const loadDemoTrainer = useCallback(() => {
        showConfirm({
            title: 'Load Example Trainer?',
            message: 'This will add "Red" as a new trainer with two Pokémon so you can explore the app. Your existing trainers will not be replaced.',
            confirmLabel: 'Load Example',
            onConfirm: () => {
                const demo = createDemoTrainer();
                setTrainers(prev => [...prev, demo]);
                setActiveTrainerId(demo.id);
                toast.success('Example trainer "Red" loaded! Explore the Trainer and Pokémon tabs.');
            }
        });
    }, [showConfirm, setTrainers, setActiveTrainerId]);

    // ── Save Slot helpers ──────────────────────────────────────

    const persistSlots = useCallback((slots) => {
        setSaveSlots(slots);
        try {
            localStorage.setItem('pta35-save-slots', JSON.stringify(slots));
        } catch {
            toast.error('Could not save slot data. Check your browser storage.');
        }
    }, []);

    const buildPreview = useCallback(() => {
        const active = trainers.find(t => t.id === activeTrainerId) || trainers[0];
        return {
            trainerName: active?.name || 'Trainer',
            trainerLevel: active?.level || 1,
            honors: active?.honors ?? 0,
            money: active?.money || 0,
            partyCount: active?.party?.length || 0,
            partyNames: (active?.party || []).slice(0, 3).map(p => p.name || p.species || 'Unknown'),
            trainerCount: trainers.length
        };
    }, [trainers, activeTrainerId]);

    const saveToSlot = useCallback((index, slotName) => {
        const doSave = (name) => {
            const slots = saveSlots ? [...saveSlots] : [null, null, null];
            slots[index] = {
                app: 'pta3',
                savedAt: new Date().toISOString(),
                slotName: name || `Save ${index + 1}`,
                trainers,
                activeTrainerId,
                inventory,
                customSpecies,
                customMoves,
                customOrigins,
                npcs,
                version: '2.1',
                _preview: buildPreview()
            };
            persistSlots(slots);
            toast.success(`Slot ${index + 1} saved!`);
        };

        if (saveSlots[index]) {
            showConfirm({
                title: `Overwrite Slot ${index + 1}?`,
                message: `This will replace the existing save "${saveSlots[index].slotName}". Continue?`,
                confirmLabel: 'Overwrite',
                onConfirm: () => doSave(slotName || saveSlots[index].slotName)
            });
        } else {
            doSave(slotName);
        }
    }, [saveSlots, trainers, activeTrainerId, inventory, customSpecies, customMoves, customOrigins, npcs, buildPreview, persistSlots, showConfirm]);

    const loadFromSlot = useCallback((index) => {
        const slot = saveSlots[index];
        if (!slot) return;
        showConfirm({
            title: `Load Slot ${index + 1}?`,
            message: `"${slot.slotName}" — Current progress will be replaced. Continue?`,
            confirmLabel: 'Load',
            onConfirm: async () => {
                try {
                    // Run the same migration pipeline as the main save file. A slot can
                    // predate a schema change (old stat system, EXP→Honors, etc.) since it's
                    // just a localStorage snapshot — loading it verbatim would silently
                    // corrupt the trainer instead of converting it like every other load path.
                    let migratedData = migrateOldData(slot);

                    const { data: pta3Data, migrated: wasMigrated } = migrateSaveData(migratedData);
                    if (wasMigrated) migratedData = pta3Data;

                    await gameDataLoadPromise.catch(() => {});
                    const { data: cleanedData, cleaned: wasFeaturesCleaned } = cleanupLegacyFeatures(migratedData, GAME_DATA?.features || {});
                    if (wasFeaturesCleaned) migratedData = cleanedData;

                    const { data: statFixedData, fixed: wasStatFixed } = fixStatPointAccounting(migratedData);
                    if (wasStatFixed) migratedData = statFixedData;

                    if (wasMigrated || wasFeaturesCleaned || wasStatFixed) {
                        // Persist the migrated version back into the slot so it doesn't re-trigger next time
                        const slots = [...saveSlots];
                        slots[index] = { ...slot, trainers: migratedData.trainers, inventory: migratedData.inventory, customSpecies: migratedData.customSpecies, customMoves: migratedData.customMoves, customOrigins: migratedData.customOrigins, npcs: migratedData.npcs };
                        persistSlots(slots);
                    }

                    if (migratedData.trainers && Array.isArray(migratedData.trainers) && migratedData.trainers.length > 0) {
                        const validActiveId = migratedData.trainers.some(t => t.id === migratedData.activeTrainerId)
                            ? migratedData.activeTrainerId
                            : migratedData.trainers[0].id;
                        setTrainers(migratedData.trainers);
                        setActiveTrainerId(validActiveId);
                    }
                    setInventory(Array.isArray(migratedData.inventory) ? migratedData.inventory : []);
                    setCustomSpecies(Array.isArray(migratedData.customSpecies) ? migratedData.customSpecies : []);
                    setCustomMoves(Array.isArray(migratedData.customMoves) ? migratedData.customMoves : []);
                    setCustomOrigins(Array.isArray(migratedData.customOrigins) ? migratedData.customOrigins : []);
                    setNpcs(Array.isArray(migratedData.npcs) ? migratedData.npcs : []);
                    if (wasMigrated) toast.info('This slot was migrated to PTA3 format. Please review your trainer stats.');
                    toast.success(`Slot ${index + 1} loaded!`);
                } catch (err) {
                    console.error('Load slot error:', err);
                    toast.error('Could not load slot. The save may be corrupt.');
                }
            }
        });
    }, [saveSlots, showConfirm, setTrainers, setActiveTrainerId, setInventory, setCustomSpecies, setCustomMoves, setCustomOrigins, setNpcs, migrateOldData, persistSlots, GAME_DATA]);

    const deleteSlot = useCallback((index) => {
        const slot = saveSlots[index];
        if (!slot) return;
        showConfirm({
            title: `Delete Slot ${index + 1}?`,
            message: `This will permanently delete "${slot.slotName}".`,
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: () => {
                const slots = [...saveSlots];
                slots[index] = null;
                persistSlots(slots);
                toast.success(`Slot ${index + 1} deleted.`);
            }
        });
    }, [saveSlots, showConfirm, persistSlots]);

    const renameSlot = useCallback((index, name) => {
        if (!saveSlots[index] || !name.trim()) return;
        const slots = [...saveSlots];
        slots[index] = { ...slots[index], slotName: name.trim() };
        persistSlots(slots);
    }, [saveSlots, persistSlots]);

    // ── End Save Slot helpers ──────────────────────────────────

    // Export all data as JSON file
    const exportAllData = useCallback(() => {
        const exportData = {
            app: 'pta3',
            trainers,
            activeTrainerId,
            inventory,
            customSpecies,
            customMoves,
            customOrigins,
            npcs,
            exportedAt: new Date().toISOString(),
            version: '2.1',
            _m: { c: 'leander_rsr', h: '6c65616e6465725f727372' },
            _summary: {
                trainerCount: trainers.length,
                trainerNames: trainers.map(t => t.name || 'Unnamed').join(', '),
                totalMoney: trainers.reduce((sum, t) => sum + (t.money || 0), 0),
                inventoryItemCount: inventory.length,
                totalPokemon: trainers.reduce((sum, t) => sum + (t.party?.length || 0) + (t.reserve?.length || 0), 0),
                npcCount: npcs.length
            }
        };
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pta3-all-trainers-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        try { localStorage.setItem('pta35-last-backup', Date.now().toString()); } catch {}
    }, [trainers, activeTrainerId, inventory, customSpecies, customMoves, customOrigins, npcs]);

    // Export single trainer (no global inventory — use exportAllData for that)
    const exportSingleTrainer = useCallback((trainerToExport) => {
        const exportData = {
            app: 'pta3',
            trainer: {
                ...trainerToExport,
                money: trainerToExport.money || 0,
                party: trainerToExport.party || [],
                reserve: trainerToExport.reserve || []
            },
            pokemon: [...(trainerToExport.party || []), ...(trainerToExport.reserve || [])],
            exportedAt: new Date().toISOString(),
            version: '1.1',
            _m: { c: 'leander_rsr', h: '6c65616e6465725f727372' },
            _summary: {
                trainerName: trainerToExport.name || 'Unnamed',
                trainerLevel: trainerToExport.level || 0,
                money: trainerToExport.money || 0,
                partyCount: (trainerToExport.party || []).length,
                reserveCount: (trainerToExport.reserve || []).length
            }
        };
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${trainerToExport.name || 'trainer'}-pta3-data.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    // Import data from JSON file
    const importData = useCallback((file) => {
        if (isImportingRef.current) return;
        if (file.size > MAX_TRAINER_IMPORT_BYTES) {
            toast.error('File too large. Maximum import size is 5MB.');
            return;
        }
        isImportingRef.current = true;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rawData = JSON.parse(e.target.result);
                // Cap array/string sizes before anything else touches this data — it's
                // crossing a trust boundary (an arbitrary file the user picked), and a
                // corrupt or malicious save could otherwise inject unbounded
                // strings/arrays that get merged straight into persisted state.
                const data = capImportedPayloadSizes(rawData);

                // Reject saves explicitly marked for a different app
                if (data.app && data.app !== 'pta3') {
                    toast.error('This file is from a different version of the app (pta-dex) and cannot be imported here.');
                    isImportingRef.current = false;
                    return;
                }

                const migrateSkills = (skills) => {
                    if (!skills) return {};
                    if (Array.isArray(skills)) {
                        return skills.reduce((acc, s) => ({ ...acc, [s]: 1 }), {});
                    }
                    return skills;
                };

                if (data.trainers) {
                    // Run the same migration pipeline as loadData/loadFromSlot — a multi-trainer
                    // import file can predate a schema change (old stat system, EXP→Honors, the
                    // point-buy accounting fix, etc.) just like a save slot can.
                    let migratedData = data;
                    const { data: pta3Data, migrated: wasMigrated } = migrateSaveData(migratedData);
                    if (wasMigrated) migratedData = pta3Data;
                    const { data: cleanedData, cleaned: wasFeaturesCleaned } = cleanupLegacyFeatures(migratedData, GAME_DATA?.features || {});
                    if (wasFeaturesCleaned) migratedData = cleanedData;
                    const { data: statFixedData, fixed: wasStatFixed } = fixStatPointAccounting(migratedData);
                    if (wasStatFixed) migratedData = statFixedData;

                    const migratedTrainers = migratedData.trainers.map(t => ({
                        ...t,
                        money: t.money || 0,
                        party: t.party || t.pokemon?.slice(0, 6) || [],
                        reserve: t.reserve || t.pokemon?.slice(6) || [],
                        skills: migrateSkills(t.skills)
                    }));
                    const totalPokemon = migratedTrainers.reduce((sum, t) => sum + (t.party?.length || 0) + (t.reserve?.length || 0), 0);
                    const inventoryCount = migratedData.inventory?.length || 0;

                    const applyTrainersImport = (mode) => {
                        setTrainers(mode === 'add' ? prev => [...prev, ...migratedTrainers] : migratedTrainers);
                        setActiveTrainerId(migratedData.activeTrainerId || migratedTrainers[0]?.id);
                        if (migratedData.inventory) setInventory(migratedData.inventory);
                        if (migratedData.customSpecies) setCustomSpecies(migratedData.customSpecies);
                        if (Array.isArray(migratedData.customMoves)) setCustomMoves(migratedData.customMoves);
                        if (Array.isArray(migratedData.customOrigins)) setCustomOrigins(migratedData.customOrigins);
                        if (Array.isArray(migratedData.npcs)) setNpcs(migratedData.npcs);

                        if (wasMigrated) toast.info('This file was migrated to PTA3 format. Please review your trainer stats.');
                        toast.success(`Data imported successfully!\n${migratedTrainers.length} trainer(s), ${totalPokemon} Pokemon, ${inventoryCount} item(s)`);
                    };

                    // Unlike a single-trainer import, this file can silently wipe every existing
                    // trainer at once — confirm first, mirroring the single-trainer import's own
                    // Add-as-New / Replace-All choice below.
                    if (trainers.length > 0 && trainers[0].name) {
                        showConfirm({
                            title: 'Import All Trainers',
                            message: `This file contains ${migratedTrainers.length} trainer(s). You have existing trainers — how would you like to import?`,
                            confirmLabel: 'Add as New',
                            cancelLabel: 'Replace All',
                            danger: true,
                            onConfirm: () => applyTrainersImport('add'),
                            onCancel: () => applyTrainersImport('replace')
                        });
                    } else {
                        applyTrainersImport('replace');
                    }
                } else if (data.trainer) {
                    let trainerData = data.trainer;

                    if (!trainerData.classes) {
                        const migratedClasses = [];
                        if (trainerData.class) migratedClasses.push(trainerData.class);
                        if (trainerData.advancedClass) migratedClasses.push(trainerData.advancedClass);
                        trainerData = { ...trainerData, classes: migratedClasses };
                    }

                    trainerData = {
                        ...trainerData,
                        id: trainerData.id || Date.now(),
                        money: trainerData.money || 0,
                        party: trainerData.party || data.pokemon?.slice(0, 6) || trainerData.pokemon?.slice(0, 6) || [],
                        reserve: trainerData.reserve || data.pokemon?.slice(6) || trainerData.pokemon?.slice(6) || [],
                        skills: migrateSkills(trainerData.skills)
                    };

                    // Run the same PTA3 migration pipeline as the multi-trainer import branch
                    // above — exportSingleTrainer still writes old-format (pre-PTA3) files, so a
                    // single-trainer import can just as easily predate a schema change.
                    let wasMigrated = false;
                    {
                        const { data: pta3Data, migrated } = migrateSaveData({ trainers: [trainerData] });
                        if (migrated) { trainerData = pta3Data.trainers[0]; wasMigrated = true; }
                        const { data: cleanedData, cleaned } = cleanupLegacyFeatures({ trainers: [trainerData] }, GAME_DATA?.features || {});
                        if (cleaned) trainerData = cleanedData.trainers[0];
                        const { data: statFixedData, fixed } = fixStatPointAccounting({ trainers: [trainerData] });
                        if (fixed) trainerData = statFixedData.trainers[0];
                    }
                    if (wasMigrated) toast.info('This trainer was migrated to PTA3 format. Please review their stats.');

                    const doInventoryImport = () => {
                        if (data.inventory && data.inventory.length > 0) {
                            if (inventory.length > 0) {
                                showConfirm({
                                    title: 'Import Inventory',
                                    message: `The import file contains ${data.inventory.length} inventory item(s).\n\nHow would you like to handle your existing inventory?`,
                                    confirmLabel: 'Merge',
                                    cancelLabel: 'Replace All',
                                    onConfirm: () => {
                                        const mergedInventory = [...inventory];
                                        data.inventory.forEach(importItem => {
                                            const existingIndex = mergedInventory.findIndex(i => i.name === importItem.name);
                                            if (existingIndex >= 0) {
                                                mergedInventory[existingIndex] = {
                                                    ...mergedInventory[existingIndex],
                                                    quantity: (mergedInventory[existingIndex].quantity || 1) + (importItem.quantity || 1)
                                                };
                                            } else {
                                                mergedInventory.push(importItem);
                                            }
                                        });
                                        setInventory(mergedInventory);
                                    },
                                    onCancel: () => setInventory(data.inventory)
                                });
                            } else {
                                setInventory(data.inventory);
                            }
                        }
                    };

                    const pokemonCount = (trainerData.party?.length || 0) + (trainerData.reserve?.length || 0);
                    toast.success(`Trainer "${trainerData.name || 'Unnamed'}" imported! (Lv ${trainerData.level || 0}, ${pokemonCount} Pokemon)`);

                    if (trainers.length > 0 && trainers[0].name) {
                        showConfirm({
                            title: 'Import Trainers',
                            message: `You have existing trainers. How would you like to import "${trainerData.name || 'Imported Trainer'}"?`,
                            confirmLabel: 'Add as New',
                            cancelLabel: 'Replace All',
                            onConfirm: () => {
                                trainerData.id = Date.now();
                                setTrainers(prev => [...prev, trainerData]);
                                setActiveTrainerId(trainerData.id);
                                doInventoryImport();
                            },
                            onCancel: () => {
                                setTrainers([trainerData]);
                                setActiveTrainerId(trainerData.id);
                                doInventoryImport();
                            }
                        });
                    } else {
                        setTrainers([trainerData]);
                        setActiveTrainerId(trainerData.id);
                        doInventoryImport();
                    }
                } else {
                    toast.error('No trainer data found in file.');
                }
            } catch (err) {
                console.error('Import error:', err);
                toast.error('Error importing data: Invalid file format');
            } finally {
                isImportingRef.current = false;
            }
        };
        reader.onerror = () => { isImportingRef.current = false; };
        reader.readAsText(file);
    }, [trainers, inventory, setTrainers, setActiveTrainerId, setInventory, setCustomSpecies, setCustomMoves, setNpcs, showConfirm, GAME_DATA]);

    // Export text functions
    const exportTrainerText = useCallback((trainer) => {
        // PTA3: trainer HP = 20 base + milestone rolls; no HP stat
        const maxHP = (trainer.maxHp ?? 20) + (trainer.hpRolls || []).reduce((s, v) => s + v, 0);
        const genderSymbol = trainer.gender === 'male' ? '♂' : trainer.gender === 'female' ? '♀' : '';
        const classesDisplay = (trainer.classes && trainer.classes.length > 0) ? trainer.classes.join(' / ') : 'Trainer';
        const honors = trainer.honors ?? 0;

        let text = `**━━━━━━ TRAINER CARD ━━━━━━**\n`;
        text += `**${trainer.name || 'Unnamed'}** ${genderSymbol}\n`;
        text += `Level ${trainer.level} ${classesDisplay} · ${honors} Honors\n\n`;
        text += `**Stats** (Max HP: ${maxHP})\n`;
        text += `ATK: ${trainer.stats.atk ?? 0} | DEF: ${trainer.stats.def ?? 0} | SATK: ${trainer.stats.satk ?? 0}\n`;
        text += `SDEF: ${trainer.stats.sdef ?? 0} | SPD: ${trainer.stats.spd ?? 0}\n\n`;

        const featureNames = (trainer.features || []).map(f => typeof f === 'object' ? f.name : f);
        if (featureNames.length > 0) {
            text += `**Features:** ${featureNames.join(', ')}\n`;
        }

        const skillsForDisplay = Array.isArray(trainer.skills)
            ? trainer.skills
            : Object.entries(trainer.skills || {})
                .filter(([_, rank]) => rank > 0)
                .map(([name, rank]) => rank === 2 ? `${name} (★★)` : name);
        if (skillsForDisplay.length > 0) {
            text += `**Skills:** ${skillsForDisplay.join(', ')}\n`;
        }
        if (trainer.badges?.length > 0) {
            text += `**Badges:** ${trainer.badges.length}\n`;
        }
        if (trainer.equippedItems?.length > 0) {
            text += `**Equipped:** ${trainer.equippedItems.join(', ')}\n`;
        }
        text += `**Money:** ₽${(trainer.money || 0).toLocaleString()}\n`;
        text += `**━━━━━━━━━━━━━━━━━━━━━**`;

        return text;
    }, []);

    const exportPokemonText = useCallback((poke) => {
        const actualStats = getActualStats(poke);
        const maxHP = calculatePokemonHP(poke);
        const genderSymbol = poke.gender === 'male' ? '♂' : poke.gender === 'female' ? '♀' : poke.gender === 'genderless' ? '⚪' : '';
        const badges = getPokemonBadges(poke);

        let text = `**━━━━━━ POKÉMON ━━━━━━**\n`;
        text += `**${poke.name}** ${genderSymbol}`;
        if (poke.species && poke.species !== poke.name) {
            text += ` (${poke.species})`;
        }
        if (badges.length > 0) {
            text += ` ${badges.join(' ')}`;
        }
        text += `\n`;
        text += `${(poke.types || []).join('/')} | ${poke.nature} Nature\n`;

        const abilities = [poke.ability, poke.ability2, poke.ability3].filter(a => a);
        text += `**Abilities:** ${abilities.length > 0 ? abilities.join(', ') : 'None'}\n`;

        const skills = (poke.pokemonSkills || []);
        if (skills.length > 0) {
            const skillsStr = skills.map(s => s.value ? `${s.name} ${s.value}` : s.name).join(', ');
            text += `**Skills:** ${skillsStr}\n`;
        }
        text += `\n`;

        text += `**Stats** (Max HP: ${maxHP})\n`;
        text += `HP: ${actualStats.hp} | ATK: ${actualStats.atk} | DEF: ${actualStats.def}\n`;
        text += `SATK: ${actualStats.satk} | SDEF: ${actualStats.sdef} | SPD: ${actualStats.spd}\n\n`;

        if ((poke.moves || []).length > 0) {
            text += `**Moves:**\n`;
            poke.moves.forEach(move => {
                text += `• ${move.name} (${move.type}) - ${move.damage || 'Status'} [${move.frequency}]\n`;
            });
        }

        text += `**━━━━━━━━━━━━━━━━━━━━━**`;

        return text;
    }, []);

    const exportTeamText = useCallback((trainer, party) => {
        const genderSymbol = trainer.gender === 'male' ? '♂' : trainer.gender === 'female' ? '♀' : '';
        const classesDisplay = (trainer.classes && trainer.classes.length > 0) ? trainer.classes.join(' / ') : 'Trainer';

        let text = `**╔══════════════════════════════════════╗**\n`;
        text += `**║     ${trainer.name || 'Unnamed'} ${genderSymbol} - TEAM CARD     ║**\n`;
        text += `**╚══════════════════════════════════════╝**\n\n`;

        text += `📋 **TRAINER INFO**\n`;
        text += `Level ${trainer.level} ${classesDisplay}\n`;
        text += `💰 ₽${(trainer.money || 0).toLocaleString()} | 🎖️ ${trainer.badges?.length || 0} Badges\n`;
        if (trainer.equippedItems?.length > 0) {
            text += `🎒 Equipped: ${trainer.equippedItems.join(', ')}\n`;
        }
        text += `\n`;

        text += `⚔️ **ACTIVE PARTY** (${party.length}/6)\n`;
        text += `─────────────────────────────────\n`;

        if (party.length === 0) {
            text += `(No Pokémon in party)\n`;
        } else {
            party.forEach((poke, idx) => {
                const actualStats = getActualStats(poke);
                const maxHP = calculatePokemonHP(poke);
                const currentHP = maxHP - (poke.currentDamage || 0);
                const genderIcon = poke.gender === 'male' ? '♂' : poke.gender === 'female' ? '♀' : '';
                const typeStr = poke.types?.join('/') || 'Normal';
                const badges = getPokemonBadges(poke);
                const badgeSuffix = badges.length > 0 ? ` ${badges.join(' ')}` : '';

                text += `\n**${idx + 1}. ${poke.name || poke.species || 'Unknown'}** ${genderIcon}${badgeSuffix}\n`;
                text += `   ${typeStr} | HP: ${currentHP}/${maxHP}\n`;
                text += `   ATK:${actualStats.atk} DEF:${actualStats.def} SATK:${actualStats.satk} SDEF:${actualStats.sdef} SPD:${actualStats.spd}\n`;

                if (poke.moves && poke.moves.length > 0) {
                    const moveNames = poke.moves.slice(0, 4).map(m => m.name).join(', ');
                    text += `   Moves: ${moveNames}\n`;
                }
            });
        }

        text += `\n─────────────────────────────────\n`;
        text += `📅 ${new Date().toLocaleDateString()} | P:TA Character Manager`;

        return text;
    }, []);

    // Copy to clipboard
    const copyToClipboard = useCallback((text) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success('Copied to clipboard!');
        }).catch(err => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            toast.success('Copied to clipboard!');
        });
    }, []);

    // Send to Discord
    const sendToDiscord = useCallback(async (roll, trainerName) => {
        if (!discordWebhook.enabled || !discordWebhook.url?.trim()) return;
        const embed = buildEmbed(roll, trainerName || 'Trainer');
        if (!embed) return;
        try {
            const res = await fetch(discordWebhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'PTA Dice Roller',
                    avatar_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
                    embeds: [embed],
                }),
            });
            if (!res.ok) {
                const msg = res.status === 401 || res.status === 403
                    ? 'Discord webhook rejected. Check your webhook URL.'
                    : `Discord send failed (${res.status}).`;
                toast.error(msg);
            }
        } catch (error) {
            console.error('Failed to send to Discord:', error);
            toast.error('Failed to send to Discord. Check your webhook URL.');
        }
    }, [discordWebhook.enabled, discordWebhook.url]);

    // Load data on mount
    useEffect(() => {
        loadData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Debounced auto-save on data changes (1 second delay)
    useEffect(() => {
        if (!dataLoadedRef.current) return;

        const saveTimeout = setTimeout(() => {
            saveDataRef.current?.();
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => clearTimeout(saveTimeout);
    }, [trainers, inventory, activeTrainerId, customSpecies, customMoves, customOrigins, npcs]);

    // Interval-based auto-save (every 2 minutes, only if changed)
    // No data dependencies — interval should not restart on every data change
    useEffect(() => {
        const autoSaveInterval = setInterval(() => {
            if (!dataLoadedRef.current) return;
            saveDataRef.current?.(true);
        }, AUTOSAVE_INTERVAL_MS);

        return () => clearInterval(autoSaveInterval);
    }, []);

    const value = {
        // Inventory State
        inventory,
        setInventory,

        // GM NPC Roster
        npcs,
        setNpcs,

        // Persistence
        saveData,
        loadData,
        restoreAutoBackup,
        loadDemoTrainer,
        exportAllData,
        exportSingleTrainer,
        importData,

        // Save Slots
        saveSlots,
        saveToSlot,
        loadFromSlot,
        deleteSlot,
        renameSlot,

        // Export Text
        exportTrainerText,
        exportPokemonText,
        exportTeamText,
        copyToClipboard,

        // Discord
        discordWebhook,
        setDiscordWebhook,
        sendToDiscord
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

export default DataContext;
