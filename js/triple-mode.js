import { Store } from './storage.js';
import {
    State,
    getDatabaseStructure,
    setDatabaseStructure,
    setTargetUrls,
    setUrlFolderMap,
} from './state.js';
import { initBlacklist, isBlacklisted, addBlacklistedDomain } from './blacklist.js';
import { fetchDatabaseSilently, fetchDatabaseWithUI, pushDatabaseToRemote } from './sync.js';
import { populateBookmarkFolderSelect } from './folders.js';

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

/**
 * Build stream panel with iframe and hotswap overlay
 */
function _buildStreamPanel(url, screenIndex) {
    const panel = document.createElement('div');
    panel.className = 'stream-panel mode-landscape triple-fill';

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.className = 'post-iframe';
    iframe.src = url || 'https://example.com';
    iframe.allow = 'autoplay; fullscreen';

    // Create zoom wrapper
    const zoomWrapper = document.createElement('div');
    zoomWrapper.className = 'iframe-zoom-wrapper';
    zoomWrapper.appendChild(iframe);

    // Zoom state
    let currentZoom = 1.0;
    const ZOOM_STEP = 0.1;
    const ZOOM_MIN = 0.3;
    const ZOOM_MAX = 3.0;

    const applyZoom = (z) => {
        currentZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
        zoomWrapper.style.transform = `scale(${currentZoom.toFixed(2)})`;
        const zoomLabelEl = overlay.querySelector('.zoom-label');
        if (zoomLabelEl) {
            zoomLabelEl.textContent = `${Math.round(currentZoom * 100)}%`;
        }
    };

    // Create hotswap trigger button ("...")
    const trigger = document.createElement('button');
    trigger.className = 'hotswap-trigger';
    trigger.textContent = '···';
    trigger.title = 'Open hotswap controls';

    // Create hotswap overlay
    const overlay = document.createElement('div');
    overlay.className = 'hotswap-overlay';

    overlay.innerHTML = `
        <div class="zoom-control-row">
            <button class="btn-zoom btn-zoom-out">−</button>
            <span class="zoom-label">100%</span>
            <button class="btn-zoom btn-zoom-in">+</button>
            <button class="btn-zoom btn-zoom-reset" title="Reset zoom to 1:1">1:1</button>
        </div>
        <div class="hotswap-icon-row">
            <button class="btn-hotswap-toggle" title="Enter custom URL">🌐</button>
            <button class="btn-hotswap-shuffle" title="Shuffle (same folder)">🎲 Shuffle</button>
        </div>
        <div class="hotswap-icon-row">
            <button class="btn-hotswap-shuffle-all" title="Shuffle from any folder">🎲 All</button>
            <button class="btn-purge" title="Purge current URL">🗑️ Purge</button>
            <button class="btn-hotswap-delete" title="Delete & replace">❌</button>
        </div>
        <div class="hotswap-icon-row">
            <button class="btn-hotswap-star" title="Save to playlist">⭐</button>
            <button class="btn-hotswap-reload" title="Reload iframe">🔄</button>
            <button class="btn-hotswap-kill" title="Close menu">✕</button>
        </div>
        <div class="hotswap-url-row">
            <input type="text" class="hotswap-input" placeholder="Enter URL...">
            <button class="hotswap-submit-btn" title="Load URL">↵</button>
        </div>
    `;

    // Bind zoom controls
    const zoomInBtn = overlay.querySelector('.btn-zoom-in');
    const zoomOutBtn = overlay.querySelector('.btn-zoom-out');
    const zoomResetBtn = overlay.querySelector('.btn-zoom-reset');

    zoomInBtn.onclick = (e) => {
        e.stopPropagation();
        applyZoom(currentZoom + ZOOM_STEP);
    };

    zoomOutBtn.onclick = (e) => {
        e.stopPropagation();
        applyZoom(currentZoom - ZOOM_STEP);
    };

    zoomResetBtn.onclick = (e) => {
        e.stopPropagation();
        applyZoom(1.0);
    };

    // Bind hotswap controls
    _bindHotswapControls(screenIndex, overlay, trigger, iframe, url);

    // Trigger button toggles overlay
    trigger.onclick = (e) => {
        e.stopPropagation();
        overlay.classList.toggle('open');
        trigger.classList.toggle('open');
    };

    // Close overlay when clicking outside
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== trigger) {
            overlay.classList.remove('open');
            trigger.classList.remove('open');
        }
    });

    // Assemble panel
    panel.appendChild(zoomWrapper);
    panel.appendChild(trigger);
    panel.appendChild(overlay);

    return panel;
}

/**
 * Bind all hotswap control buttons
 */
