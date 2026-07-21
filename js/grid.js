/**
 * grid.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything related to the URL slot grid on the setup screen.
 *
 * Exports:
 *   initGrid(ctx)           — wires Add/Reset/Launch/Curated/Dice buttons
 *   renderInputRows()       — re-renders all URL slot rows (normal + curated)
 *   saveInputsToState()     — reads DOM inputs → updates targetUrls + Store
 *
 * Dependencies (via ctx):
 *   targetUrls, urlFolderMap, rowLockState, isCuratedMode, activeDragIdx
 *   isBlacklisted()         — blacklist.js
 *   buildFolderOptions()    — folders.js
 *   getDatabaseStructure()  — state.js
 *   Store                   — storage.js
 *
 * Design note — activeDragIdx:
 *   Must be module-scope (not render-local) so dragstart and drop closures
 *   on different rows share the same variable. This was the root cause of the
 *   original drag-drop snap-back bug.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Store } from './storage.js';
import { notifyWorkspaceEdited, pushUndoSnapshot, undo, canUndo } from './workspace.js';
import {
    getTargetUrls, setTargetUrls,
    getUrlFolderMap, setUrlFolderMap,
    getRowLockState, setRowLockState,
    getIsCuratedMode, setIsCuratedMode,
    getActiveDragIdx, setActiveDragIdx,
    getDatabaseStructure,
} from './state.js';
import { isBlacklisted } from './blacklist.js';
import { buildFolderOptions } from './folders.js';

// ── Module refs ───────────────────────────────────────────────────────────────
// Set by initGrid — avoids repeated getElementById calls
let _containerEl    = null;  // #url-fields-container
let _dirDropdown    = null;  // #directory-dropdown
let _portraitToggle = null;  // #portrait-mode-toggle
let _launchCallback = null;  // called with filtered URLs when Launch is clicked

// ── Save inputs ───────────────────────────────────────────────────────────────

/**
 * Read all .url-grid-field inputs from the DOM and write back to state + Store.
 * Also saves portraitMode, lockState, folderMap.
 * NOTE: does NOT touch gitToken/gitRepo — those are owned solely by
 * settings.html/settings.js now. This function used to also overwrite
 * them from #git-token/#git-repo inputs, but those inputs no longer
 * exist on index.html, so every call here was silently wiping the
 * saved credentials back to empty strings.
 */
/** Single funnel for "persist this grid state locally + notify workspace.js" —
 * used by saveInputsToState() and by the drag-reorder handler below, so
 * neither one can silently bypass workspace-aware sync (drag-reorder used to,
 * before this refactor). */
function _persistAndNotify(urls, folderMap, lockState) {
    pushUndoSnapshot(); // capture state as it was BEFORE this change
    Store.set('matrixUrls', urls);
    Store.set('folderMap', folderMap);
    Store.set('lockState', lockState);
    notifyWorkspaceEdited(urls, folderMap, lockState);
    _updateUndoButtonState();
}

/** Keep the Undo button's enabled/disabled state in sync with whether
 * there's actually anything to undo for the CURRENTLY active workspace. */
function _updateUndoButtonState() {
    const btn = document.getElementById('btn-undo');
    if (btn) btn.disabled = !canUndo();
}

export function saveInputsToState() {
    const inputs  = document.querySelectorAll('.url-grid-field');
    const urls    = [];
    inputs.forEach(input => urls.push(input.value.trim()));

    const folderMap = getUrlFolderMap();
    const lockState = getRowLockState();

    setTargetUrls(urls);
    Store.set('portraitMode', _portraitToggle?.checked ?? false);
    _persistAndNotify(urls, folderMap, lockState);
}

// ── Drag-drop helpers ─────────────────────────────────────────────────────────

function _clearDropIndicators() {
    _containerEl?.querySelectorAll('.url-row, .curated-row').forEach(r => {
        r.classList.remove('drop-above', 'drop-below');
    });
}

