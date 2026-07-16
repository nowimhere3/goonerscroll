/**
 * sync.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * All GitHub API communication lives here.
 *
 * Exports:
 *   pushDatabaseToRemote(commitMessage)  — PUT links.json to GitHub
 *   fetchDatabaseSilently()              — GET links.json quietly on load
 *   fetchDatabaseWithUI()               — GET links.json with alert feedback
 *   reorderDatabase(listEl, updateDropdownFn) — reorder keys then push
 *
 * Dependencies:
 *   Store          → reads gitToken, gitRepo
 *   getDatabaseStructure / setDatabaseStructure
 *   getDatabaseSha / setDatabaseSha
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Store } from './storage.js';
import {
    getDatabaseStructure, setDatabaseStructure,
    getDatabaseSha, setDatabaseSha,
} from './state.js';

const LINKS_FILE = 'links.json';

/** Encode the current databaseStructure to base64 for GitHub API */
function _encodeDatabase(structure) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(structure, null, 2))));
}

/** Decode base64 content from GitHub API response */
function _decodeDatabase(base64Content) {
    return JSON.parse(decodeURIComponent(escape(atob(base64Content))));
}

/** Build the GitHub API URL for links.json */
function _apiUrl() {
    const repo = Store.get('gitRepo');
    return `https://api.github.com/repos/${repo}/contents/${LINKS_FILE}`;
}

/** Build auth headers */
function _headers() {
    return {
        'Authorization': `token ${Store.get('gitToken')}`,
        'Content-Type': 'application/json',
    };
}

/**
 * Push the current databaseStructure to GitHub.
 * Alerts on success or failure.
 * @param {string} commitMessage
 * @param {boolean} [silent=false] — if true, suppresses the success alert
 */
export async function pushDatabaseToRemote(commitMessage, silent = false) {
    const token = Store.get('gitToken');
    const repo  = Store.get('gitRepo');
    const db    = getDatabaseStructure();

    if (!token || !repo || !db) return;

    const updatedContent = _encodeDatabase(db);

    try {
        const res = await fetch(_apiUrl(), {
            method: 'PUT',
            headers: _headers(),
            body: JSON.stringify({
                message: commitMessage,
                content: updatedContent,
                sha: getDatabaseSha(),
            }),
        });

        if (res.ok) {
            const resData = await res.json();
            setDatabaseSha(resData.content.sha);
            if (!silent) alert('Cloud Repository synchronized successfully! Links integrated.');
        } else {
            throw new Error('Push rejected. Double-check branch states or credential authorizations.');
        }
    } catch (err) {
        alert('Cloud Synchronization failed: ' + err.message);
    }
}

/**
 * Silently fetch links.json on page load.
 * No alerts — fails quietly if credentials missing or network unavailable.
 * Calls updateDropdownFn() if provided after loading.
 * @param {Function} [updateDropdownFn]
 */
export async function fetchDatabaseSilently(updateDropdownFn) {
    const token = Store.get('gitToken');
    const repo  = Store.get('gitRepo');
    if (!token || !repo) return false;

    try {
        const res = await fetch(_apiUrl(), { headers: _headers(), cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            setDatabaseSha(data.sha);
            setDatabaseStructure(_decodeDatabase(data.content));
            if (typeof updateDropdownFn === 'function') updateDropdownFn();
            return true;
        }
    } catch (e) { /* silent */ }

    return false;
}

/**
 * Fetch links.json with full UI feedback (used by Connect button).
 * Calls updateDropdownFn() on success.
 * @param {Function} updateDropdownFn
 * @returns {boolean} true on success
 */
export async function fetchDatabaseWithUI(updateDropdownFn) {
    const token = Store.get('gitToken');
    const repo  = Store.get('gitRepo');

    if (!token || !repo) {
        alert('Please populate both Token and Repository target strings.');
        return false;
    }

    try {
        const res = await fetch(_apiUrl(), { headers: _headers(), cache: 'no-store' });
        if (!res.ok) throw new Error('Could not find or access links.json in root repository area.');

        const data = await res.json();
        setDatabaseSha(data.sha);
        setDatabaseStructure(_decodeDatabase(data.content));
        if (typeof updateDropdownFn === 'function') updateDropdownFn();
        alert('Database synchronized successfully! Directory pools populated.');
        return true;
    } catch (err) {
        alert('Sync Error: ' + err.message);
        return false;
    }
}

/**
 * Reorder folder keys in databaseStructure to match current DOM order,
 * then push to GitHub.
 * @param {HTMLElement} listEl — the folder-manager-list DOM element
 * @param {Function} updateDropdownFn
 */
export async function reorderDatabase(listEl, updateDropdownFn) {
    const db = getDatabaseStructure();
    if (!listEl || !db) return;

    const newOrder = [...listEl.querySelectorAll('.folder-manager-row')].map(r => r.dataset.folder);
    const reordered = {};
    newOrder.forEach(key => { if (db[key] !== undefined) reordered[key] = db[key]; });
    setDatabaseStructure(reordered);

    if (typeof updateDropdownFn === 'function') updateDropdownFn();
    await pushDatabaseToRemote('Reordered folders via drag-and-drop', true);
}
