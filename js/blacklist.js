/**
 * blacklist.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * All domain blacklist logic lives here.
 *
 * Exports:
 *   initBlacklist()            — loads from storage, exposes removeFromBlacklist globally
 *   isBlacklisted(url)         — pure check, returns boolean
 *   addToBlacklist(url)        — extracts hostname, persists, re-renders
 *   removeFromBlacklist(domain)— removes entry, persists, re-renders
 *   renderBlacklistDisplay()   — refreshes the #blacklist-display DOM element
 *
 * Storage:
 *   Reads/writes via Store('blacklist') — a string[] of hostnames.
 *
 * Why hostname-based (not full URL):
 *   If one page on a domain is dead, the whole domain is usually unreachable.
 *   Blocking by hostname catches all paths on that domain automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Store } from './storage.js';

// ── Internal state ────────────────────────────────────────────────────────────
// Kept module-local — only mutated through the exported functions below.
let _blacklist = [];

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Load persisted blacklist from storage and expose removeFromBlacklist
 * globally so inline onclick handlers in the rendered HTML can call it.
 * Call once at app startup.
 */
export function initBlacklist() {
    _blacklist = Store.get('blacklist') || [];
    // Inline onclick in renderBlacklistDisplay uses this global
    window.removeFromBlacklist = removeFromBlacklist;
}

// ── Core logic ────────────────────────────────────────────────────────────────

/**
 * Check if a URL's hostname matches any blacklisted domain.
 * Safe to call with malformed URLs — returns false on parse error.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isBlacklisted(url) {
    try {
        const hostname = new URL(url).hostname;
        return _blacklist.some(
            domain => hostname === domain || hostname.endsWith('.' + domain)
        );
    } catch (e) {
        return false;
    }
}

/**
 * Extract the hostname from a URL and add it to the blacklist.
 * No-ops if already present. Persists to storage and re-renders the display.
 *
 * @param {string} url — full URL (hostname is extracted automatically)
 */
export function addToBlacklist(url) {
    try {
        const domain = new URL(url).hostname;
        if (!domain) return;
        if (_blacklist.includes(domain)) return;
        _blacklist.push(domain);
        Store.set('blacklist', _blacklist);
        renderBlacklistDisplay();
    } catch (e) {
        console.error('[Blacklist] Invalid URL:', e);
    }
}

/**
 * Remove a domain from the blacklist by exact hostname string.
 * Persists to storage and re-renders the display.
 *
 * @param {string} domain — bare hostname, e.g. "deadsite.com"
 */
export function removeFromBlacklist(domain) {
    _blacklist = _blacklist.filter(d => d !== domain);
    Store.set('blacklist', _blacklist);
    renderBlacklistDisplay();
}

/**
 * Return a copy of the current blacklist array.
 * Use this for read-only inspection — do not mutate the result.
 *
 * @returns {string[]}
 */
export function getBlacklist() {
    return [..._blacklist];
}

/**
 * Clear the entire blacklist. Persists to storage and re-renders.
 */
export function clearBlacklist() {
    _blacklist = [];
    Store.set('blacklist', _blacklist);
    renderBlacklistDisplay();
}

// ── UI ────────────────────────────────────────────────────────────────────────

/**
 * Re-render the #blacklist-display element with the current blacklist.
 * Each entry gets an inline ✕ button that calls removeFromBlacklist().
 */
export function renderBlacklistDisplay() {
    const display = document.getElementById('blacklist-display');
    if (!display) return;

    if (_blacklist.length === 0) {
        display.innerHTML = '<span class="bl-empty">No domains blacklisted yet.</span>';
        return;
    }

    display.innerHTML = _blacklist.map(domain =>
        `<span class="blacklist-tag">${domain}` +
        `<button class="bl-remove-btn" onclick="removeFromBlacklist('${domain}')" title="Unblock">✕</button>` +
        `</span>`
    ).join('');
}

/**
 * Wire up the blacklist UI panel controls:
 *   - #btn-bl-add   → add domain from #blacklist-manual-input
 *   - #btn-bl-clear → confirm then clear all
 *
 * Call once after DOM is ready.
 */
export function initBlacklistUI() {
    const addBtn    = document.getElementById('btn-bl-add');
    const clearBtn  = document.getElementById('btn-bl-clear');
    const manualInput = document.getElementById('blacklist-manual-input');

    if (addBtn) {
        addBtn.onclick = () => {
            let raw = manualInput?.value.trim() || '';
            if (!raw) return;
            if (!raw.startsWith('http')) raw = 'https://' + raw;
            addToBlacklist(raw);
            if (manualInput) manualInput.value = '';
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            if (_blacklist.length === 0) return;
            if (confirm('Clear entire domain blacklist?')) clearBlacklist();
        };
    }
}