function _applyDragEvents(row, idx) {
    row.draggable = true;

    row.addEventListener('dragstart', (e) => {
        setActiveDragIdx(idx);
        setTimeout(() => row.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
    });

    row.addEventListener('dragend', () => {
        setActiveDragIdx(-1);
        row.classList.remove('dragging');
        _clearDropIndicators();
    });

    row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (idx === getActiveDragIdx()) return;
        _clearDropIndicators();
        const rect = row.getBoundingClientRect();
        row.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drop-above' : 'drop-below');
    });

    row.addEventListener('dragleave', (e) => {
        if (!row.contains(e.relatedTarget)) row.classList.remove('drop-above', 'drop-below');
    });

    row.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const srcIdx     = getActiveDragIdx();
        const tgtIdx     = idx;
        const insertAfter = row.classList.contains('drop-below');
        _clearDropIndicators();

        if (srcIdx === -1 || srcIdx === tgtIdx) return;

        const targetUrls  = getTargetUrls();
        const urlFolderMap = getUrlFolderMap();
        const rowLockState = getRowLockState();

        const urls    = [...targetUrls];
        const folders = [...targetUrls.keys()].map(i => urlFolderMap[i] || null);
        const locks   = [...targetUrls.keys()].map(i => rowLockState[i] || 0);

        const movedUrl    = urls.splice(srcIdx, 1)[0];
        const movedFolder = folders.splice(srcIdx, 1)[0];
        const movedLock   = locks.splice(srcIdx, 1)[0];

        let destIdx = srcIdx < tgtIdx ? tgtIdx - 1 : tgtIdx;
        if (insertAfter) destIdx += 1;
        destIdx = Math.max(0, Math.min(destIdx, urls.length));

        urls.splice(destIdx, 0, movedUrl);
        folders.splice(destIdx, 0, movedFolder);
        locks.splice(destIdx, 0, movedLock);

        const newFolderMap  = {};
        const newLockState  = {};
        folders.forEach((f, i) => { if (f) newFolderMap[i] = f; });
        locks.forEach((s, i)   => { if (s) newLockState[i] = s; });

        setTargetUrls(urls);
        setUrlFolderMap(newFolderMap);
        setRowLockState(newLockState);
        setActiveDragIdx(-1);

        // Save directly — do NOT call saveInputsToState() here because
        // it re-reads the DOM (still in old order) and overwrites the reordered array
        Store.set('matrixUrls', urls);
        Store.set('lockState', newLockState);
        Store.set('folderMap', newFolderMap);

        renderInputRows();
    });
}

// ── Lock button ───────────────────────────────────────────────────────────────

function _makeDragHandle() {
    const h = document.createElement('span');
    h.className   = 'row-drag-handle';
    h.textContent = '⠿';
    h.title       = 'Drag to reorder';
    h.onmousedown = (e) => e.stopPropagation();
    return h;
}

