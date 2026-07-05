/**
 * state.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for ALL runtime state.
 *
 * Why this exists:
 *   Previously, ~15 `let` variables were declared at the top of a 2300-line
 *   script block. Any function anywhere could mutate them, making it hard to
 *   track what changed what and when. This module:
 *
 *   1. Groups all runtime variables into one named object (AppState).
 *   2. Exposes typed getters/setters so mutations are explicit and traceable.
 *   3. Separates concerns — scroll state, grid state, database state, and
 *      UI mode flags are clearly grouped.
 *   4. Makes future modules (sync.js, launch.js, etc.) able to import only
 *      the state slices they need, rather than relying on globals.
 *
 * What lives here:
 *   - Scroll engine vars   (isScrolling, scrollSpeed, animationFrameId, accurateYPosition)
 *   - Grid/slot vars       (targetUrls, urlFolderMap, rowLockState, isCuratedMode, activeDragIdx)
 *   - Database vars        (databaseStructure, databaseSha)
 *   - Bookmark modal vars  (bookmarkTargetUrl, bookmarkStarBtn)
 *
 * What does NOT live here:
 *   - Persisted values  → storage.js (localStorage)
 *   - DOM element refs  → stay in index.html (tied to DOM lifecycle)
 *   - GitHub API calls  → will move to sync.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Store } from './storage.js';

// ── Internal state object ────────────────────────────────────────────────────
const _state = {

    // ── Scroll engine ──────────────────────────────────────────────────────
    animationFrameId: null,
    isScrolling:      false,
    scrollSpeed:      Store.get('scrollSpeed'),   // loaded from storage at boot
    accurateYPosition: 0,

    // ── Grid / URL slots ───────────────────────────────────────────────────
    targetUrls:    [],        // ordered array of URLs currently in the grid
    urlFolderMap:  {},        // { slotIndex: folderName } — which folder each slot came from
    rowLockState:  {},        // { slotIndex: 0|1|2 } — 0=unlocked, 1=URL lock, 2=folder lock
    isCuratedMode: false,     // when true, each slot shows a folder picker dropdown
    activeDragIdx: -1,        // index of the row currently being dragged (-1 = none)

    // ── Database (GitHub) ──────────────────────────────────────────────────
    databaseStructure: null,  // { folderName: [url, url, ...] } — full links.json content
    databaseSha:       null,  // current SHA of links.json — required for GitHub PUT updates

    // ── Bookmark modal ─────────────────────────────────────────────────────
    bookmarkTargetUrl: null,  // URL currently being saved to a playlist
    bookmarkStarBtn:   null,  // DOM reference to the ☆ button that triggered the modal

    // ── Single mode ────────────────────────────────────────────────────────
    singleModeUrl:     null,  // currently loaded URL in single mode
    singleModeFolder:  null,  // current folder being used in single mode
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * State.get(key)
 * Read any state value by name.
 */
export function get(key) {
    if (!(key in _state)) {
        console.warn(`[State] Unknown key: "${key}"`);
        return undefined;
    }
    return _state[key];
}

/**
 * State.set(key, value)
 * Write a state value. For objects/arrays, replaces the reference entirely.
 * For partial object mutations (e.g. urlFolderMap[i] = x), use State.get()
 * then mutate in place — the reference is shared.
 */
export function set(key, value) {
    if (!(key in _state)) {
        console.warn(`[State] Unknown key: "${key}"`);
        return;
    }
    _state[key] = value;
}

/**
 * State.patch(key, partialObj)
 * Shallow-merge into an object state value.
 * Useful for updating a single slot in urlFolderMap or rowLockState
 * without replacing the whole object.
 *
 * Example:
 *   State.patch('urlFolderMap', { 2: 'My_Playlist' });
 */
export function patch(key, partialObj) {
    if (!(key in _state) || typeof _state[key] !== 'object' || Array.isArray(_state[key])) {
        console.warn(`[State] patch() requires an object value for key: "${key}"`);
        return;
    }
    Object.assign(_state[key], partialObj);
}

