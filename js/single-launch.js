/**
 * single-launch.js — Single Mode Stream Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the single iframe and URL loading logic for solo mode (index2.html).
 *
 * Exports:
 *   launchSingleMode(url, folder, ctx)  — Initialize single iframe with a URL
 *   getCurrentUrl()                      — Get currently loaded URL
 *   loadRandom(folderName)               — Load random URL from folder (shuffle)
 *   loadRandomFromAll()                  — Load random URL from any folder
 *   purgeAndLoadNext()                   — Remove current and load new from same folder
 *   deleteAndReplace(newFolder)          — Remove from old folder, load from new
 *
 * The `ctx` object expected by launchSingleMode:
 *   {
 *     iframeEl,                   // <iframe> element
 *     statusEl,                   // status message element
 *     btnFavorite,                // favorite button
 *     btnPurge,                   // purge button
 *     btnDeleteReplace,           // delete & replace button
 *     btnShuffle,                 // shuffle button
 *     btnShuffleAll,              // shuffle all button
 *     openBookmarkModal,          // (url) => void
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Store } from './storage.js';
import {
    getDatabaseStructure, setDatabaseStructure, getDatabaseSha, setSingleModeUrl, setSingleModeFolder,
} from './state.js';
import { isBlacklisted, addToBlacklist } from './blacklist.js';
import { pushDatabaseToRemote } from './sync.js';

// ── Module state ──────────────────────────────────────────────────────────────
let _currentUrl    = '';
let _currentFolder = null;
let _iframeEl      = null;
let _statusEl      = null;

/**
 * Initialize and launch the single iframe with a starting URL and folder.
 *
 * @param {string} url       — starting URL to load
 * @param {string} folder    — which folder this URL came from (for context)
 * @param {Object} ctx       — UI element references and callbacks
 */
export function launchSingleMode(url, folder, ctx) {
    _currentUrl    = url || '';
    _currentFolder = folder || null;
    _iframeEl      = ctx.iframeEl;
    _statusEl      = ctx.statusEl;

    // Persist to state
    setSingleModeUrl(_currentUrl);
    setSingleModeFolder(_currentFolder);
    Store.set('singleModeUrl', _currentUrl);
    Store.set('singleModeFolder', _currentFolder);

    // Load iframe
    // Note: Setting iframe.src with URLs from database is safe. URLs are trusted
    // data from GitHub (user-controlled but persisted in database). iframe.src
    // is designed for URL assignment and handles URLs safely without HTML parsing.
    if (_iframeEl) {
        _iframeEl.src = _currentUrl;
        _updateStatus();
    }

    // Wire up button handlers
    if (ctx.btnFavorite) {
        ctx.btnFavorite.onclick = () => {
            ctx.openBookmarkModal(_currentUrl);
        };
    }

    if (ctx.btnPurge) {
        ctx.btnPurge.onclick = () => purgeAndLoadNext();
    }

    if (ctx.btnDeleteReplace) {
        ctx.btnDeleteReplace.onclick = () => {
            ctx.openDeleteReplaceModal();
        };
    }

    if (ctx.btnShuffle) {
        ctx.btnShuffle.onclick = () => {
            if (_currentFolder) loadRandom(_currentFolder);
        };
    }

    if (ctx.btnShuffleAll) {
        ctx.btnShuffleAll.onclick = () => loadRandomFromAll();
    }
}

/**
 * Get the currently loaded URL.
 */
export function getCurrentUrl() {
    return _currentUrl;
}

/**
 * Get the currently active folder.
 */
export function getCurrentFolder() {
    return _currentFolder;
}

/**
 * Load a random URL from the specified folder.
 * Skips blacklisted URLs.
 *
 * @param {string} folderName
 */
export function loadRandom(folderName) {
    const db = getDatabaseStructure();
    if (!db || !db[folderName]) {
        alert(`Folder "${folderName}" not found or is empty.`);
        return;
    }

    const pool = db[folderName].filter(u => !isBlacklisted(u));
    if (pool.length === 0) {
        alert(`No valid URLs left in "${folderName}" (all are blacklisted).`);
        return;
    }

    const newUrl = pool[Math.floor(Math.random() * pool.length)];
    _setUrl(newUrl, folderName);
}

/**
 * Load a random URL from any folder.
 */
export function loadRandomFromAll() {
    const db = getDatabaseStructure();
    if (!db || Object.keys(db).length === 0) {
        alert('No folders available in database.');
        return;
    }

    // Collect all non-blacklisted URLs from all folders
    const allUrls = [];
    const folderMap = {};

    Object.entries(db).forEach(([folderName, urls]) => {
        urls.forEach(url => {
            if (!isBlacklisted(url)) {
                allUrls.push(url);
                folderMap[url] = folderName;
            }
        });
    });

    if (allUrls.length === 0) {
        alert('No valid URLs left in any folder (all are blacklisted).');
        return;
    }

    const newUrl = allUrls[Math.floor(Math.random() * allUrls.length)];
    const newFolder = folderMap[newUrl];
    _setUrl(newUrl, newFolder);
}

/**
 * Remove the current URL from its folder and load a random one from the same folder.
 */
export function purgeAndLoadNext() {
    const db = getDatabaseStructure();
    if (!_currentFolder || !db || !db[_currentFolder]) {
        alert('Cannot purge: folder not found.');
        return;
    }

    // Remove current URL from folder
    const folderUrls = db[_currentFolder];
    const idx = folderUrls.indexOf(_currentUrl);
    if (idx > -1) {
        folderUrls.splice(idx, 1);
    }

    // Add to blacklist to prevent reappearing
    addToBlacklist(_currentUrl);

    // Persist
    setDatabaseStructure(db);
    pushDatabaseToRemote();

    // Load next
    loadRandom(_currentFolder);
}

/**
 * Remove current URL from current folder and load from a new folder.
 *
 * @param {string} newFolder
 */
export function deleteAndReplace(newFolder) {
    const db = getDatabaseStructure();
    if (!db) {
        alert('Database not loaded.');
        return;
    }

    // Remove from old folder if exists
    if (_currentFolder && db[_currentFolder]) {
        const idx = db[_currentFolder].indexOf(_currentUrl);
        if (idx > -1) {
            db[_currentFolder].splice(idx, 1);
        }
        addToBlacklist(_currentUrl);
    }

    // Persist
    setDatabaseStructure(db);
    pushDatabaseToRemote();

    // Load from new folder
    loadRandom(newFolder);
}

/**
 * Set a new URL and persist.
 *
 * @private
 * @param {string} url
 * @param {string} folder
 */
function _setUrl(url, folder) {
    _currentUrl    = url;
    _currentFolder = folder;

    // Persist to state and storage
    setSingleModeUrl(_currentUrl);
    setSingleModeFolder(_currentFolder);
    Store.set('singleModeUrl', _currentUrl);
    Store.set('singleModeFolder', _currentFolder);

    // Load iframe
    // Note: Setting iframe.src with URLs from database is safe. URLs are trusted
    // data from GitHub (user-controlled but persisted in database). iframe.src
    // is designed for URL assignment and handles URLs safely without HTML parsing.
    if (_iframeEl) {
        _iframeEl.src = url;
    }

    _updateStatus();
}

/**
 * Update status message.
 *
 * @private
 */
function _updateStatus() {
    if (!_statusEl) return;

    const folder = _currentFolder ? `${_currentFolder} • ` : 'No folder • ';
    const url = _currentUrl ? _currentUrl.substring(0, 40) + (_currentUrl.length > 40 ? '...' : '') : 'No URL';

    _statusEl.textContent = `${folder}${url}`;
}
