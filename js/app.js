/**
 * app.js — Stream Loop Launchpad
 * Root initializer. Connects all modules and boots the application.
 */

import { Store } from './storage.js';
import {
    State,
    setTargetUrls, setUrlFolderMap, setRowLockState,
    getDatabaseStructure, setDatabaseStructure, setDatabaseSha,
} from './state.js';
import { initBlacklist, initBlacklistUI, renderBlacklistDisplay } from './blacklist.js';
import {
    updateDirectoryDropdown,
    initFolderManagerDrawer,
    populateBookmarkFolderSelect,
    renderFolderManager,
} from './folders.js';
import { fetchDatabaseSilently, pushDatabaseToRemote } from './sync.js';
import { initDropzone } from './parser.js';
import { initGrid, renderInputRows } from './grid.js';
import { initScrollEngine, stopScrolling, updateSpeedLabel } from './scroll.js';
import { launchMatrix } from './launch.js';

const MANUAL_DIRECTORY_OPTION = '<option value="manual">Manual Configuration Only (No Sync)</option>';

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    Store.warmCache();
    boot().catch(err => {
        console.error('[app] boot() THREW — this is why nothing initialized:', err);
    });
});

async function boot() {
    console.log('[app] boot: start');

    const setupScreenEl    = document.getElementById('setup-screen');
    const loopScreenEl     = document.getElementById('loop-screen');
    const feedContainerEl  = document.getElementById('feed');
    const containerEl      = document.getElementById('url-fields-container');
    const portraitToggle   = document.getElementById('portrait-mode-toggle');
    const dirDropdownEl    = document.getElementById('directory-dropdown');
    const statusEl         = document.getElementById('status');
    const dropzoneEl       = document.getElementById('file-dropzone');
    const fileInputEl      = document.getElementById('manual-file-pick');
    const bookmarkModalEl  = document.getElementById('bookmark-modal');
    console.log('[app] boot: checkpoint 1 — grabbed DOM refs', { setupScreenEl, loopScreenEl, feedContainerEl, containerEl, portraitToggle, dirDropdownEl, statusEl, dropzoneEl, fileInputEl, bookmarkModalEl });

    // ── Restore persisted state ───────────────────────────────────────────────
    const cachedUrls = Store.get('matrixUrls');
    setTargetUrls((Array.isArray(cachedUrls) && cachedUrls.length) ? cachedUrls : ['', '', '']);

    const rawLock = Store.get('lockState') || {};
    const rawMap  = Store.get('folderMap')  || {};
    setRowLockState(Object.fromEntries(Object.entries(rawLock).map(([k, v]) => [parseInt(k), v])));
    setUrlFolderMap(Object.fromEntries(Object.entries(rawMap).map(([k, v])  => [parseInt(k), v])));

    portraitToggle.checked = Store.get('portraitMode') === true;
    console.log('[app] boot: checkpoint 2 — restored persisted state');

    // ── Init modules ──────────────────────────────────────────────────────────
    initBlacklist();
    initBlacklistUI();
    renderBlacklistDisplay();
    initScrollEngine({ loopScreenEl });
    updateSpeedLabel();
    console.log('[app] boot: checkpoint 3 — init modules done');

    // ── Frame height helper ───────────────────────────────────────────────────
    function getFrameHeights() {
        const lEl   = document.getElementById('fh-landscape-input');
        const pEl   = document.getElementById('fh-portrait-input');
        const sEl   = document.getElementById('fh-spacer-toggle');
        const shEl  = document.getElementById('fh-spacer-input');
        const stEl  = document.getElementById('fh-spacer-top-toggle');
        const sthEl = document.getElementById('fh-spacer-top-input');
        return {
            landscape:      ((lEl   ? parseFloat(lEl.value)   : null) || Store.get('fhLandscape'))     + 'vh',
            portrait:       ((pEl   ? parseFloat(pEl.value)   : null) || Store.get('fhPortrait'))      + 'vh',
            spacerOn:       sEl   ? sEl.checked   : Store.get('spacerEndOn'),
            spacerHeight:   ((shEl  ? parseFloat(shEl.value)  : null) || Store.get('spacerEndHeight')) + 'vh',
            spacerTopOn:    stEl  ? stEl.checked  : Store.get('spacerTopOn'),
            spacerTopHeight:((sthEl ? parseFloat(sthEl.value) : null) || Store.get('spacerTopHeight')) + 'vh',
        };
    }

    // ── Bookmark modal ───────────────────────────────────────────────────────
    function openBookmarkModal(url, starBtn) {
        const db = getDatabaseStructure();
        if (!db) { alert('Connect your GitHub database first to use the playlist feature.'); return; }
        State.set('bookmarkTargetUrl', url);
        State.set('bookmarkStarBtn',   starBtn);
        document.getElementById('bm-url-preview').textContent = url;
        document.getElementById('bm-new-folder-input').value  = '';
        populateBookmarkFolderSelect();
        bookmarkModalEl.classList.add('open');
        document.getElementById('bm-new-folder-input').focus();
    }

    document.getElementById('btn-bm-cancel').onclick = () => bookmarkModalEl.classList.remove('open');
    bookmarkModalEl.onclick = (e) => { if (e.target === bookmarkModalEl) bookmarkModalEl.classList.remove('open'); };

    document.getElementById('btn-bm-save').onclick = async () => {
        const selectedFolder = document.getElementById('bm-folder-select').value;
        const newFolder      = document.getElementById('bm-new-folder-input').value.trim().replace(/[^a-zA-Z0-9_\- ]/g, '');
        const targetFolder   = newFolder || selectedFolder;
        if (!targetFolder) { alert('Please choose an existing folder or enter a new folder name.'); return; }
        const bookmarkUrl = State.get('bookmarkTargetUrl');
        if (!bookmarkUrl) return;
        const db = getDatabaseStructure();
        if (!db[targetFolder]) db[targetFolder] = [];
        if (!db[targetFolder].includes(bookmarkUrl)) db[targetFolder].push(bookmarkUrl);
        setDatabaseStructure(db);
        _refreshDropdowns();
        bookmarkModalEl.classList.remove('open');
        const starBtn = State.get('bookmarkStarBtn');
        if (starBtn) { starBtn.classList.add('saved'); starBtn.textContent = '★'; }
        await pushDatabaseToRemote(`Bookmarked 1 link into playlist: ${targetFolder}`);
    };
    console.log('[app] boot: checkpoint 4 — bookmark modal wired');

    // ── Shared dropdown refresh ───────────────────────────────────────────────
    function _refreshDropdowns() {
        // Folder Manager UI now lives on settings.html, so it's never "open" here.
        updateDirectoryDropdown(dirDropdownEl, () => renderInputRows(), false);
    }

    function _restoreGitInputsFromStorage(refreshFromDisk = false) {
        if (refreshFromDisk) {
            Store.invalidate('gitToken');
            Store.invalidate('gitRepo');
        }

        // Git token/repo inputs now live only on settings.html — just read Store.
        const token = Store.get('gitToken') || '';
        const repo  = Store.get('gitRepo')  || '';
        return { token, repo };
    }

    function _showDisconnectedGitState() {
        setDatabaseStructure(null);
        setDatabaseSha(null);
        dirDropdownEl.innerHTML = MANUAL_DIRECTORY_OPTION;
        dirDropdownEl.value = 'manual';
        const ingestSelect = document.getElementById('ingest-folder-select');
        if (ingestSelect) ingestSelect.innerHTML = '<option value="">— select existing folder —</option>';
        renderInputRows();
        renderFolderManager(dirDropdownEl, () => renderInputRows());
    }

    async function _restoreGitSyncState(refreshFromDisk = false) {
        const { token, repo } = _restoreGitInputsFromStorage(refreshFromDisk);
        console.log('[app] _restoreGitSyncState: token present?', !!token, 'repo present?', !!repo, 'repo value:', repo);
        if (!token || !repo) {
            console.error('[app] _restoreGitSyncState: showing disconnected state — Store.get returned empty token/repo despite localStorage check. token:', token, 'repo:', repo);
            _showDisconnectedGitState();
            return;
        }

        const success = await fetchDatabaseSilently(_refreshDropdowns);
        if (!success || !getDatabaseStructure()) {
            console.error('[app] _restoreGitSyncState: showing disconnected state — success:', success, 'getDatabaseStructure():', getDatabaseStructure());
            _showDisconnectedGitState();
        }
    }

    // ── Folder manager ───────────────────────────────────────────────────────
    initFolderManagerDrawer(dirDropdownEl, () => renderInputRows());
    console.log('[app] boot: checkpoint 5 — folder manager drawer init');

    // ── Parser / dropzone ─────────────────────────────────────────────────────
    initDropzone(dropzoneEl, fileInputEl, {
        getDatabaseStructure,
        setDatabaseStructure,
        pushDatabaseToRemote,
        updateDirectoryDropdown: _refreshDropdowns,
        dirDropdown: dirDropdownEl,
    });
    console.log('[app] boot: checkpoint 6 — dropzone init');
    initGrid({
        containerEl:    containerEl,
        dirDropdown:    dirDropdownEl,
        portraitToggle: portraitToggle,
        launchCallback: (activeUrls) => {
            launchMatrix(activeUrls, {
                setupScreenEl,
                loopScreenEl,
                feedContainerEl,
                dirDropdownEl,
                portraitToggle,
                statusEl,
                getFrameHeights,
                openBookmarkModal,
                stopScrolling,
                updateSpeedLabel,
            });
        },
    });
    console.log('[app] boot: checkpoint 7 — grid init');

    // ── Gear button (⚙ settings-btn, loop-screen controls) ─────────────────────
    // GitHub sync / Folder Manager / Frame Height settings now live only on
    // settings.html. This button just returns to the index.html setup screen.
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.onclick = () => {
            stopScrolling();
            loopScreenEl.style.display  = 'none';
            setupScreenEl.style.display = 'flex';
            _initLaunchpad();
        };
    }

    // ── Initial render ────────────────────────────────────────────────────────
    console.log('[app] boot: checkpoint 8 — settings-btn wired, about to init launchpad');
    _initLaunchpad();
    console.log('[app] boot: checkpoint 9 — launchpad initialized, about to restore git sync state');
    await _restoreGitSyncState();
    console.log('[app] boot: checkpoint 10 — git sync state restored, boot complete');

    window.addEventListener('pageshow', async (event) => {
        if (!event.persisted) return;
        await _restoreGitSyncState(true);
    });
}

// ── Setup screen helpers ──────────────────────────────────────────────────────

function _initLaunchpad() {
    // Git token/repo inputs, and Frame Height settings, now live only on
    // settings.html — nothing to restore into this page's DOM for them.
    renderInputRows();
    renderBlacklistDisplay();
    initBlacklistUI();
}