/**
 * State.reset(key)
 * Reset a single key to its initial value.
 */
export function reset(key) {
    const initial = _initialValues[key];
    if (initial === undefined) {
        console.warn(`[State] No initial value registered for: "${key}"`);
        return;
    }
    _state[key] = typeof initial === 'object' && initial !== null
        ? Array.isArray(initial) ? [] : {}
        : initial;
}

/**
 * State.dump()
 * Debug helper — logs full state to console.
 */
export function dump() {
    console.group('[State] Current runtime state');
    Object.entries(_state).forEach(([k, v]) => console.log(k, '→', v));
    console.groupEnd();
}

// ── Initial values for reset() ────────────────────────────────────────────────
const _initialValues = {
    animationFrameId:  null,
    isScrolling:       false,
    scrollSpeed:       1.00,
    accurateYPosition: 0,
    targetUrls:        [],
    urlFolderMap:      {},
    rowLockState:      {},
    isCuratedMode:     false,
    activeDragIdx:     -1,
    databaseStructure: null,
    databaseSha:       null,
    bookmarkTargetUrl: null,
    bookmarkStarBtn:   null,
    singleModeUrl:     null,
    singleModeFolder:  null,
};

// ── Named convenience exports ─────────────────────────────────────────────────
// These let consuming modules import just what they need:
//   import { State, getScrollSpeed, setScrollSpeed } from './js/state.js';
//
// Keeping both the generic get/set AND named exports means call sites can
// choose whatever reads more clearly for their context.

export const State = { get, set, patch, reset, dump };

// Scroll
export const getScrollSpeed       = () => _state.scrollSpeed;
export const setScrollSpeed       = (v) => { _state.scrollSpeed = v; };
export const getIsScrolling       = () => _state.isScrolling;
export const setIsScrolling       = (v) => { _state.isScrolling = v; };
export const getAnimationFrameId  = () => _state.animationFrameId;
export const setAnimationFrameId  = (v) => { _state.animationFrameId = v; };
export const getAccurateYPosition = () => _state.accurateYPosition;
export const setAccurateYPosition = (v) => { _state.accurateYPosition = v; };

// Grid
export const getTargetUrls    = () => _state.targetUrls;
export const setTargetUrls    = (v) => { _state.targetUrls = v; };
export const getUrlFolderMap  = () => _state.urlFolderMap;
export const setUrlFolderMap  = (v) => { _state.urlFolderMap = v; };
export const getRowLockState  = () => _state.rowLockState;
export const setRowLockState  = (v) => { _state.rowLockState = v; };
export const getIsCuratedMode = () => _state.isCuratedMode;
export const setIsCuratedMode = (v) => { _state.isCuratedMode = v; };
export const getActiveDragIdx = () => _state.activeDragIdx;
export const setActiveDragIdx = (v) => { _state.activeDragIdx = v; };

// Database
export const getDatabaseStructure = () => _state.databaseStructure;
export const setDatabaseStructure = (v) => { _state.databaseStructure = v; };
export const getDatabaseSha       = () => _state.databaseSha;
export const setDatabaseSha       = (v) => { _state.databaseSha = v; };

// Bookmark modal
export const getBookmarkTargetUrl = () => _state.bookmarkTargetUrl;
export const setBookmarkTargetUrl = (v) => { _state.bookmarkTargetUrl = v; };
export const getBookmarkStarBtn   = () => _state.bookmarkStarBtn;
export const setBookmarkStarBtn   = (v) => { _state.bookmarkStarBtn = v; };

// Single mode
export const getSingleModeUrl    = () => _state.singleModeUrl;
export const setSingleModeUrl    = (v) => { _state.singleModeUrl = v; };
export const getSingleModeFolder = () => _state.singleModeFolder;
export const setSingleModeFolder = (v) => { _state.singleModeFolder = v; };
