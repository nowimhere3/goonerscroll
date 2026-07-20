/**
 * presets.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * Workspace Tabs — all preset/workspace business logic lives here.
 *
 * Responsibility split (deliberate, so this doesn't grow into a second
 * sync.js or a second state.js):
 *   presets.json → data only (the actual saved workspace snapshots)
 *   sync.js      → GitHub read/write only (knows nothing about "workspaces")
 *   presets.js   → everything else: schema, summaries, loading/saving,
 *                  and (later) rename/duplicate/import/export/reordering
 *
 * Phase 1 scope: storage foundation only. Nothing here is wired into
 * index.html or index3.html's UI yet — that's Phase 2 (Workspace Tabs UI)
 * and Phase 4 (Grid working-copy architecture).
 *
 * Schema (one entry in the presets.json array):
 *   {
 *     id:           number   — stable identity, independent of display order
 *     name:         string   — "Preset 1" by default; user-renamable later
 *     urls:         string[] — same shape as Store('matrixUrls')
 *     folderMap:    object   — same shape as getUrlFolderMap()
 *     lockState:    object   — same shape as getRowLockState()
 *     rowCount:     number   — urls.length, stored directly for fast UI reads
 *     streamCount:  number   — urls.filter(Boolean).length, ditto
 *     isEmpty:      boolean  — true when there's nothing meaningful saved yet
 *     savedAt:      string | null — ISO timestamp of the last save, or null
 *   }
 *
 * Presets are stored as an ARRAY, not five hardcoded keys — this is what
 * makes future work (more slots, reordering, duplicate, import/export)
 * additive instead of a rewrite. DEFAULT_PRESET_COUNT is the only place
 * "5" is hardcoded, and it only matters when bootstrapping a brand new
 * presets.json — an existing file's own length always wins.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getPresetsStructure, setPresetsStructure } from './state.js';
import { fetchPresetsSilently, fetchPresetsWithUI, pushPresetsToRemote } from './sync.js';

export const DEFAULT_PRESET_COUNT = 5;

/** A fresh, never-saved preset slot. */
export function createEmptyPreset(id) {
    return {
        id,
        name: `Preset ${id}`,
        urls: [],
        folderMap: {},
        lockState: {},
        rowCount: 0,
        streamCount: 0,
        isEmpty: true,
        savedAt: null,
    };
}

/** A brand new presets array, used the first time presets.json doesn't exist yet. */
export function createDefaultPresetsArray(count = DEFAULT_PRESET_COUNT) {
    const presets = [];
    for (let i = 1; i <= count; i += 1) presets.push(createEmptyPreset(i));
    return presets;
}

/**
 * Read the presets array from in-memory state. Never returns null/undefined —
 * falls back to a fresh default array so callers never need a null-check.
 */
export function getPresets() {
    return getPresetsStructure() || createDefaultPresetsArray();
}

export function getPresetById(id) {
    return getPresets().find((p) => p.id === id) || null;
}

/**
 * Build the data a Workspace Tab / Save-As dropup needs to render, without
 * the caller needing to know the raw schema. Centralizing this here means
 * the "4 Rows • 16 Streams / Saved yesterday" formatting is written once.
 */
export function getPresetSummary(preset) {
    if (!preset || preset.isEmpty) {
        return { rowsLabel: null, streamsLabel: null, savedLabel: 'Empty', isEmpty: true };
    }
    return {
        rowsLabel: `${preset.rowCount} Row${preset.rowCount === 1 ? '' : 's'}`,
        streamsLabel: `${preset.streamCount} Stream${preset.streamCount === 1 ? '' : 's'}`,
        savedLabel: preset.savedAt ? `Saved ${formatRelativeTime(preset.savedAt)}` : 'Not saved yet',
        isEmpty: false,
    };
}

/** "just now" / "5 minutes ago" / "yesterday" / "3 days ago" / a plain date beyond that. */
export function formatRelativeTime(isoString) {
    if (!isoString) return 'never';
    const then = new Date(isoString).getTime();
    const now  = Date.now();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr  = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1)  return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    if (diffHr < 24)  return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7)  return `${diffDay} days ago`;
    return new Date(isoString).toLocaleDateString();
}

/**
 * Build a fully-formed preset object from raw workspace data (whatever
 * index.html or index3.html currently has loaded), computing the derived
 * fields (rowCount/streamCount/isEmpty/savedAt) so callers never compute
 * those by hand.
 */
export function buildPresetFromWorkspace(id, name, { urls, folderMap, lockState }) {
    const safeUrls = Array.isArray(urls) ? urls : [];
    const streamCount = safeUrls.filter(Boolean).length;
    return {
        id,
        name: name || `Preset ${id}`,
        urls: safeUrls,
        folderMap: folderMap || {},
        lockState: lockState || {},
        rowCount: safeUrls.length,
        streamCount,
        isEmpty: streamCount === 0,
        savedAt: new Date().toISOString(),
    };
}

/**
 * Overwrite one preset slot (by id) with fresh workspace data, keeping every
 * other slot untouched, and update in-memory state. Does NOT push to GitHub —
 * call savePresetsToRemote() after, so callers can batch a UI update with the
 * actual sync separately if needed.
 */
export function updatePresetInMemory(id, workspaceData) {
    const presets = getPresets();
    const existing = presets.find((p) => p.id === id);
    const updated = buildPresetFromWorkspace(id, existing?.name, workspaceData);
    const next = presets.map((p) => (p.id === id ? updated : p));
    setPresetsStructure(next);
    return updated;
}

/** Load presets.json quietly on boot. Falls back to defaults if it doesn't exist yet. */
export async function loadPresetsSilently() {
    const ok = await fetchPresetsSilently();
    if (!ok && !getPresetsStructure()) {
        setPresetsStructure(createDefaultPresetsArray());
    }
    return getPresets();
}

/** Load presets.json with alert feedback (e.g. a manual "refresh presets" action). */
export async function loadPresetsWithUI() {
    const ok = await fetchPresetsWithUI();
    if (!ok && !getPresetsStructure()) {
        setPresetsStructure(createDefaultPresetsArray());
    }
    return getPresets();
}

/**
 * Push whatever's currently in presetsStructure to GitHub. Callers should
 * have already called updatePresetInMemory() (or otherwise mutated presets
 * state) before calling this.
 */
export async function savePresetsToRemote(commitMessage, silent = true) {
    return pushPresetsToRemote(commitMessage, silent);
}

/**
 * Convenience: update one preset in memory AND push it, in one call — this
 * is what "💾 Save Session As... → Preset N" will call in Phase 4.
 */
export async function saveWorkspaceToPreset(id, workspaceData) {
    const updated = updatePresetInMemory(id, workspaceData);
    const ok = await savePresetsToRemote(`Saved workspace to ${updated.name}`, true);
    return { updated, synced: ok };
}
