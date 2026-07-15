import { Store } from './storage.js';
import {
    State,
    getDatabaseStructure,
    setDatabaseStructure,
    setTargetUrls,
    setUrlFolderMap,
} from './state.js';
import { initBlacklist } from './blacklist.js';
import { fetchDatabaseSilently, fetchDatabaseWithUI, pushDatabaseToRemote } from './sync.js';
import { populateBookmarkFolderSelect } from './folders.js';
import { buildStreamPanel } from './launch.js';

const SLOT_IDS = ['screen-1-slot', 'screen-2-slot', 'screen-3-slot'];

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

function _refreshFolderSelect(folderSelectEl) {
    const db = getDatabaseStructure();
    folderSelectEl.innerHTML = '<option value="">Any Folder (global random)</option>';

    if (!db) return;

    Object.keys(db).forEach((folderName) => {
        const count = db[folderName].length;
        const opt = document.createElement('option');
        opt.value = folderName;
        opt.textContent = `${folderName} (${count})`;
        folderSelectEl.appendChild(opt);
    });

    if (_activeFolder && db[_activeFolder]) {
        folderSelectEl.value = _activeFolder;
    }
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

document.addEventListener('DOMContentLoaded', async () => {
    Store.warmCache();
    initBlacklist();

    const tokenInput = document.getElementById('git-token');
    const repoInput = document.getElementById('git-repo');
    const connectBtn = document.getElementById('btn-connect-git');
    const folderSelectEl = document.getElementById('triple-folder-select');
    const loadBtn = document.getElementById('btn-load-triple');
    const shuffleAllBtn = document.getElementById('btn-shuffle-triple-all');
    const statusEl = document.getElementById('status');

    tokenInput.value = Store.get('gitToken') || '';
    repoInput.value = Store.get('gitRepo') || '';

    _bindBookmarkModal();

    await fetchDatabaseSilently(() => _refreshFolderSelect(folderSelectEl));
    _refreshFolderSelect(folderSelectEl);

    const ctx = {
        feedContainerEl: document.getElementById('triple-layout'),
        dirDropdownEl: folderSelectEl,
        statusEl,
        openBookmarkModal: _openBookmarkModal,
    };

    const initialDb = getDatabaseStructure();
    const initialSet = _buildTripleSet(initialDb, _activeFolder);
    _renderPanels(initialSet.urls, initialSet.map, ctx);

    connectBtn.onclick = async () => {
        Store.set('gitToken', tokenInput.value.trim());
        Store.set('gitRepo', repoInput.value.trim());
        const ok = await fetchDatabaseWithUI(() => _refreshFolderSelect(folderSelectEl));
        if (!ok) return;
        const db = getDatabaseStructure();
        const set = _buildTripleSet(db, _activeFolder);
        _renderPanels(set.urls, set.map, ctx);
    };

    loadBtn.onclick = () => {
        const db = getDatabaseStructure();
        _activeFolder = folderSelectEl.value || '';
        const set = _buildTripleSet(db, _activeFolder);
        _renderPanels(set.urls, set.map, ctx);
    };

    shuffleAllBtn.onclick = () => {
        const db = getDatabaseStructure();
        _activeFolder = '';
        folderSelectEl.value = '';
        const set = _buildTripleSet(db, '');
        _renderPanels(set.urls, set.map, ctx);
    };
});
