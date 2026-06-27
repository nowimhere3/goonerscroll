/**
 * folders.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything related to folder/playlist management in the UI.
 *
 * Exports:
 *   updateDirectoryDropdown()        — refreshes all folder dropdowns from db
 *   buildFolderOptions(selected)     — returns HTML option string for a <select>
 *   exportFolder(folderName, urls)   — downloads folder URLs as .txt
 *   deleteFolder(folderName, rowEl)  — confirms, removes from db, pushes, animates row out
 *   renderFolderManager()            — renders the Folder Manager card list with drag-reorder
 *   initFolderManagerDrawer()        — wires the Show/Hide drawer toggle
 *
 * Dependencies (injected via ctx or direct imports):
 *   getDatabaseStructure / setDatabaseStructure  — state.js
 *   pushDatabaseToRemote                         — sync.js
 *   reorderDatabase                              — sync.js
 *
 * Why ctx for some functions:
 *   renderFolderManager calls reorderDatabase and updateDirectoryDropdown
 *   internally. These are passed as a ctx object to avoid circular imports
 *   between folders.js ↔ sync.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getDatabaseStructure, setDatabaseStructure } from './state.js';
import { pushDatabaseToRemote } from './sync.js';

// ── Dropdown helpers ──────────────────────────────────────────────────────────

/**
 * Repopulate all folder dropdowns from the current databaseStructure.
 * Targets:
 *   - #directory-dropdown    (main grid folder picker)
 *   - #ingest-folder-select  (ingest panel)
 *   - #bm-folder-select      (bookmark modal — populated separately on open)
 *
 * Also triggers re-render of the Folder Manager list if it's open,
 * and re-renders curated input rows if curated mode is active.
 *
 * @param {HTMLElement} dirDropdownEl       — the main #directory-dropdown element
 * @param {Function}    [onAfterUpdate]     — optional callback (used by grid.js to re-render curated rows)
 * @param {boolean}     [folderManagerOpen] — whether the Folder Manager drawer is open
 */
export function updateDirectoryDropdown(dirDropdownEl, onAfterUpdate, folderManagerOpen) {
    const db = getDatabaseStructure();
    if (!db || !dirDropdownEl) return;

    dirDropdownEl.innerHTML = '';
    const ingestSelect = document.getElementById('ingest-folder-select');
    if (ingestSelect) ingestSelect.innerHTML = '<option value="">— select existing folder —</option>';

    Object.keys(db).forEach(folderName => {
        const count = db[folderName].length;
        const label = `${folderName} (${count})`;

        const opt = document.createElement('option');
        opt.value = folderName;
        opt.textContent = label;
        dirDropdownEl.appendChild(opt);

        if (ingestSelect) {
            const opt2 = document.createElement('option');
            opt2.value = folderName;
            opt2.textContent = label;
            ingestSelect.appendChild(opt2);
        }
    });

    if (folderManagerOpen) renderFolderManager(dirDropdownEl, onAfterUpdate);
    if (typeof onAfterUpdate === 'function') onAfterUpdate();
}

/**
 * Build an HTML string of <option> elements for a folder <select>.
 * Includes link counts. Pre-selects `selectedFolder` if provided.
 *
 * @param {string} [selectedFolder]
 * @returns {string} HTML option string
 */
