/**
 * parser.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles drag-and-drop file ingestion and URL extraction.
 *
 * Exports:
 *   extractUrlsFromText(text)           — pure fn: text → clean URL array
 *   handleRawFileParse(file, ctx)       — reads a File object, extracts URLs,
 *                                         merges into databaseStructure, pushes
 *   initDropzone(dropzoneEl, fileInputEl, ctx) — wires drag/drop + click events
 *
 * The `ctx` (context) object passed to handleRawFileParse and initDropzone:
 *   {
 *     getDatabaseStructure,   // () => current db object
 *     setDatabaseStructure,   // (db) => void
 *     pushDatabaseToRemote,   // (msg) => Promise
 *     updateDirectoryDropdown,// () => void
 *     dirDropdown,            // DOM element — the main folder select
 *   }
 *
 * Why ctx instead of direct imports:
 *   parser.js runs before the database is populated. Passing a context object
 *   keeps this module free of circular import dependencies with sync.js and
 *   folders.js while still being fully testable in isolation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── URL Extraction ────────────────────────────────────────────────────────────

const URL_PATTERN = /https?:\/\/[^\s"'><`)]+/g;
const MIN_URL_LENGTH = 10;

// Characters that appear after a valid URL in dirty HTML/CSV content
const TRAILING_SPLIT_CHARS = ['"', "'", '>', '<'];

/**
 * Extract, clean, and deduplicate URLs from raw text.
 * Deduplication is within-batch only — the same URL can exist in different folders.
 *
 * @param {string} text — raw content of a dropped file
 * @returns {string[]} array of unique, clean URLs
 */
export function extractUrlsFromText(text) {
    const discovered = text.match(URL_PATTERN) || [];

    const cleaned = discovered.map(url => {
        let result = url;
        for (const char of TRAILING_SPLIT_CHARS) {
            result = result.split(char)[0];
        }
        return result;
    });

    return [...new Set(cleaned)].filter(url => url.length > MIN_URL_LENGTH);
}

// ── File Parser ───────────────────────────────────────────────────────────────

/**
 * Resolve which folder to import into.
 * Priority: typed name > dropdown selection > filename-derived fallback
 *
 * @param {File} file
 * @returns {string} folder name
 */
function _resolveTargetFolder(file) {
    const typedInput  = document.getElementById('target-folder-input');
    const selectEl    = document.getElementById('ingest-folder-select');

    const typed    = typedInput?.value.trim() || '';
    const selected = selectEl?.value || '';

    if (typed) return typed;
    if (selected) return selected;

    // Derive from filename — strip extension, replace non-alphanumeric with _
    const derived = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
    if (typedInput) typedInput.value = derived;
    return derived;
}

/**
 * Parse a dropped/selected file, extract URLs, merge into the database,
 * update the UI dropdown, and push to GitHub.
 *
 * @param {File} file
 * @param {Object} ctx — { getDatabaseStructure, setDatabaseStructure,
 *                         pushDatabaseToRemote, updateDirectoryDropdown, dirDropdown }
 */
export function handleRawFileParse(file, ctx) {
    const db = ctx.getDatabaseStructure();

    if (!db) {
        alert('Please configure and verify your GitHub Pipeline access parameters first.');
        return;
    }

    const folderName = _resolveTargetFolder(file);

    const reader = new FileReader();
    reader.onload = async (e) => {
        const urls = extractUrlsFromText(e.target.result);

        if (urls.length === 0) {
            alert('No valid URLs found in this file.');
            return;
        }

        if (!confirm(`Extracted ${urls.length} unique links.\nCommit into folder "${folderName}" on GitHub?`)) return;

        // Merge — allow cross-folder duplicates, skip exact dupes within this folder
        if (!db[folderName]) db[folderName] = [];
        const existingSet = new Set(db[folderName]);
        const newEntries  = urls.filter(u => !existingSet.has(u));
        db[folderName] = [...db[folderName], ...newEntries];
        ctx.setDatabaseStructure(db);

        ctx.updateDirectoryDropdown();
        if (ctx.dirDropdown) ctx.dirDropdown.value = folderName;

        await ctx.pushDatabaseToRemote(`Imported ${urls.length} links into folder: ${folderName}`);
    };
    reader.readAsText(file);
}

// ── Dropzone Wiring ───────────────────────────────────────────────────────────

/**
 * Wire up drag-and-drop and click-to-browse on the ingest dropzone.
 *
 * @param {HTMLElement} dropzoneEl
 * @param {HTMLInputElement} fileInputEl
 * @param {Object} ctx — same context object as handleRawFileParse
 */
export function initDropzone(dropzoneEl, fileInputEl, ctx) {
    if (!dropzoneEl || !fileInputEl) return;

    dropzoneEl.onclick = () => fileInputEl.click();

    dropzoneEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzoneEl.classList.add('dragover');
    });

    dropzoneEl.addEventListener('dragleave', () => {
        dropzoneEl.classList.remove('dragover');
    });

    dropzoneEl.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzoneEl.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleRawFileParse(e.dataTransfer.files[0], ctx);
        }
    });

    fileInputEl.onchange = () => {
        if (fileInputEl.files.length > 0) {
            handleRawFileParse(fileInputEl.files[0], ctx);
        }
    };
}