function _makeLockBtn(idx, row) {
    const btn = document.createElement('button');
    btn.className = 'btn-lock';

    const applyState = (s) => {
        row.classList.remove('is-url-locked', 'is-folder-locked');
        btn.classList.remove('url-locked', 'folder-locked');
        if (s === 1) {
            btn.textContent = '🔒';
            btn.title = 'URL Locked — shuffles skip this row.\nClick for Folder Lock.';
            btn.classList.add('url-locked');
            row.classList.add('is-url-locked');
        } else if (s === 2) {
            btn.textContent = '📁';
            btn.title = 'Folder Locked — shuffles pick from same folder only.\nClick to unlock.';
            btn.classList.add('folder-locked');
            row.classList.add('is-folder-locked');
        } else {
            btn.textContent = '🔓';
            btn.title = 'Unlocked. Click once for URL Lock 🔒, twice for Folder Lock 📁.';
        }
    };

    const rowLockState = getRowLockState();
    applyState(rowLockState[idx] || 0);

    btn.onclick = (e) => {
        e.stopPropagation();
        const current = getRowLockState();
        const next    = ((current[idx] || 0) + 1) % 3;
        current[idx]  = next;
        setRowLockState(current);
        applyState(next);
    };

    return btn;
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderInputRows() {
    if (!_containerEl) return;
    _containerEl.innerHTML = '';

    const targetUrls   = getTargetUrls();
    const urlFolderMap = getUrlFolderMap();
    const rowLockState = getRowLockState();
    const isCuratedMode = getIsCuratedMode();

    targetUrls.forEach((url, idx) => {
        const assignedFolder = urlFolderMap[idx] || '';
        const lockState      = rowLockState[idx] || 0;

        if (isCuratedMode) {
            // ── Curated row ──────────────────────────────────────────────────
            const row = document.createElement('div');
            row.className = 'curated-row'
                + (lockState === 1 ? ' is-url-locked'   : '')
                + (lockState === 2 ? ' is-folder-locked' : '');

            const top = document.createElement('div');
            top.className = 'curated-row-top';

            const handle = _makeDragHandle();

            const sel = document.createElement('select');
            sel.className = 'curated-folder-select';
            sel.innerHTML = buildFolderOptions(assignedFolder);
            if (lockState === 1 || lockState === 2) sel.style.pointerEvents = 'none';

            const lockBtn = _makeLockBtn(idx, row);

            const removeBtn = document.createElement('button');
            removeBtn.className   = 'btn btn-remove';
            removeBtn.textContent = '✕';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                saveInputsToState();
                const urls  = getTargetUrls();
                const fmap  = getUrlFolderMap();
                const lmap  = getRowLockState();
                urls.splice(idx, 1);
                delete fmap[idx];
                delete lmap[idx];
                setTargetUrls(urls);
                setUrlFolderMap(fmap);
                setRowLockState(lmap);
                renderInputRows();
                saveInputsToState(); // persist the removal itself
            };

            const preview = document.createElement('div');
            preview.className   = 'curated-url-preview';
            preview.textContent = url || '— no URL loaded yet —';

            const hiddenInput = document.createElement('input');
            hiddenInput.type      = 'hidden';
            hiddenInput.className = 'url-grid-field';
            hiddenInput.value     = url;
            hiddenInput.dataset.idx = idx;

            sel.onchange = () => {
                if (lockState === 1 || lockState === 2) return;
                const folder = sel.value;
                const db     = getDatabaseStructure();
                if (!folder || !db || !db[folder]) return;
                const pool   = db[folder].filter(u => !isBlacklisted(u));
                if (pool.length === 0) { alert('No available URLs in this folder.'); return; }
                const picked = pool[Math.floor(Math.random() * pool.length)];
                hiddenInput.value   = picked;
                preview.textContent = picked;
                const fmap = getUrlFolderMap();
                fmap[idx] = folder;
                setUrlFolderMap(fmap);
                saveInputsToState();
            };

            top.appendChild(handle);
            top.appendChild(sel);
            top.appendChild(lockBtn);
            top.appendChild(removeBtn);
            row.appendChild(top);
            row.appendChild(preview);
            row.appendChild(hiddenInput);
            _applyDragEvents(row, idx);
            _containerEl.appendChild(row);

        } else {
            // ── Normal row ───────────────────────────────────────────────────
            const row = document.createElement('div');
            row.className = 'url-row'
                + (lockState === 1 ? ' is-url-locked'   : '')
                + (lockState === 2 ? ' is-folder-locked' : '');
            row.style.cssText = 'display:flex; gap:8px; align-items:center;';

            const handle = _makeDragHandle();

            const input = document.createElement('input');
            input.type        = 'text';
            input.className   = 'url-input url-grid-field';
            input.value       = url;
            input.placeholder = 'https://...';
            input.dataset.idx = idx;
            input.draggable   = false;
            if (lockState === 1) input.readOnly = true;

            const lockBtn = _makeLockBtn(idx, row);

            const removeBtn = document.createElement('button');
            removeBtn.className   = 'btn btn-remove';
            removeBtn.textContent = '✕';
            removeBtn.onclick = () => {
                saveInputsToState();
                const urls = getTargetUrls();
                const lmap = getRowLockState();
                urls.splice(idx, 1);
                delete lmap[idx];
                setTargetUrls(urls);
                setRowLockState(lmap);
                renderInputRows();
                saveInputsToState(); // persist the removal itself
            };

            row.appendChild(handle);
            row.appendChild(input);
            row.appendChild(lockBtn);
            row.appendChild(removeBtn);
            _applyDragEvents(row, idx);
            _containerEl.appendChild(row);
        }
    });

    _updateUndoButtonState();
}

