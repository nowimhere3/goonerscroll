/**
 * workspace.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for "which workspace is currently being edited."
 *
 * Nothing else in the app should independently decide what the active
 * workspace is, or whether an edit should sync to GitHub. Every other module
 * routes through here:
 *
 *   grid.js         → calls notifyWorkspaceEdited() on every local auto-save
 *   app.js           → calls switchWorkspace() when a tab is clicked, and
 *                       reads getActiveWorkspaceId() to render the tab bar
 *   presets.js       → owns preset DATA (schema, summaries, CRUD) but has no
 *                       opinion on what's "active" — that's entirely this
 *                       module's job
 *
 * Mental model (this is the one that matters — see it through the user's
 * eyes, not the data structures):
 *   - Live Builder and every Preset share ONE live editing surface — the same
 *     matrixUrls/folderMap/lockState Store keys the grid has always read from.
 *   - Switching workspaces copies the target workspace's data INTO that
 *     shared surface. Nothing about the grid's own code needs to know which
 *     workspace is active — it always just reads/writes the same keys it
 *     always has.
 *   - What's DIFFERENT per workspace is where an edit also gets mirrored to:
 *       Live Builder → nowhere else (local Store write is already "saved",
 *                       exactly like every version of this app before today)
 *       A Preset     → also mirrored into that preset's slot in presets.json
 *                       and pushed to GitHub, debounced so rapid edits
 *                       collapse into one push instead of one per keystroke
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Store } from './storage.js';
import { setTargetUrls, setUrlFolderMap, setRowLockState } from './state.js';
import { getPresetById, saveWorkspaceToPreset } from './presets.js';

const GITHUB_SYNC_DEBOUNCE_MS = 1500;
let _debounceTimer = null;

/** 'live' or a preset id, as a string (Store persists strings). */
export function getActiveWorkspaceId() {
    return Store.get('activeWorkspaceId') || 'live';
}

export function isLiveBuilder(id = getActiveWorkspaceId()) {
    return id === 'live';
}

/** Numeric preset id if a preset is active, or null if Live Builder is active. */
export function getActivePresetId() {
    const id = getActiveWorkspaceId();
    return isLiveBuilder(id) ? null : Number(id);
}

export function getActiveWorkspaceType() {
    return isLiveBuilder() ? 'live' : 'preset';
}

/**
 * Switch the editing context to a different workspace. This is the ONLY
 * function that should ever be called from the Workspace Tabs UI — it's
 * pure navigation from the tab bar's point of view, even though it does the
 * data-loading work of copying the target workspace into the shared surface.
 *
 * @param {string|number} workspaceId — 'live', or a preset id
 * @returns {{urls: string[], folderMap: object, lockState: object}} what was loaded
 */
export function switchWorkspace(workspaceId) {
    const id = String(workspaceId);
    let urls = [];
    let folderMap = {};
    let lockState = {};

    if (isLiveBuilder(id)) {
        // Live Builder's data already lives directly in the shared Store keys
        // (that's what makes it behave "exactly like today") — nothing to copy.
        urls      = Store.get('matrixUrls') || [];
        folderMap = Store.get('folderMap')  || {};
        lockState = Store.get('lockState')  || {};
    } else {
        const preset = getPresetById(Number(id));
        urls      = preset?.urls      || [];
        folderMap = preset?.folderMap || {};
        lockState = preset?.lockState || {};

        // Copy the preset's data into the shared editing surface so every
        // existing grid code path (which only ever reads matrixUrls/
        // folderMap/lockState) just works without needing to know a preset
        // is active at all.
        Store.set('matrixUrls', urls);
        Store.set('folderMap', folderMap);
        Store.set('lockState', lockState);
    }

    setTargetUrls(urls);
    setUrlFolderMap(folderMap);
    setRowLockState(lockState);
    Store.set('activeWorkspaceId', id);

    return { urls, folderMap, lockState };
}

/**
 * Call this after every local auto-save (grid.js's saveInputsToState, right
 * after its own Store.set calls). Local persistence has already happened by
 * the time this runs either way — this only decides whether to ALSO mirror
 * the edit into a preset + GitHub, debounced.
 */
export function notifyWorkspaceEdited(urls, folderMap, lockState) {
    if (isLiveBuilder()) return; // nothing further to do — already fully saved locally

    const presetId = getActivePresetId();
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
        _debounceTimer = null;
        saveWorkspaceToPreset(presetId, { urls, folderMap, lockState });
    }, GITHUB_SYNC_DEBOUNCE_MS);
}
