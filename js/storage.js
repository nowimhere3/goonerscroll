/**
 * storage.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for ALL localStorage interaction.
 *
 * Why this exists:
 *   - Raw localStorage.getItem() calls scattered through code are slow when
 *     hit inside animation loops (scroll, IntersectionObserver callbacks).
 *   - Magic key strings spread across 2000+ lines make typos silently break
 *     persistence with no error thrown.
 *   - Default values were duplicated in multiple places and sometimes differed.
 *
 * What this provides:
 *   1. KEYS   — one canonical constant per stored value. Never type a key string again.
 *   2. CACHE  — in-memory mirror so repeated reads hit RAM, not disk.
 *               Especially important for scrollSpeed which is read every animation frame.
 *   3. TYPED  — get/set wrappers handle JSON parsing, number coercion, and boolean
 *               logic in one place so call sites stay clean.
 *   4. CLEAR  — selective reset helpers for dev/debug.
 *
 * Usage:
 *   import { Store } from './js/storage.js';
 *
 *   const speed = Store.get('scrollSpeed');          // number, default 1.0
 *   Store.set('scrollSpeed', 1.5);
 *
 *   const urls  = Store.get('matrixUrls');           // array
 *   Store.set('matrixUrls', ['https://...']);
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Key Registry ────────────────────────────────────────────────────────────
// Every localStorage key used by the app lives here.
// The value on the right is the raw string stored in the browser.
export const KEYS = Object.freeze({

    // Scroll
    scrollSpeed:        'matrixScrollSpeed',

    // Grid / URL slots
    matrixUrls:         'loop_matrix_urls',
    portraitMode:       'matrixIsPortrait',
    lockState:          'matrix_lock_state',
    folderMap:          'matrix_folder_map',

    // GitHub sync
    gitToken:           'git_sync_token',
    gitRepo:            'git_sync_repo',

    // Blacklist
    blacklist:          'matrix_blacklist',

    // Frame heights
    fhLandscape:        'fh_landscape',
    fhPortrait:         'fh_portrait',

    // End spacer
    spacerEndOn:        'fh_spacer_on',
    spacerEndHeight:    'fh_spacer_height',
    spacerEndLocked:    'fh_lock_spacer_end',

    // Top spacer
    spacerTopOn:        'fh_spacer_top_on',
    spacerTopHeight:    'fh_spacer_top_height',
    spacerTopLocked:    'fh_lock_spacer_top',

    // Single mode
    singleModeUrl:      'solo_current_url',
    singleModeFolder:   'solo_current_folder',
    singleModeAutoplay: 'solo_autoplay_enabled',
});

// ── Defaults ────────────────────────────────────────────────────────────────
// One place for every default value.
// Booleans that default TRUE use !== 'false' logic; see _readRaw().
const DEFAULTS = {
    [KEYS.scrollSpeed]:     1.00,
    [KEYS.matrixUrls]:      ['', '', ''],
    [KEYS.portraitMode]:    false,
    [KEYS.lockState]:       {},
    [KEYS.folderMap]:       {},
    [KEYS.gitToken]:        '',
    [KEYS.gitRepo]:         '',
    [KEYS.blacklist]:       [],
    [KEYS.fhLandscape]:     100,
    [KEYS.fhPortrait]:      50,
    [KEYS.spacerEndOn]:     true,   // defaults ON
    [KEYS.spacerEndHeight]: 50,
    [KEYS.spacerEndLocked]: false,
    [KEYS.spacerTopOn]:     true,   // defaults ON
    [KEYS.spacerTopHeight]: 50,
    [KEYS.spacerTopLocked]: false,
    [KEYS.singleModeUrl]:   '',
    [KEYS.singleModeFolder]: '',
    [KEYS.singleModeAutoplay]: false,
};

// ── Type map ─────────────────────────────────────────────────────────────────
// Tells the module how to parse each key when reading from disk.
const TYPES = {
    [KEYS.scrollSpeed]:     'number',
    [KEYS.matrixUrls]:      'json',
    [KEYS.portraitMode]:    'boolean',
    [KEYS.lockState]:       'json',
    [KEYS.folderMap]:       'json',
    [KEYS.gitToken]:        'string',
    [KEYS.gitRepo]:         'string',
    [KEYS.blacklist]:       'json',
    [KEYS.fhLandscape]:     'number',
    [KEYS.fhPortrait]:      'number',
    [KEYS.spacerEndOn]:     'boolean_default_true',
    [KEYS.spacerEndHeight]: 'number',
    [KEYS.spacerEndLocked]: 'boolean',
    [KEYS.spacerTopOn]:     'boolean_default_true',
    [KEYS.spacerTopHeight]: 'number',
    [KEYS.spacerTopLocked]: 'boolean',
};

// ── In-memory cache ──────────────────────────────────────────────────────────
// Populated on first read, updated on every write.
// Prevents repeated disk hits inside animation/scroll loops.
const _cache = {};

function _readRaw(rawKey) {
    const type = TYPES[rawKey];
    const raw  = localStorage.getItem(rawKey);
    const def  = DEFAULTS[rawKey];

    if (raw === null) return def;

    switch (type) {
        case 'number':
            return parseFloat(raw) || def;
        case 'boolean':
            return raw === 'true';
        case 'boolean_default_true':
            // These keys default to true — only false when explicitly saved as 'false'
            return raw !== 'false';
        case 'json':
            try { return JSON.parse(raw); } catch { return def; }
        case 'string':
        default:
            return raw;
    }
}

function _serialize(rawKey, value) {
    const type = TYPES[rawKey];
    switch (type) {
        case 'json':
            return JSON.stringify(value);
        case 'boolean':
        case 'boolean_default_true':
            return String(value);
        case 'number':
            return String(value);
        default:
            return value;
    }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Store.get(keyName)
 * Read a value. Hits cache on repeat calls.
 * keyName is the friendly name from KEYS, e.g. 'scrollSpeed'.
 */
