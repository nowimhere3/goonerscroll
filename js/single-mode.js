/**
 * single-mode.js — Single Mode Bootstrap & Coordination
 * ─────────────────────────────────────────────────────────────────────────────
 * Root initializer for index2.html. Connects all single-mode modules and boots
 * the application.
 *
 * Responsibilities:
 *   1. Restore persisted single-mode state
 *   2. Fetch database from GitHub (or use cached)
 *   3. Initialize folder dropdown
 *   4. Initialize single iframe
 *   5. Wire up all control buttons
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Store } from './storage.js';
import { State, getDatabaseStructure, setDatabaseStructure } from './state.js';
import { initBlacklist, initBlacklistUI } from './blacklist.js';
import { fetchDatabaseSilently } from './sync.js';
import { launchSingleMode, getCurrentUrl, getCurrentFolder, loadRandom, loadRandomFromAll, deleteAndReplace } from './single-launch.js';

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    Store.warmCache();
    boot();
});

async function boot() {
    // ── DOM elements ───────────────────────────────────────────────────────────
    const iframeEl           = document.getElementById('main-iframe');
    const statusEl           = document.getElementById('status-message');
    const btnFolder          = document.getElementById('btn-folder');
    const btnFavorite        = document.getElementById('btn-favorite');
    const btnPurge           = document.getElementById('btn-purge');
    const btnDeleteReplace   = document.getElementById('btn-delete-replace');
    const btnShuffle         = document.getElementById('btn-shuffle');
    const btnShuffleAll      = document.getElementById('btn-shuffle-all');
    const folderDropdown     = document.getElementById('folder-dropdown');
    const bookmarkModalEl    = document.getElementById('bookmark-modal');

    // ── Initialize modules ─────────────────────────────────────────────────────
    initBlacklist();
    initBlacklistUI();

    // ── Fetch database ─────────────────────────────────────────────────────────
    let db = getDatabaseStructure();
    if (!db) {
        await fetchDatabaseSilently(() => {
            db = getDatabaseStructure();
        });
    }

    if (!db || Object.keys(db).length === 0) {
        statusEl.textContent = 'No database loaded. Connect GitHub to get started.';
        return;
    }

    // ── Get starting URL ────────────────────────────────────────────────────────
    // Check URL parameter first, then stored value, then default to first folder
    const params = new URLSearchParams(window.location.search);
    let startUrl = params.get('startUrl') || Store.get('singleModeUrl') || '';
    let startFolder = Store.get('singleModeFolder') || Object.keys(db)[0] || null;

    // If no starting URL, get random from start folder
    if (!startUrl && startFolder) {
        const folderUrls = db[startFolder];
        if (folderUrls && folderUrls.length > 0) {
            startUrl = folderUrls[Math.floor(Math.random() * folderUrls.length)];
        }
    }

    // ── Open bookmark modal ────────────────────────────────────────────────────
    function openBookmarkModal(url) {
        if (!db) { alert('Connect your GitHub database first to use the playlist feature.'); return; }

        State.set('bookmarkTargetUrl', url);
        document.getElementById('bm-url-preview').textContent = url;
        document.getElementById('bm-new-folder-input').value = '';

        // Populate folder select
        const select = document.getElementById('bm-folder-select');
        select.innerHTML = '<option value="">— select a folder —</option>';
        Object.keys(db).forEach(folderName => {
            const count = db[folderName].length;
            const opt = document.createElement('option');
            opt.value = folderName;
            opt.textContent = `${folderName} (${count})`;
            select.appendChild(opt);
        });

        bookmarkModalEl.classList.add('open');
        document.getElementById('bm-new-folder-input').focus();
    }

    function closeBookmarkModal() {
        bookmarkModalEl.classList.remove('open');
    }

    document.getElementById('btn-bm-cancel').onclick = closeBookmarkModal;
    bookmarkModalEl.onclick = (e) => { if (e.target === bookmarkModalEl) closeBookmarkModal(); };

    document.getElementById('btn-bm-save').onclick = async () => {
        const selectedFolder = document.getElementById('bm-folder-select').value;
        const newFolder = document.getElementById('bm-new-folder-input').value.trim().replace(/[^a-zA-Z0-9_\- ]/g, '');
        const targetUrl = State.get('bookmarkTargetUrl');

        if (!selectedFolder && !newFolder) {
            alert('Please select or create a folder.');
            return;
        }

        const folder = newFolder || selectedFolder;

        if (!db[folder]) {
            db[folder] = [];
        }

        if (!db[folder].includes(targetUrl)) {
            db[folder].push(targetUrl);
            setDatabaseStructure(db);
            
            // Try to push to remote
            const { pushDatabaseToRemote } = await import('./sync.js');
            pushDatabaseToRemote(`Bookmarked 1 link into playlist: ${folder}`);
        }

        closeBookmarkModal();
        _updateFolderDropdown();
    };

    // ── Open delete & replace modal ────────────────────────────────────────────
    function openDeleteReplaceModal() {
        const folders = Object.keys(db || {});
        if (folders.length === 0) {
            alert('No folders available.');
            return;
        }

        let html = 'Select a folder to load from:\n\n';
        const options = folders.map((f, i) => `${i + 1}. ${f} (${db[f].length})`).join('\n');
        html += options;

        // Simple prompt for now — future: better modal
        const currentFolder = getCurrentFolder();
        const idx = folders.indexOf(currentFolder);
        const defaultIdx = idx >= 0 ? idx + 1 : 1;

        const choice = prompt(html, String(defaultIdx));
        if (!choice) return;

        const folderIdx = parseInt(choice) - 1;
        if (folderIdx < 0 || folderIdx >= folders.length) {
            alert('Invalid selection.');
            return;
        }

        const newFolder = folders[folderIdx];
        deleteAndReplace(newFolder);
        _updateFolderDropdown();
    }

    // ── Folder dropdown ────────────────────────────────────────────────────────
    function _updateFolderDropdown() {
        folderDropdown.innerHTML = '';
        const folders = Object.keys(db || {});
        const current = getCurrentFolder();

        folders.forEach(folderName => {
            const count = db[folderName].length;
            const item = document.createElement('div');
            item.className = 'folder-dropdown-item';
            item.innerHTML = `${folderName} <span class="folder-count">(${count})</span>`;
            item.onclick = () => {
                loadRandom(folderName);
                folderDropdown.classList.remove('open');
                _updateStatus();
            };

            if (folderName === current) {
                item.style.background = 'rgba(0, 149, 246, 0.1)';
                item.style.fontWeight = 'bold';
            }

            folderDropdown.appendChild(item);
        });
    }

    function _updateStatus() {
        const folder = getCurrentFolder();
        const url = getCurrentUrl();
        const folderStr = folder ? `${folder} • ` : 'No folder • ';
        const urlStr = url ? url.substring(0, 40) + (url.length > 40 ? '...' : '') : 'No URL';
        statusEl.textContent = `${folderStr}${urlStr}`;
    }

    // ── Button handlers ────────────────────────────────────────────────────────
    btnFolder.onclick = () => {
        folderDropdown.classList.toggle('open');
    };

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target !== btnFolder && !folderDropdown.contains(e.target)) {
            folderDropdown.classList.remove('open');
        }
    });

    btnFavorite.onclick = () => openBookmarkModal(getCurrentUrl());

    btnDeleteReplace.onclick = () => openDeleteReplaceModal();

    btnShuffle.onclick = () => {
        const folder = getCurrentFolder();
        if (folder) {
            loadRandom(folder);
            _updateStatus();
        }
    };

    btnShuffleAll.onclick = () => {
        loadRandomFromAll();
        _updateStatus();
    };

    // ── Launch single mode ─────────────────────────────────────────────────────
    launchSingleMode(startUrl, startFolder, {
        iframeEl: iframeEl,
        statusEl: statusEl,
        btnFavorite: btnFavorite,
        btnPurge: btnPurge,
        btnDeleteReplace: btnDeleteReplace,
        btnShuffle: btnShuffle,
        btnShuffleAll: btnShuffleAll,
        openBookmarkModal: openBookmarkModal,
        openDeleteReplaceModal: openDeleteReplaceModal,
    });

    // ── Populate folder dropdown ───────────────────────────────────────────────
    _updateFolderDropdown();
    _updateStatus();
}