function _bindHotswapControls(screenIndex, overlay, trigger, iframe, currentUrl) {
    const closeOverlay = () => {
        overlay.classList.remove('open');
        trigger.classList.remove('open');
    };

    const slot = document.getElementById(SLOT_IDS[screenIndex]);
    const db = getDatabaseStructure();

    // ── Shuffle button ──
    const btnShuffle = overlay.querySelector('.btn-hotswap-shuffle');
    btnShuffle.onclick = async () => {
        const folder = State.get(`screenFolder_${screenIndex}`) || _activeFolder || '';
        let url = _pickFromFolder(db, folder);
        if (!url) {
            const pick = _pickFromAnyFolder(db);
            url = pick.url;
            State.set(`screenFolder_${screenIndex}`, pick.folder || '');
        }
        if (url && !isBlacklisted(url)) {
            iframe.src = url;
            State.set(`screenUrl_${screenIndex}`, url);
        }
        closeOverlay();
    };

    // ── Shuffle All button ──
    const btnShuffleAll = overlay.querySelector('.btn-hotswap-shuffle-all');
    btnShuffleAll.onclick = async () => {
        const pick = _pickFromAnyFolder(db);
        if (pick.url && !isBlacklisted(pick.url)) {
            iframe.src = pick.url;
            State.set(`screenUrl_${screenIndex}`, pick.url);
            State.set(`screenFolder_${screenIndex}`, pick.folder || '');
        }
        closeOverlay();
    };

    // ── Purge button ──
    const btnPurge = overlay.querySelector('.btn-purge');
    btnPurge.onclick = async () => {
        const url = iframe.src;
        const folder = State.get(`screenFolder_${screenIndex}`);

        if (folder && db[folder]) {
            const idx = db[folder].indexOf(url);
            if (idx >= 0) {
                db[folder].splice(idx, 1);
                setDatabaseStructure(db);
                addBlacklistedDomain(url);
                await pushDatabaseToRemote(`Purged link: ${url}`);
            }
        }

        // Load next
        let nextUrl = _pickFromFolder(db, folder);
        if (!nextUrl) {
            const pick = _pickFromAnyFolder(db);
            nextUrl = pick.url;
            State.set(`screenFolder_${screenIndex}`, pick.folder || '');
        }
        if (nextUrl) {
            iframe.src = nextUrl;
            State.set(`screenUrl_${screenIndex}`, nextUrl);
        }
        closeOverlay();
    };

    // ── Delete & Replace button ──
    const btnDelete = overlay.querySelector('.btn-hotswap-delete');
    btnDelete.onclick = async () => {
        const url = iframe.src;
        const folder = State.get(`screenFolder_${screenIndex}`);

        if (folder && db[folder]) {
            const idx = db[folder].indexOf(url);
            if (idx >= 0) {
                db[folder].splice(idx, 1);
                setDatabaseStructure(db);
                await pushDatabaseToRemote(`Deleted link from ${folder}: ${url}`);
            }
        }

        // Pick new from any folder
        const pick = _pickFromAnyFolder(db);
        if (pick.url) {
            iframe.src = pick.url;
            State.set(`screenUrl_${screenIndex}`, pick.url);
            State.set(`screenFolder_${screenIndex}`, pick.folder || '');
        }
        closeOverlay();
    };

    // ── Star/Bookmark button ──
    const btnStar = overlay.querySelector('.btn-hotswap-star');
    const url = iframe.src;
    const isAlreadySaved = db && Object.values(db).some(arr => arr.includes(url));
    if (isAlreadySaved) {
        btnStar.classList.add('saved');
        btnStar.textContent = '★';
    }

    btnStar.onclick = () => {
        _openBookmarkModal(iframe.src, btnStar);
        closeOverlay();
    };

    // ── Reload button ──
    const btnReload = overlay.querySelector('.btn-hotswap-reload');
    btnReload.onclick = () => {
        iframe.src = iframe.src;
        btnReload.classList.add('spinning');
        setTimeout(() => btnReload.classList.remove('spinning'), 400);
        closeOverlay();
    };

    // ── URL toggle button (🌐) ──
    const btnToggle = overlay.querySelector('.btn-hotswap-toggle');
    const urlRow = overlay.querySelector('.hotswap-url-row');
    btnToggle.onclick = () => {
        btnToggle.classList.toggle('active');
        urlRow.classList.toggle('open');
    };

    const urlInput = urlRow.querySelector('.hotswap-input');
    const submitBtn = urlRow.querySelector('.hotswap-submit-btn');
    urlInput.value = iframe.src;

    submitBtn.onclick = () => {
        const newUrl = urlInput.value.trim();
        if (newUrl && !isBlacklisted(newUrl)) {
            iframe.src = newUrl;
            State.set(`screenUrl_${screenIndex}`, newUrl);
            urlRow.classList.remove('open');
            btnToggle.classList.remove('active');
        }
        closeOverlay();
    };

    urlInput.onkeypress = (e) => {
        if (e.key === 'Enter') submitBtn.onclick();
    };

    // ── Kill button (close menu) ──
    const btnKill = overlay.querySelector('.btn-hotswap-kill');
    btnKill.onclick = closeOverlay;
}

function _renderPanels(urls, map, ctx) {
    SLOT_IDS.forEach((id, index) => {
        const slot = document.getElementById(id);
        slot.querySelector('.stream-panel')?.remove();

        const panel = _buildStreamPanel(urls[index] || 'https://example.com', index);
        slot.appendChild(panel);

        // Store in state for later access
        State.set(`screenUrl_${index}`, urls[index]);
        State.set(`screenFolder_${index}`, map[index] || '');
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