// ── Shuffle helpers ───────────────────────────────────────────────────────────

/**
 * Pick a random non-blacklisted URL from a folder pool,
 * respecting the 3-state lock for each slot.
 *
 * lock 0 → use provided pool
 * lock 1 → skip slot entirely
 * lock 2 → pick from slot's own assigned folder
 */
function _applyShuffleToInputs(inputs, getPoolForSlot) {
    const targetUrls   = getTargetUrls();
    const urlFolderMap = getUrlFolderMap();
    const rowLockState = getRowLockState();
    const db           = getDatabaseStructure();

    inputs.forEach((input, i) => {
        const lock = rowLockState[i] || 0;

        if (lock === 1) return; // URL locked — skip

        if (lock === 2) {
            // Folder locked — pick from this slot's own folder
            const folder = urlFolderMap[i];
            if (!folder || !db[folder]) return;
            const pool = db[folder].filter(u => !isBlacklisted(u));
            if (pool.length === 0) return;
            input.value     = pool[Math.floor(Math.random() * pool.length)];
            targetUrls[i]   = input.value;
            return;
        }

        const result = getPoolForSlot(i);
        if (!result) return;
        input.value   = result.url;
        targetUrls[i] = result.url;
        if (result.folder) urlFolderMap[i] = result.folder;
    });

    setTargetUrls(targetUrls);
    setUrlFolderMap(urlFolderMap);
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Wire up all grid controls. Call once after DOM is ready.
 *
 * @param {Object} ctx
 * @param {HTMLElement} ctx.containerEl      — #url-fields-container
 * @param {HTMLElement} ctx.dirDropdown      — #directory-dropdown
 * @param {HTMLElement} ctx.portraitToggle   — #portrait-mode-toggle
 * @param {Function}    ctx.launchCallback   — called with URLs when Launch pressed
 */
export function initGrid({ containerEl, dirDropdown, portraitToggle, launchCallback }) {
    _containerEl    = containerEl;
    _dirDropdown    = dirDropdown;
    _portraitToggle = portraitToggle;
    _launchCallback = launchCallback;

    // Undo
    document.getElementById('btn-undo')?.addEventListener('click', () => {
        const restored = undo();
        if (!restored) return;
        renderInputRows();
    });
    _updateUndoButtonState();

    // Add slot
    document.getElementById('add-field-btn')?.addEventListener('click', () => {
        saveInputsToState(); // commit anything already typed, and mark this as the undo point to return to
        const urls = getTargetUrls();
        urls.push('');
        setTargetUrls(urls);
        renderInputRows();
        saveInputsToState(); // persist the row that was just added
    });

    // Reset grid
    document.getElementById('clear-cache-btn')?.addEventListener('click', () => {
        if (!confirm('Clear matrix definitions?')) return;
        setTargetUrls(['', '', '']);
        setUrlFolderMap({});
        setRowLockState({});
        renderInputRows();
        saveInputsToState();
    });

    // Curated mode toggle
    document.getElementById('btn-curated-toggle')?.addEventListener('click', () => {
        const next = !getIsCuratedMode();
        setIsCuratedMode(next);
        const btn = document.getElementById('btn-curated-toggle');
        if (btn) {
            btn.classList.toggle('active', next);
            btn.textContent = next ? '🎯 Curated: ON' : '🎯 Curated';
        }
        renderInputRows();
    });

    // Launch button
    document.getElementById('launch-btn')?.addEventListener('click', () => {
        saveInputsToState();
        const active = getTargetUrls().filter(u => u.length > 0);
        if (active.length === 0) { alert('Please provide at least one valid stream destination.'); return; }
        if (typeof _launchCallback === 'function') _launchCallback(active);
    });

    // Solo mode button — navigate to index2.html with first URL
    document.getElementById('btn-solo-mode')?.addEventListener('click', () => {
        saveInputsToState();
        const active = getTargetUrls().filter(u => u.length > 0);
        const firstUrl = active.length > 0 ? active[0] : '';
        const param = firstUrl ? `?startUrl=${encodeURIComponent(firstUrl)}` : '';
        window.location.href = `index2.html${param}`;
    });

    // Main folder dropdown — fill slots from selected folder
    dirDropdown?.addEventListener('change', () => {
        const selected = dirDropdown.value;
        const db       = getDatabaseStructure();
        if (selected === 'manual' || !db) return;

        let sourcePool = [...db[selected]];
        const inputs   = document.querySelectorAll('.url-grid-field');
        const fmap     = getUrlFolderMap();

        _applyShuffleToInputs(inputs, (i) => {
            if (sourcePool.length === 0) return null;
            const randIdx = Math.floor(Math.random() * sourcePool.length);
            const url     = sourcePool.splice(randIdx, 1)[0];
            fmap[i] = selected;
            return { url, folder: selected };
        });

        setUrlFolderMap(fmap);
        saveInputsToState();
        if (getIsCuratedMode()) renderInputRows();
    });

    // Single-folder dice
    document.getElementById('dice-shuffle-btn')?.addEventListener('click', () => {
        const db = getDatabaseStructure();
        if (!db) { alert('Please connect your GitHub database pool before using the shuffle engine.'); return; }

        const folders = Object.keys(db);
        if (folders.length === 0) return;

        const randomFolder = folders[Math.floor(Math.random() * folders.length)];
        if (dirDropdown) dirDropdown.value = randomFolder;

        let sourcePool = [...db[randomFolder]].filter(u => !isBlacklisted(u));
        if (sourcePool.length === 0) { alert('All URLs in the selected folder are blacklisted.'); return; }

        const newFolderMap = {};
        const inputs = document.querySelectorAll('.url-grid-field');

        _applyShuffleToInputs(inputs, (i) => {
            if (sourcePool.length === 0) {
                sourcePool = [...db[randomFolder]].filter(u => !isBlacklisted(u));
            }
            const randIdx = Math.floor(Math.random() * sourcePool.length);
            const url     = sourcePool.splice(randIdx, 1)[0];
            newFolderMap[i] = randomFolder;
            return { url, folder: randomFolder };
        });

        // Merge newFolderMap (unlocked slots only) with existing
        const fmap = getUrlFolderMap();
        Object.assign(fmap, newFolderMap);
        setUrlFolderMap(fmap);
        saveInputsToState();
        if (getIsCuratedMode()) renderInputRows();
    });

    // Shuffle All dice
    document.getElementById('dice-shuffle-all-btn')?.addEventListener('click', () => {
        const db = getDatabaseStructure();
        if (!db) { alert('Please connect your GitHub database pool before using the shuffle engine.'); return; }

        const availableFolders = Object.keys(db).filter(f =>
            db[f].some(u => !isBlacklisted(u))
        );
        if (availableFolders.length === 0) { alert('No folders with available URLs found.'); return; }

        const inputs       = document.querySelectorAll('.url-grid-field');
        const slotCount    = inputs.length;
        const rowLockState = getRowLockState();
        const unlockedIdxs = [...Array(slotCount).keys()].filter(i => (rowLockState[i] || 0) === 0);

        const folderUsage = {};
        const slotFolders = {};

        unlockedIdxs.forEach(i => {
            let available = availableFolders.filter(f => (folderUsage[f] || 0) < 2);
            if (available.length === 0) available = availableFolders;
            const chosen = available[Math.floor(Math.random() * available.length)];
            folderUsage[chosen] = (folderUsage[chosen] || 0) + 1;
            slotFolders[i] = chosen;
        });

        const fmap = getUrlFolderMap();
        _applyShuffleToInputs(inputs, (i) => {
            const folder = slotFolders[i];
            if (!folder) return null;
            const pool   = db[folder].filter(u => !isBlacklisted(u));
            const url    = pool[Math.floor(Math.random() * pool.length)];
            fmap[i] = folder;
            return { url, folder };
        });

        setUrlFolderMap(fmap);
        if (dirDropdown) dirDropdown.value = 'manual';
        saveInputsToState();
        if (getIsCuratedMode()) renderInputRows();
    });
}
