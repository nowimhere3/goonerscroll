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
 * Schema (one entry in the presets.json array) — Phase 4A: migrated from a
 * plain URL-string array to a Panel-array. A URL is just one Panel type
 * now, alongside Workspace (a nested Layer 2 session reference) and future
 * types. See panels.js for the Panel shape itself.
 *   {
 *     id:           number   — stable identity, independent of display order
 *     name:         string   — "Preset 1" by default; user-renamable later
 *     panels:       Panel[]  — see panels.js — replaces the old urls: string[]
 *     folderMap:    object   — same shape as getUrlFolderMap()
 *     lockState:    object   — same shape as getRowLockState()
 *     rowCount:     number   — panels.length, stored directly for fast UI reads
 *     streamCount:  number   — count of non-empty panels, ditto
 *     isEmpty:      boolean  — true when there's nothing meaningful saved yet
 *     savedAt:      string | null — ISO timestamp of the last save, or null
 *   }
 *
 * Backward compatibility: any preset saved before Phase 4A has `urls:
 * string[]` instead of `panels: Panel[]`. getPresetPanels() is the one
 * function that should be used to read a preset's panels — it transparently
 * upconverts legacy `urls` data via panels.js's normalization, so nothing
 * needs an explicit one-time migration step. Every NEW save writes `panels`
 * going forward.
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
import { normalizePanelsArray, isEmptyPanel } from './panels.js';

export const DEFAULT_PRESET_COUNT = 5;

/** A fresh, never-saved preset slot. */
export function createEmptyPreset(id) {
    return {
        id,
        name: `Preset ${id}`,
        panels: [],
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
 * Read a preset's panels, transparently upconverting legacy `urls: string[]`
 * data (anything saved before Phase 4A) into proper Panel objects. This is
 * the ONE function that should be used to read a preset's content — never
 * read `preset.panels` or `preset.urls` directly elsewhere.
 */
export function getPresetPanels(preset) {
    if (!preset) return [];
    if (Array.isArray(preset.panels)) return normalizePanelsArray(preset.panels);
    if (Array.isArray(preset.urls)) return normalizePanelsArray(preset.urls); // legacy fallback
    return [];
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
 *
 * @param {object} workspaceData
 * @param {Array}  workspaceData.panels — Panel[] (or legacy string[]; either
 *                  is normalized here, so callers that still only have plain
 *                  URL strings on hand don't need to convert first)
 */
export function buildPresetFromWorkspace(id, name, { panels, folderMap, lockState }) {
    const safePanels = normalizePanelsArray(panels);
    const streamCount = safePanels.filter((p) => !isEmptyPanel(p)).length;
    return {
        id,
        name: name || `Preset ${id}`,
        panels: safePanels,
        folderMap: folderMap || {},
        lockState: lockState || {},
        rowCount: safePanels.length,
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