function get(keyName) {
    const rawKey = KEYS[keyName];
    if (!rawKey) {
        console.warn(`[Storage] Unknown key: "${keyName}". Check KEYS registry.`);
        return undefined;
    }
    if (_cache[rawKey] !== undefined) return _cache[rawKey];
    const value = _readRaw(rawKey);
    _cache[rawKey] = value;
    return value;
}

/**
 * Store.set(keyName, value)
 * Write a value. Updates cache immediately, writes to disk.
 */
function set(keyName, value) {
    const rawKey = KEYS[keyName];
    if (!rawKey) {
        console.warn(`[Storage] Unknown key: "${keyName}". Check KEYS registry.`);
        return;
    }
    _cache[rawKey] = value;
    localStorage.setItem(rawKey, _serialize(rawKey, value));
}

/**
 * Store.remove(keyName)
 * Delete a key from storage and cache.
 */
function remove(keyName) {
    const rawKey = KEYS[keyName];
    if (!rawKey) return;
    delete _cache[rawKey];
    localStorage.removeItem(rawKey);
}

/**
 * Store.warmCache()
 * Pre-load all known keys into the in-memory cache at startup.
 * Call once on page load so the scroll loop never hits disk.
 */
function warmCache() {
    Object.entries(KEYS).forEach(([friendlyName, rawKey]) => {
        if (_cache[rawKey] === undefined) {
            _cache[rawKey] = _readRaw(rawKey);
        }
    });
}

/**
 * Store.invalidate(keyName)
 * Force next get() to re-read from disk (useful after external writes).
 */
function invalidate(keyName) {
    const rawKey = KEYS[keyName];
    if (rawKey) delete _cache[rawKey];
}

/**
 * Store.dump()
 * Debug helper — logs the full cache to console.
 */
function dump() {
    console.group('[Storage] Cache dump');
    Object.entries(_cache).forEach(([k, v]) => console.log(k, '→', v));
    console.groupEnd();
}

export const Store = { get, set, remove, warmCache, invalidate, dump, KEYS };