export function buildFolderOptions(selectedFolder) {
    const db = getDatabaseStructure();
    let opts = '<option value="">— pick a folder —</option>';
    if (!db) return opts;

    Object.keys(db).forEach(f => {
        const count = db[f].length;
        const sel   = f === selectedFolder ? ' selected' : '';
        opts += `<option value="${f}"${sel}>${f} (${count})</option>`;
    });

    return opts;
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Download all URLs in a folder as a plain .txt file, one URL per line.
 *
 * @param {string}   folderName
 * @param {string[]} urls
 */
export function exportFolder(folderName, urls) {
    const blob = new Blob([urls.join('\n')], { type: 'text/plain' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `${folderName.replace(/[^a-zA-Z0-9_\-]/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Permanently delete a folder from the database.
 * Confirms first, animates the row out, updates dropdowns, pushes to GitHub.
 *
 * @param {string}      folderName
 * @param {HTMLElement} rowEl          — the DOM row to animate out
 * @param {HTMLElement} dirDropdownEl  — passed through to updateDirectoryDropdown
 * @param {Function}    [onAfterUpdate]
 */
export async function deleteFolder(folderName, rowEl, dirDropdownEl, onAfterUpdate) {
    const db    = getDatabaseStructure();
    const count = (db[folderName] || []).length;

    if (!confirm(
        `Permanently delete folder "${folderName}" and all ${count} links from the database?\n\nThis cannot be undone.`
    )) return;

    delete db[folderName];
    setDatabaseStructure(db);

    // Animate row out
    rowEl.style.transition = 'opacity 0.3s, transform 0.3s';
    rowEl.style.opacity    = '0';
    rowEl.style.transform  = 'translateX(20px)';
    setTimeout(() => rowEl.remove(), 300);

    updateDirectoryDropdown(dirDropdownEl, onAfterUpdate);
    await pushDatabaseToRemote(`Deleted folder: ${folderName}`);
}

// ── Folder Manager Renderer ───────────────────────────────────────────────────

/**
 * Render the Folder Manager list with drag-to-reorder, Export, and Delete per row.
 *
 * @param {HTMLElement} dirDropdownEl
 * @param {Function}    [onAfterUpdate]
 */
export function renderFolderManager(dirDropdownEl, onAfterUpdate) {
    const list = document.getElementById('folder-manager-list');
    const db   = getDatabaseStructure();

    if (!list) return;

    if (!db || Object.keys(db).length === 0) {
        list.innerHTML = '<div class="folder-manager-empty">Connect your GitHub database to manage folders.</div>';
        return;
    }

    list.innerHTML = '';
    let dragSrc = null;

    Object.keys(db).forEach(folderName => {
        const urls  = db[folderName];
        const count = urls.length;

        const row = document.createElement('div');
        row.className  = 'folder-manager-row';
        row.draggable  = true;
        row.dataset.folder = folderName;

        // Drag handle
        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '⠿';
        handle.title = 'Drag to reorder';

        const nameEl = document.createElement('div');
        nameEl.className   = 'folder-manager-name';
        nameEl.textContent = folderName;

        const countEl = document.createElement('div');
        countEl.className   = 'folder-manager-count';
        countEl.textContent = `${count} link${count !== 1 ? 's' : ''}`;

        const exportBtn = document.createElement('button');
        exportBtn.className   = 'btn-fm-export';
        exportBtn.textContent = '⬇ Export';
        exportBtn.onclick = () => exportFolder(folderName, urls);

        const deleteBtn = document.createElement('button');
        deleteBtn.className   = 'btn-fm-delete';
        deleteBtn.textContent = '🗑 Delete';
        deleteBtn.onclick = () => deleteFolder(folderName, row, dirDropdownEl, onAfterUpdate);

        row.appendChild(handle);
        row.appendChild(nameEl);
        row.appendChild(countEl);
        row.appendChild(exportBtn);
        row.appendChild(deleteBtn);

        // Drag events
        row.addEventListener('dragstart', (e) => {
            dragSrc = row;
            row.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', folderName);
        });

        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            list.querySelectorAll('.folder-manager-row').forEach(r => r.classList.remove('drag-over'));
        });

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (row !== dragSrc) {
                list.querySelectorAll('.folder-manager-row').forEach(r => r.classList.remove('drag-over'));
                row.classList.add('drag-over');
            }
        });

        row.addEventListener('dragleave', () => row.classList.remove('drag-over'));

        row.addEventListener('drop', async (e) => {
            e.preventDefault();
            row.classList.remove('drag-over');
            if (!dragSrc || dragSrc === row) return;

            // Reorder DOM rows
            const rows   = [...list.querySelectorAll('.folder-manager-row')];
            const srcIdx = rows.indexOf(dragSrc);
            const tgtIdx = rows.indexOf(row);
            list.insertBefore(dragSrc, srcIdx < tgtIdx ? row.nextSibling : row);

            // Rebuild db key order to match DOM
            const newOrder  = [...list.querySelectorAll('.folder-manager-row')].map(r => r.dataset.folder);
            const reordered = {};
            newOrder.forEach(key => { if (db[key] !== undefined) reordered[key] = db[key]; });
            setDatabaseStructure(reordered);

            updateDirectoryDropdown(dirDropdownEl, onAfterUpdate, true);
            await pushDatabaseToRemote('Reordered folders via drag-and-drop', true);
        });

        list.appendChild(row);
    });
}

// ── Drawer toggle ─────────────────────────────────────────────────────────────

/**
 * Wire up the Folder Manager drawer show/hide toggle button.
 * Re-renders the list when opened so it always reflects current db state.
 *
 * @param {HTMLElement} dirDropdownEl
 * @param {Function}    [onAfterUpdate]
 */
export function initFolderManagerDrawer(dirDropdownEl, onAfterUpdate) {
    const btn     = document.getElementById('btn-toggle-fm-drawer');
    const content = document.getElementById('fm-drawer-content');
    if (!btn || !content) return;

    btn.onclick = () => {
        const isOpen = content.style.display === 'block';
        content.style.display = isOpen ? 'none' : 'block';
        btn.textContent = isOpen ? '📋 Show Folders' : '✕ Hide Folders';
        if (!isOpen) renderFolderManager(dirDropdownEl, onAfterUpdate);
    };
}

// ── Bookmark modal folder list ────────────────────────────────────────────────

/**
 * Populate the bookmark modal's folder dropdown with current folders + counts.
 * Called each time the modal opens.
 */
export function populateBookmarkFolderSelect() {
    const sel = document.getElementById('bm-folder-select');
    if (!sel) return;

    const db = getDatabaseStructure();
    sel.innerHTML = '<option value="">— select a folder —</option>';
    if (!db) return;

    Object.keys(db).forEach(folder => {
        const count = db[folder].length;
        const opt   = document.createElement('option');
        opt.value       = folder;
        opt.textContent = `${folder} (${count})`;
        sel.appendChild(opt);
    });
}
