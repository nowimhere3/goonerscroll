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
import { fetchDatabaseSilently, fetchDatabaseWithUI, pushDatabaseToRemote } from './sync.js';
import { initDropzone } from './parser.js';
import { initGrid, renderInputRows, saveInputsToState } from './grid.js';
import { initScrollEngine, stopScrolling, updateSpeedLabel } from './scroll.js';
import { launchMatrix } from './launch.js';

const MANUAL_DIRECTORY_OPTION = '<option value="manual">Manual Configuration Only (No Sync)</option>';

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    Store.warmCache();
    boot();
});

async function boot() {

    const setupScreenEl    = document.getElementById('setup-screen');
    const loopScreenEl     = document.getElementById('loop-screen');
    const feedContainerEl  = document.getElementById('feed');
    const containerEl      = document.getElementById('url-fields-container');
    const portraitToggle   = document.getElementById('portrait-mode-toggle');
    const dirDropdownEl    = document.getElementById('directory-dropdown');
    const statusEl         = document.getElementById('status');
    const gitDrawerContent = document.getElementById('git-drawer-content');
    const gitDrawerBtn     = document.getElementById('btn-toggle-git-drawer');
    const fmDrawerContent  = document.getElementById('fm-drawer-content');
    const fmDrawerBtn      = document.getElementById('btn-toggle-fm-drawer');
    const fhDrawerContent  = document.getElementById('fh-drawer-content');
    const fhDrawerBtn      = document.getElementById('btn-toggle-fh-drawer');
    const dropzoneEl       = document.getElementById('file-dropzone');
    const fileInputEl      = document.getElementById('manual-file-pick');
    const bookmarkModalEl  = document.getElementById('bookmark-modal');

    // ── Restore persisted state ───────────────────────────────────────────────
    const cachedUrls = Store.get('matrixUrls');
    setTargetUrls((Array.isArray(cachedUrls) && cachedUrls.length) ? cachedUrls : ['', '', '']);

    const rawLock = Store.get('lockState') || {};
    const rawMap  = Store.get('folderMap')  || {};
    setRowLockState(Object.fromEntries(Object.entries(rawLock).map(([k, v]) => [parseInt(k), v])));
    setUrlFolderMap(Object.fromEntries(Object.entries(rawMap).map(([k, v])  => [parseInt(k), v])));

    portraitToggle.checked = Store.get('portraitMode') === true;

    // ── Init modules ──────────────────────────────────────────────────────────
    initBlacklist();
    initBlacklistUI();
    renderBlacklistDisplay();
    initScrollEngine({ loopScreenEl });
    updateSpeedLabel();

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

    // ── Shared dropdown refresh ───────────────────────────────────────────────
    function _refreshDropdowns() {
        const fmOpen = fmDrawerContent?.style.display === 'block';
        updateDirectoryDropdown(dirDropdownEl, () => renderInputRows(), fmOpen);
    }

    function _restoreGitInputsFromStorage(refreshFromDisk = false) {
        if (refreshFromDisk) {
            Store.invalidate('gitToken');
            Store.invalidate('gitRepo');
        }

        const token = Store.get('gitToken') || '';
        const repo  = Store.get('gitRepo')  || '';
        document.getElementById('git-token').value = token;
        document.getElementById('git-repo').value  = repo;
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
        if (!token || !repo) {
            _showDisconnectedGitState();
            return;
        }

        const success = await fetchDatabaseSilently(_refreshDropdowns);
        if (!success || !getDatabaseStructure()) _showDisconnectedGitState();
    }

    // ── Folder manager ───────────────────────────────────────────────────────
    initFolderManagerDrawer(dirDropdownEl, () => renderInputRows());

    // ── Parser / dropzone ─────────────────────────────────────────────────────
    initDropzone(dropzoneEl, fileInputEl, {
        getDatabaseStructure,
        setDatabaseStructure,
        pushDatabaseToRemote,
        updateDirectoryDropdown: _refreshDropdowns,
        dirDropdown: dirDropdownEl,
    });

    // ── Grid ──────────────────────────────────────────────────────────────────
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

    // ── Git drawer ────────────────────────────────────────────────────────────
    if (gitDrawerBtn) {
        gitDrawerBtn.onclick = () => {
            const isOpen = gitDrawerContent.style.display === 'block';
            gitDrawerContent.style.display = isOpen ? 'none' : 'block';
            gitDrawerBtn.textContent = isOpen ? '⚙️ Show Connection Settings' : '✕ Hide Settings';
        };
    }

    document.getElementById('btn-connect-git').onclick = async () => {
        saveInputsToState();
        Store.set('gitToken', document.getElementById('git-token').value.trim());
        Store.set('gitRepo',  document.getElementById('git-repo').value.trim());
        const success = await fetchDatabaseWithUI(_refreshDropdowns);
        if (success) {
            gitDrawerContent.style.display = 'none';
            gitDrawerBtn.textContent = '⚙️ Show Connection Settings';
        }
    };

    // ── Folder Manager drawer ──────────────────────────────────────────────────
    if (fmDrawerBtn) {
        fmDrawerBtn.onclick = () => {
            const isOpen = fmDrawerContent.style.display === 'block';
            fmDrawerContent.style.display = isOpen ? 'none' : 'block';
            fmDrawerBtn.textContent = isOpen ? '📋 Show Folders' : '✕ Hide Folders';
        };
    }

    // ── Frame height settings ──────────────────────────────────────────────────
    _initFrameHeightSettings();

    // ── Gear button ────────────────────────────────────────────────────────────
    document.getElementById('edit-config-btn').onclick = () => {
        stopScrolling();
        loopScreenEl.style.display  = 'none';
        setupScreenEl.style.display = 'flex';
        _initLaunchpad();
    };

    // ── Initial render ────────────────────────────────────────────────────────
    _initLaunchpad();
    await _restoreGitSyncState();

    window.addEventListener('pageshow', async (event) => {
        if (!event.persisted) return;
        await _restoreGitSyncState(true);
    });
}

