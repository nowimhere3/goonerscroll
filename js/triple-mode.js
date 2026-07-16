import { Store } from './storage.js';
import {
    State,
    getDatabaseStructure,
    setDatabaseStructure,
    setTargetUrls,
    setUrlFolderMap,
} from './state.js';
import { initBlacklist } from './blacklist.js';
import { fetchDatabaseSilently, pushDatabaseToRemote } from './sync.js';
import { populateBookmarkFolderSelect } from './folders.js';
import { buildStreamPanel } from './launch.js';

const SLOT_IDS = ['screen-1-slot', 'screen-2-slot', 'screen-3-slot'];
const LAYOUT_IDS = ['top2', 'bottom2', '3col', 'lefttall', 'righttall'];
const DEFAULT_LAYOUT = 'lefttall';

let _activeFolder = '';

function _pickRandom(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

function _pickFromFolder(db, folderName) {
    if (!db || !folderName || !Array.isArray(db[folderName]) || db[folderName].length === 0) return null;
    return _pickRandom(db[folderName]);
}

function _pickFromAnyFolder(db) {
    if (!db) return { url: null, folder: null };
    const folders = Object.keys(db).filter((folder) => Array.isArray(db[folder]) && db[folder].length > 0);
    const folder = _pickRandom(folders);
    if (!folder) return { url: null, folder: null };
    return { url: _pickRandom(db[folder]), folder };
}

function _inferFolderForUrl(db, url) {
    if (!db || !url) return null;
    const folder = Object.keys(db).find((name) => Array.isArray(db[name]) && db[name].includes(url));
    return folder || null;
}

function _buildTripleSet(db, preferredFolder = '') {
    const stored = Store.get('matrixUrls');
    const urls = Array.isArray(stored) ? stored.slice(0, 3) : [];
    const map = {};

    while (urls.length < 3) urls.push('');

    if (db && preferredFolder && db[preferredFolder]?.length) {
        for (let i = 0; i < 3; i += 1) {
            urls[i] = _pickFromFolder(db, preferredFolder) || urls[i] || 'https://example.com';
            map[i] = preferredFolder;
        }
        return { urls, map };
    }

    for (let i = 0; i < 3; i += 1) {
        if (urls[i]) continue;
        const pick = _pickFromAnyFolder(db);
        urls[i] = pick.url || 'https://example.com';
        if (pick.folder) map[i] = pick.folder;
    }

    for (let i = 0; i < 3; i += 1) {
        if (!map[i]) {
            const inferred = _inferFolderForUrl(db, urls[i]);
            if (inferred) map[i] = inferred;
        }
    }

    return { urls, map };
}

function _bindBookmarkModal() {
    const modalEl = document.getElementById('bookmark-modal');
    const cancelBtn = document.getElementById('btn-bm-cancel');
    const saveBtn = document.getElementById('btn-bm-save');

    const closeModal = () => modalEl.classList.remove('open');

    cancelBtn.onclick = closeModal;
    modalEl.onclick = (e) => {
        if (e.target === modalEl) closeModal();
    };

    saveBtn.onclick = async () => {
        const selectedFolder = document.getElementById('bm-folder-select').value;
        const newFolder = document.getElementById('bm-new-folder-input').value.trim().replace(/[^a-zA-Z0-9_\- ]/g, '');
        const targetFolder = newFolder || selectedFolder;
        const targetUrl = State.get('bookmarkTargetUrl');

        if (!targetFolder) {
            alert('Please choose an existing folder or enter a new folder name.');
            return;
        }
        if (!targetUrl) {
            closeModal();
            return;
        }

        const db = getDatabaseStructure() || {};
        if (!db[targetFolder]) db[targetFolder] = [];
        if (!db[targetFolder].includes(targetUrl)) {
            db[targetFolder].push(targetUrl);
            setDatabaseStructure(db);
            await pushDatabaseToRemote(`Bookmarked 1 link into playlist: ${targetFolder}`);
        }

        const starBtn = State.get('bookmarkStarBtn');
        if (starBtn) {
            starBtn.classList.add('saved');
            starBtn.textContent = '★';
        }

        closeModal();
    };
}

function _openBookmarkModal(url, starBtn) {
    const db = getDatabaseStructure();
    if (!db) {
        alert('Connect your GitHub database first to use the playlist feature.');
        return;
    }

    State.set('bookmarkTargetUrl', url);
    State.set('bookmarkStarBtn', starBtn);

    document.getElementById('bm-url-preview').textContent = url;
    document.getElementById('bm-new-folder-input').value = '';
    populateBookmarkFolderSelect();

    const modalEl = document.getElementById('bookmark-modal');
    modalEl.classList.add('open');
    document.getElementById('bm-new-folder-input').focus();
}

/**
 * Switch the visual arrangement of the 3 screen slots. This only ever touches
 * the CSS class on #triple-layout — the panels/iframes themselves are never
 * rebuilt or moved, since each slot's grid-area (screen1/screen2/screen3) is
 * fixed in CSS regardless of which layout is active.
 */
function _applyLayout(layoutName, tripleLayoutEl, layoutBtns) {
    const safeName = LAYOUT_IDS.includes(layoutName) ? layoutName : DEFAULT_LAYOUT;

    LAYOUT_IDS.forEach((name) => tripleLayoutEl.classList.remove(`layout-${name}`));
    tripleLayoutEl.classList.add(`layout-${safeName}`);

    Object.entries(layoutBtns).forEach(([name, btn]) => {
        btn.classList.toggle('active', name === safeName);
    });

    Store.set('tripleLayout', safeName);
}

function _renderPanels(urls, map, ctx) {
    SLOT_IDS.forEach((id, index) => {
        const slot = document.getElementById(id);
        // Clean existing content but keep label
        const existing = slot.querySelector('.stream-panel');
        if (existing) existing.remove();

        const panel = buildStreamPanel(
            urls[index] || 'https://example.com',
            index,
            'stream-panel triple-fill', // Using your specific CSS class from index3.html
            '100%',
            ctx
        );

        slot.appendChild(panel);
    });

    Store.set('matrixUrls', urls);
    setTargetUrls(urls);
    setUrlFolderMap(map);

    const active = urls.filter(Boolean).length;
    ctx.statusEl.textContent = `${active} streams`;
}

/** Build the 🌐 Folder dropup list (matches .dropup-item / .dropup-count CSS in index3.html) */
function _renderFolderDropup(folderDropupEl, ctx) {
    const db = getDatabaseStructure();
    folderDropupEl.innerHTML = '';

    const anyItem = document.createElement('div');
    anyItem.className = 'dropup-item' + (_activeFolder ? '' : ' selected');
    anyItem.textContent = 'Any Folder (global random)';
    anyItem.onclick = () => {
        _activeFolder = '';
        folderDropupEl.classList.remove('open');
        const set = _buildTripleSet(getDatabaseStructure(), '');
        _renderPanels(set.urls, set.map, ctx);
    };
    folderDropupEl.appendChild(anyItem);

    if (!db) return;

    Object.keys(db).forEach((folderName) => {
        const item = document.createElement('div');
        item.className = 'dropup-item' + (_activeFolder === folderName ? ' selected' : '');
        const label = document.createElement('span');
        label.textContent = folderName;
        const count = document.createElement('span');
        count.className = 'dropup-count';
        count.textContent = db[folderName].length;
        item.append(label, count);
        item.onclick = () => {
            _activeFolder = folderName;
            folderDropupEl.classList.remove('open');
            const set = _buildTripleSet(getDatabaseStructure(), _activeFolder);
            _renderPanels(set.urls, set.map, ctx);
        };
        folderDropupEl.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    Store.warmCache();
    initBlacklist();

    // NOTE: this page's master-bar markup has no git-token / git-repo / connect
    // inputs — those live on index.html. Credentials are already in Store by
    // the time this page loads, so we just read the database directly.
    const statusEl        = document.getElementById('master-status');
    const toggleMasterBtn = document.getElementById('btn-toggle-master');
    const masterBarEl     = document.getElementById('master-bar');
    const closeMasterBtn  = document.getElementById('btn-master-close');
    const folderBtn       = document.getElementById('btn-master-folder');
    const folderDropupEl  = document.getElementById('master-folder-dropup');
    const shuffleBtn      = document.getElementById('btn-master-shuffle');
    const shuffleAllBtn   = document.getElementById('btn-master-shuffle-all');
    const tripleLayoutEl  = document.getElementById('triple-layout');
    const layoutBtns = {
        top2:      document.getElementById('btn-layout-top2'),
        bottom2:   document.getElementById('btn-layout-bottom2'),
        '3col':    document.getElementById('btn-layout-3col'),
        lefttall:  document.getElementById('btn-layout-lefttall'),
        righttall: document.getElementById('btn-layout-righttall'),
    };

    _bindBookmarkModal();

    const ctx = {
        feedContainerEl: document.getElementById('triple-layout'),
        dirDropdownEl: null,
        statusEl,
        openBookmarkModal: _openBookmarkModal,
    };

    // 🎬 toggle open/close for the master control bar
    const closeMasterBar = () => {
        masterBarEl.classList.remove('open');
        toggleMasterBtn.classList.remove('active');
        folderDropupEl.classList.remove('open');
    };
    toggleMasterBtn.onclick = () => {
        if (masterBarEl.classList.contains('open')) {
            closeMasterBar();
        } else {
            masterBarEl.classList.add('open');
            toggleMasterBtn.classList.add('active');
        }
    };
    closeMasterBtn.onclick = closeMasterBar;

    // 🖥 Layout switcher — restore persisted layout, then wire each button
    _applyLayout(Store.get('tripleLayout') || DEFAULT_LAYOUT, tripleLayoutEl, layoutBtns);
    Object.entries(layoutBtns).forEach(([name, btn]) => {
        btn.onclick = () => _applyLayout(name, tripleLayoutEl, layoutBtns);
    });

    // 🌐 Folder dropup
    folderBtn.onclick = () => {
        const willOpen = !folderDropupEl.classList.contains('open');
        if (willOpen) _renderFolderDropup(folderDropupEl, ctx);
        folderDropupEl.classList.toggle('open', willOpen);
    };
    document.addEventListener('click', (e) => {
        if (folderDropupEl.classList.contains('open')
            && !folderDropupEl.contains(e.target)
            && e.target !== folderBtn) {
            folderDropupEl.classList.remove('open');
        }
    });

    if (statusEl) statusEl.textContent = 'Loading database…';
    await fetchDatabaseSilently(() => {
        if (!statusEl) return;
        const db = getDatabaseStructure();
        statusEl.textContent = db
            ? `Connected — ${Object.keys(db).length} folders`
            : 'Not connected';
    });

    const initialDb = getDatabaseStructure();
    const initialSet = _buildTripleSet(initialDb, _activeFolder);
    _renderPanels(initialSet.urls, initialSet.map, ctx);

    // 🎲 Shuffle — reshuffle within the currently selected folder (or global if none)
    shuffleBtn.onclick = () => {
        const db = getDatabaseStructure();
        const set = _buildTripleSet(db, _activeFolder);
        _renderPanels(set.urls, set.map, ctx);
    };

    // 🎲🎲 Shuffle All — ignore the active folder, pull from anywhere
    shuffleAllBtn.onclick = () => {
        const db = getDatabaseStructure();
        _activeFolder = '';
        const set = _buildTripleSet(db, '');
        _renderPanels(set.urls, set.map, ctx);
    };
});
