/**
 * grid-session.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 4B — Grid Working-Copy Architecture.
 *
 * Owns index3.html's isolated, in-memory working copy of whichever workspace
 * it was launched from. This is the module that makes "launching a preset
 * never modifies the original" actually true:
 *
 *   - Nothing here ever writes to Store's shared matrixUrls/folderMap/
 *     lockState keys — those are index.html's editing surface, and touching
 *     them from here would leak Grid-session changes back into whatever
 *     workspace happens to be active there (which is exactly the bug this
 *     phase fixes — Grid used to write straight into Store('matrixUrls') on
 *     every render).
 *   - Nothing here ever writes to presets.json either. The ONLY way a Grid
 *     session's changes reach a saved preset is Phase 4C's explicit
 *     "💾 Save Session As...", which reads getSessionPanels()/
 *     getSessionFolderMap() and hands them to presets.js directly.
 *   - Refreshing the tab (or closing it without saving) simply loses
 *     whatever's in memory here — that's intentional, matching the same
 *     "session-only, resets on reload" precedent already established for
 *     border-drag sizing and 🖥 position swaps.
 *
 * Source workspace detection: index.html's "🧩 Launch Grid" button encodes
 * exactly which workspace was active AT CLICK TIME into the URL
 * (?workspace=<id>), so this module never needs to guess or re-read Store at
 * its own boot — avoiding a race if e.g. multiple tabs are open. Falls back
 * to 'live' if the param is missing (an old bookmark, or index3.html visited
 * directly), so nothing breaks for existing links.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Store } from './storage.js';
import { getPresetById, getPresetPanels } from './presets.js';
import { getUrlPanelSource, normalizePanelsArray } from './panels.js';
import { createUndoStack } from './undo-stack.js';

let _sourceType = 'live'; // 'live' | 'preset'
let _sourceId = null;     // null for live, numeric preset id otherwise
let _panels = [];
let _folderMap = {};
const _undoStack = createUndoStack(50);

function _readSourceWorkspaceIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('workspace') || 'live';
}

/**
 * Load the working copy from whichever workspace the URL says this session
 * was launched from. Call this once at boot, before the first render.
 * @returns {{ urls: string[], folderMap: object }}
 */
export function initGridSession() {
    const workspaceId = _readSourceWorkspaceIdFromUrl();

    if (workspaceId === 'live') {
        _sourceType = 'live';
        _sourceId = null;
        // Live Builder has no separate saved copy — its "template" IS
        // whatever's currently in the shared Store surface. We still only
        // ever READ it once here, at boot; nothing in this module writes
        // back to it afterward.
        _panels = normalizePanelsArray(Store.get('matrixUrls'));
        _folderMap = { ...(Store.get('folderMap') || {}) };
    } else {
        _sourceType = 'preset';
        _sourceId = Number(workspaceId);
        const preset = getPresetById(_sourceId);
        _panels = getPresetPanels(preset); // transparently upconverts legacy `urls` data
        _folderMap = { ...(preset?.folderMap || {}) };
    }

    _undoStack.clear();

    return { urls: _panels.map(getUrlPanelSource), folderMap: { ..._folderMap } };
}

/**
 * What this session is a working copy of. This is exactly the context
 * Phase 4C's "💾 Save Session As..." dropup needs to default/highlight
 * against ("you launched this from Preset 2").
 */
export function getSourceWorkspaceInfo() {
    return { type: _sourceType, id: _sourceId };
}

export function getSessionUrls() {
    return _panels.map(getUrlPanelSource);
}

export function getSessionFolderMap() {
    return { ..._folderMap };
}

/**
 * Update the working copy. Every action that changes what's in the Grid
 * (Shuffle, Shuffle All, folder reassignment, position swap) should route
 * through this — it's the one funnel that keeps an undo point, mirroring how
 * grid.js's _persistAndNotify() is the single funnel on index.html. Never
 * writes to Store or presets.json — purely in-memory.
 */
export function updateGridSession(urls, folderMap) {
    _undoStack.push({
        panels: _panels.map((p) => ({ ...p })),
        folderMap: { ..._folderMap },
    });
    _panels = normalizePanelsArray(urls);
    _folderMap = { ...(folderMap || {}) };
}

/**
 * Same as updateGridSession() but doesn't push an undo point — for the very
 * first (boot) render only, where _buildTripleSet() fills in empty slots
 * with fresh random picks, so what's actually displayed can differ slightly
 * from what initGridSession() originally loaded. The session needs to track
 * what's really on screen, but there's nothing meaningful to undo back to
 * before the page has even finished its first render.
 */
export function setGridSessionSilently(urls, folderMap) {
    _panels = normalizePanelsArray(urls);
    _folderMap = { ...(folderMap || {}) };
}

export function canUndoGridSession() {
    return _undoStack.canPop();
}

/** Restore the previous in-session state. Returns null if there's nothing to undo. */
export function undoGridSession() {
    const snapshot = _undoStack.pop();
    if (!snapshot) return null;

    _panels = snapshot.panels;
    _folderMap = snapshot.folderMap;

    return { urls: _panels.map(getUrlPanelSource), folderMap: { ..._folderMap } };
}