// ── Setup screen helpers ──────────────────────────────────────────────────────

function _initLaunchpad() {
    document.getElementById('git-token').value = Store.get('gitToken') || '';
    document.getElementById('git-repo').value  = Store.get('gitRepo')  || '';
    renderInputRows();
    renderBlacklistDisplay();
    initBlacklistUI();
    _initFrameHeightSettings();
}

function _initFrameHeightSettings() {
    const fhDrawerBtn      = document.getElementById('btn-toggle-fh-drawer');
    const fhDrawerContent  = document.getElementById('fh-drawer-content');
    const fhLandscapeInput = document.getElementById('fh-landscape-input');
    const fhPortraitInput  = document.getElementById('fh-portrait-input');
    const fhSpacerToggle   = document.getElementById('fh-spacer-toggle');
    const fhSpacerInput    = document.getElementById('fh-spacer-input');
    const fhSpacerTopToggle = document.getElementById('fh-spacer-top-toggle');
    const fhSpacerTopInput  = document.getElementById('fh-spacer-top-input');

    if (!fhDrawerBtn) return;

    if (fhLandscapeInput)   fhLandscapeInput.value    = Store.get('fhLandscape');
    if (fhPortraitInput)    fhPortraitInput.value     = Store.get('fhPortrait');
    if (fhSpacerToggle)     fhSpacerToggle.checked    = Store.get('spacerEndOn');
    if (fhSpacerInput)      fhSpacerInput.value       = Store.get('spacerEndHeight');
    if (fhSpacerTopToggle)  fhSpacerTopToggle.checked = Store.get('spacerTopOn');
    if (fhSpacerTopInput)   fhSpacerTopInput.value    = Store.get('spacerTopHeight');

    fhDrawerBtn.onclick = () => {
        const isOpen = fhDrawerContent.style.display === 'block';
        fhDrawerContent.style.display = isOpen ? 'none' : 'block';
        fhDrawerBtn.textContent = isOpen ? '↕ Adjust Heights' : '✕ Hide';
    };

    document.getElementById('btn-fh-apply').onclick = () => {
        const land      = parseFloat(fhLandscapeInput?.value);
        const port      = parseFloat(fhPortraitInput?.value);
        const spacerH   = parseFloat(fhSpacerInput?.value);
        const spacerTopH = parseFloat(fhSpacerTopInput?.value);

        if (isNaN(land)      || land < 10      || land > 300)      { alert('Landscape height must be 10–300 vh.'); return; }
        if (isNaN(port)      || port < 10      || port > 300)      { alert('Portrait height must be 10–300 vh.');  return; }
        if (isNaN(spacerH)   || spacerH < 5   || spacerH > 300)   { alert('End spacer must be 5–300 vh.');        return; }
        if (isNaN(spacerTopH)|| spacerTopH < 5|| spacerTopH > 300) { alert('Top spacer must be 5–300 vh.');       return; }

        Store.set('fhLandscape', land);
        Store.set('fhPortrait',  port);

        if (!Store.get('spacerEndLocked')) {
            Store.set('spacerEndOn',     fhSpacerToggle?.checked ?? true);
            Store.set('spacerEndHeight', spacerH);
        }
        if (!Store.get('spacerTopLocked')) {
            Store.set('spacerTopOn',     fhSpacerTopToggle?.checked ?? true);
            Store.set('spacerTopHeight', spacerTopH);
        }

        fhDrawerBtn.textContent = '↕ Adjust Heights';
        fhDrawerContent.style.display = 'none';
        alert(`Saved! Landscape: ${land}vh · Portrait: ${port}vh\nTakes effect on next Launch.`);
    };

    _wireSpacerLock('top', fhSpacerTopToggle, fhSpacerTopInput);
    _wireSpacerLock('end', fhSpacerToggle,    fhSpacerInput);
}

function _wireSpacerLock(which, toggleEl, inputEl) {
    const friendlyKey = which === 'top' ? 'spacerTopLocked' : 'spacerEndLocked';
    const btn   = document.getElementById(which === 'top' ? 'btn-lock-spacer-top' : 'btn-lock-spacer-end');
    const rowEl = document.getElementById(which === 'top' ? 'fh-spacer-top-row'  : 'fh-spacer-end-row');
    if (!btn) return;

    const applyLockUI = (locked) => {
        rowEl?.classList.toggle('spacer-row-locked', locked);
        btn.classList.toggle('locked', locked);
        btn.textContent = locked ? '🔒' : '🔓';
        btn.title = locked ? 'Locked — click to unlock' : 'Lock — prevents Save Heights from changing this row';
        if (toggleEl) toggleEl.style.pointerEvents = locked ? 'none' : '';
        if (inputEl)  inputEl.style.pointerEvents  = locked ? 'none' : '';
    };

    applyLockUI(Store.get(friendlyKey));
    btn.onclick = () => {
        const nowLocked = !Store.get(friendlyKey);
        Store.set(friendlyKey, nowLocked);
        applyLockUI(nowLocked);
    };
}
