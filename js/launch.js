/**
 * launch.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds and launches the matrix of iframe panels.
 *
 * Exports:
 *   launchMatrix(urls, ctx)  — filters, builds panels, wires overlays, starts
 *
 * The `ctx` object:
 *   {
 *     setupScreenEl,     // #setup-screen
 *     loopScreenEl,      // #loop-screen
 *     feedContainerEl,   // #feed
 *     dirDropdownEl,     // #directory-dropdown
 *     portraitToggle,    // #portrait-mode-toggle checkbox
 *     statusEl,          // #status span
 *     getFrameHeights,   // () => { landscape, portrait, spacerTopOn, ... }
 *     openBookmarkModal, // (url, starBtn) => void
 *     stopScrolling,     // () => void  — from scroll.js
 *     updateSpeedLabel,  // () => void  — from scroll.js
 *   }
 *
 * Each iframe panel contains:
 *   - The iframe itself
 *   - A hotswap overlay with: 🖥 position swap, 📁 folder assign, ☆ star,
 *     🌐 URL edit, ⟳ reload, 🎲 shuffle, 🎲🎲 shuffle all, ❌ delete,
 *     ☠ kill, 🗑️ purge, 🚀 load Launchpad — each independently hideable via
 *     Settings, and (for the single-click ones) assignable as an always-
 *     visible Quick Action shortcut below the ··· trigger.
 *   - An IntersectionObserver for postMessage play/pause
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Store } from './storage.js';
import { getDatabaseStructure, setDatabaseStructure, getDatabaseSha, setDatabaseSha, getUrlFolderMap, setUrlFolderMap } from './state.js';
import { isBlacklisted, addToBlacklist } from './blacklist.js';
import { pushDatabaseToRemote } from './sync.js';

// Canonical list of every hotswap-overlay action. Drives both the tray
// (Overlay Button Visibility in Settings) and the Quick Action shortcut slots.
// `shortcutable: false` means the action opens its own picker/dropdown rather
// than firing immediately — those stay tray-only, since a tiny always-visible
// shortcut button isn't a good home for a full picker UI.
export const HOTSWAP_ACTIONS = [
    { key: 'position',   emoji: '🖥',  title: 'Swap position with another screen',                    className: 'btn-hotswap-position',    shortcutable: false },
    { key: 'folder',     emoji: '📁',  title: 'Assign a folder for this panel',                       className: 'btn-hotswap-folder',      shortcutable: false },
    { key: 'star',       emoji: '⭐',  title: 'Save to Playlist',                                     className: 'btn-hotswap-star',        shortcutable: true },
    { key: 'toggle',     emoji: '🌐',  title: 'Edit URL',                                             className: 'btn-hotswap-toggle',      shortcutable: false },
    { key: 'reload',     emoji: '⟳',  title: 'Reload this panel',                                    className: 'btn-hotswap-reload',      shortcutable: true },
    { key: 'shuffle',    emoji: '🎲',  title: "Shuffle from this panel's assigned folder",            className: 'btn-hotswap-shuffle',     shortcutable: true },
    { key: 'shuffleAll', emoji: '🎲🎲', title: 'Shuffle All — random URL from any folder',             className: 'btn-hotswap-shuffle-all', shortcutable: true },
    { key: 'delete',     emoji: '❌',  title: "Delete this URL from its folder and load a replacement", className: 'btn-hotswap-delete',      shortcutable: true },
    { key: 'kill',       emoji: '☠',  title: 'Remove this panel for this session',                   className: 'btn-hotswap-kill',        shortcutable: true },
    { key: 'purge',      emoji: '🗑️', title: 'Purge — blacklist domain and remove from all folders',  className: 'btn-purge',               shortcutable: true },
    { key: 'launchpad',  emoji: '🚀',  title: 'Load the Stream Loop Launchpad inside this panel',      className: 'btn-hotswap-launchpad',   shortcutable: true },
];

// ── Panel builder ─────────────────────────────────────────────────────────────

function _buildPanel(url, index, panelClass, panelHeight, ctx) {
    const db           = getDatabaseStructure();
    const urlFolderMap = getUrlFolderMap();

    const launchFolder = urlFolderMap[index]
        || (ctx.dirDropdownEl?.value !== 'manual' ? ctx.dirDropdownEl?.value : null)
        || null;

    // ── Panel shell ──────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.className   = panelClass;
    panel.style.height = panelHeight;

    // ── iframe ───────────────────────────────────────────────────────────────
    const iframe = document.createElement('iframe');
    iframe.src       = url;
    iframe.className = 'post-iframe';
    iframe.allow     = 'autoplay; fullscreen';
    iframe.sandbox   = 'allow-same-origin allow-scripts allow-forms allow-popups';
    iframe.setAttribute('data-last-src', url);
    iframe.setAttribute('data-source-folder', launchFolder || '');

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Get the folder this iframe was launched from */
    const getSourceFolder = () => iframe.getAttribute('data-source-folder') || null;

    /** Pick a random non-blacklisted URL from a folder */
    const loadReplacement = (folderName) => {
        if (!db || !db[folderName]) return null;
        const pool = db[folderName].filter(u => !isBlacklisted(u));
        return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
    };

    /** Sync iframe src, input field, and persisted URL list */
    const setIframeUrl = (newUrl) => {
        iframe.src = newUrl;
        iframe.setAttribute('data-last-src', newUrl);
        if (inputField) inputField.value = newUrl;
        // Update persisted URL list at this index
        const urls = JSON.parse(localStorage.getItem('loop_matrix_urls') || '[]');
        urls[index] = newUrl;
        Store.set('matrixUrls', urls);
    };

    // ── Overlay HTML ─────────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'hotswap-overlay';
    overlay.innerHTML = `
        <div class="hotswap-icon-row">
            <button class="btn-hotswap-position" title="Swap position with another screen">🖥</button>
            <button class="btn-hotswap-folder" title="Assign a folder for this panel">📁</button>
            <button class="btn-hotswap-star" title="Save to Playlist">☆</button>
            <button class="btn-hotswap-toggle" title="Edit URL">🌐</button>
            <button class="btn-hotswap-reload" title="Reload this panel">⟳</button>
            <button class="btn-hotswap-shuffle" title="Shuffle from this panel's assigned folder">🎲</button>
            <button class="btn-hotswap-shuffle-all" title="Shuffle All — random URL from any folder">🎲🎲</button>
            <button class="btn-hotswap-delete" title="Delete this URL from its folder and load a replacement">❌</button>
            <button class="btn-hotswap-kill" title="Remove this panel for this session">☠</button>
            <button class="btn-purge" title="Purge — blacklist domain and remove from all folders">🗑️</button>
            <button class="btn-hotswap-launchpad" title="Load the Stream Loop Launchpad inside this panel">🚀</button>
        </div>
        <div class="hotswap-position-row"></div>
        <div class="hotswap-folder-row"></div>
        <div class="hotswap-url-row">
            <input type="text" class="hotswap-input" value="${url}" placeholder="https://...">
            <button class="hotswap-submit-btn">✓</button>
        </div>
    `;

    const toggleBtn      = overlay.querySelector('.btn-hotswap-toggle');
    const urlRow         = overlay.querySelector('.hotswap-url-row');
    const inputField     = overlay.querySelector('.hotswap-input');
    const submitBtn      = overlay.querySelector('.hotswap-submit-btn');
    const starBtn        = overlay.querySelector('.btn-hotswap-star');
    const reloadBtn      = overlay.querySelector('.btn-hotswap-reload');
    const shuffleBtn     = overlay.querySelector('.btn-hotswap-shuffle');
    const shuffleAllBtn  = overlay.querySelector('.btn-hotswap-shuffle-all');
    const deleteBtn      = overlay.querySelector('.btn-hotswap-delete');
    const killBtn        = overlay.querySelector('.btn-hotswap-kill');
    const purgeBtn       = overlay.querySelector('.btn-purge');
    const positionBtn    = overlay.querySelector('.btn-hotswap-position');
    const positionRow    = overlay.querySelector('.hotswap-position-row');
    const folderBtn      = overlay.querySelector('.btn-hotswap-folder');
    const folderRow      = overlay.querySelector('.hotswap-folder-row');
    const launchpadBtn   = overlay.querySelector('.btn-hotswap-launchpad');

    // ── Overlay trigger (always-visible ··· button) ──────────────────────────
    const triggerBtn = document.createElement('button');
    triggerBtn.className   = 'hotswap-trigger';
    triggerBtn.textContent = '···';
    triggerBtn.title       = 'Open controls';

    triggerBtn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = overlay.classList.toggle('open');
        triggerBtn.classList.toggle('open', isOpen);
        triggerBtn.textContent = isOpen ? '✕' : '···';
    };

    // ── Button handlers ───────────────────────────────────────────────────────

    // 🖥 Position swap — only meaningful in contexts that provide these (e.g.
    // index3.html's triple-mode, where slots have a fixed clockwise ordering).
    // On index.html's free-form grid, ctx won't provide these, so the button
    // just hides itself.
    if (typeof ctx.getPositionOrder === 'function' && typeof ctx.swapWithSlot === 'function') {
        positionBtn.onclick = (e) => {
            e.stopPropagation();
            const isOpen = positionRow.classList.toggle('open');
            positionBtn.classList.toggle('active', isOpen);
            if (!isOpen) return;

            positionRow.innerHTML = '';
            const order = ctx.getPositionOrder(); // slot-indices in clockwise order
            order.forEach((slotIdx, i) => {
                if (slotIdx === index) return; // skip this panel's own position
                const positionNumber = i + 1;
                const item = document.createElement('div');
                item.className = 'hotswap-position-item';
                item.innerHTML = `<span>Swap with Screen ${positionNumber}</span>`;
                item.onclick = (ev) => {
                    ev.stopPropagation();
                    ctx.swapWithSlot(index, slotIdx);
                    positionRow.classList.remove('open');
                    positionBtn.classList.remove('active');
                };
                positionRow.appendChild(item);
            });
        };
    } else {
        positionBtn.style.display = 'none';
    }

    // 📁 Folder assign — manually pin this panel to a folder; shuffles in a
    // fresh link from it immediately, and future 🎲 Shuffles on this panel
    // (and the master overlay's own-folder Shuffle) will use it too.
    folderBtn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = folderRow.classList.toggle('open');
        folderBtn.classList.toggle('active', isOpen);
        if (!isOpen) return;

        folderRow.innerHTML = '';
        const currentDb = getDatabaseStructure();
        if (!currentDb || Object.keys(currentDb).length === 0) {
            folderRow.innerHTML = '<div class="hotswap-folder-item" style="cursor:default;">No folders available</div>';
            return;
        }

        Object.keys(currentDb).forEach((folderName) => {
            const item = document.createElement('div');
            item.className = 'hotswap-folder-item';
            item.innerHTML = `<span>${folderName}</span><span class="hotswap-folder-count">${currentDb[folderName].length}</span>`;
            item.onclick = (ev) => {
                ev.stopPropagation();
                iframe.setAttribute('data-source-folder', folderName);
                const newUrl = loadReplacement(folderName);
                if (newUrl) setIframeUrl(newUrl);
                setUrlFolderMap({ ...getUrlFolderMap(), [index]: folderName });
                folderRow.classList.remove('open');
                folderBtn.classList.remove('active');
            };
            folderRow.appendChild(item);
        });
    };

    // 🌐 URL edit toggle
    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = urlRow.classList.toggle('open');
        toggleBtn.classList.toggle('active', isOpen);
        if (isOpen) {
            inputField.value = iframe.getAttribute('data-last-src') || iframe.src;
            inputField.focus();
        }
    };

    const processHotswap = () => {
        const newUrl = inputField.value.trim();
        if (newUrl.length > 0) {
            setIframeUrl(newUrl);
            urlRow.classList.remove('open');
            toggleBtn.classList.remove('active');
        }
    };
    submitBtn.onclick  = (e) => { e.stopPropagation(); processHotswap(); };
    inputField.onkeydown = (e) => { if (e.key === 'Enter') { e.stopPropagation(); processHotswap(); } };

    // ☆ Star — open bookmark modal
    starBtn.onclick = (e) => {
        e.stopPropagation();
        if (typeof ctx.openBookmarkModal === 'function') {
            ctx.openBookmarkModal(iframe.getAttribute('data-last-src') || iframe.src, starBtn);
        }
    };

    // ⟳ Reload — soft reload without losing src
    reloadBtn.onclick = (e) => {
        e.stopPropagation();
        reloadBtn.classList.add('spinning');
        setTimeout(() => reloadBtn.classList.remove('spinning'), 450);
        const savedSrc = iframe.getAttribute('data-last-src') || iframe.src;
        iframe.src = 'about:blank';
        setTimeout(() => { iframe.src = savedSrc; }, 80);
    };

    // ☠ Kill — remove panel from session (no DB changes)
    killBtn.onclick = (e) => {
        e.stopPropagation();
        panel.style.transition = 'opacity 0.25s, transform 0.25s';
        panel.style.opacity    = '0';
        panel.style.transform  = 'scaleY(0.8)';
        setTimeout(() => {
            panel.remove();
            const remaining = ctx.feedContainerEl?.querySelectorAll('.stream-panel').length ?? 0;
            if (ctx.statusEl) ctx.statusEl.textContent = `${remaining} streams`;
        }, 250);
    };

    // 🎲 Shuffle — new URL from this panel's own assigned folder
    shuffleBtn.onclick = (e) => {
        e.stopPropagation();
        const folder = getSourceFolder();
        if (!folder) { alert('No source folder tracked for this panel. Use 🌐 to set a URL manually.'); return; }
        const newUrl = loadReplacement(folder);
        if (!newUrl) { alert('No available URLs in this folder (empty or all blacklisted).'); return; }
        setIframeUrl(newUrl);
    };

    // 🎲🎲 Shuffle All — random URL from ANY folder in the database
    shuffleAllBtn.onclick = (e) => {
        e.stopPropagation();
        const db = getDatabaseStructure();
        if (!db) { alert('No database connected.'); return; }
        const allFolders = Object.keys(db).filter(f => db[f].some(u => !isBlacklisted(u)));
        if (allFolders.length === 0) { alert('No available URLs across any folder.'); return; }
        const randomFolder = allFolders[Math.floor(Math.random() * allFolders.length)];
        const newUrl = loadReplacement(randomFolder);
        if (!newUrl) return;
        // Update source folder so future single-shuffles use the new folder
        iframe.setAttribute('data-source-folder', randomFolder);
        setIframeUrl(newUrl);
    };

    // ❌ Delete — remove URL from folder, load replacement, sync silently
    deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        const deadUrl = iframe.getAttribute('data-last-src') || iframe.src;
        const folder  = getSourceFolder();
        const currentDb = getDatabaseStructure();

        if (!folder || !currentDb || !currentDb[folder]) {
            alert('No source folder tracked for this panel — cannot delete.'); return;
        }

        const idx = currentDb[folder].indexOf(deadUrl);
        if (idx !== -1) currentDb[folder].splice(idx, 1);
        setDatabaseStructure(currentDb);

        const replacement = loadReplacement(folder);
        setIframeUrl(replacement || 'about:blank');
        await pushDatabaseToRemote(`Deleted URL from folder: ${folder}`, true);
    };

    // 🗑️ Purge — blacklist domain, remove from all folders, load replacement
    purgeBtn.onclick = async (e) => {
        e.stopPropagation();
        const deadUrl = iframe.getAttribute('data-last-src') || iframe.src;
        if (!confirm(
            `Confirm absolute deletion of link from repository records?\nThis will also blacklist the domain locally.\n\n${deadUrl}`
        )) return;

        addToBlacklist(deadUrl);

        const folder      = getSourceFolder();
        const currentDb   = getDatabaseStructure();
        const replacement = (folder && loadReplacement(folder)) || 'https://example.com';
        setIframeUrl(replacement);

        if (currentDb) {
            let deleted = false;
            Object.keys(currentDb).forEach(f => {
                const i = currentDb[f].indexOf(deadUrl);
                if (i !== -1) { currentDb[f].splice(i, 1); deleted = true; }
            });

            if (deleted) {
                setDatabaseStructure(currentDb);
                const token          = Store.get('gitToken');
                const repo           = Store.get('gitRepo');
                const updatedContent = btoa(unescape(encodeURIComponent(JSON.stringify(currentDb, null, 2))));
                try {
                    const res = await fetch(
                        `https://api.github.com/repos/${repo}/contents/links.json`,
                        {
                            method:  'PUT',
                            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
                            body:    JSON.stringify({
                                message: 'Purged dead link via Matrix Launcher',
                                content: updatedContent,
                                sha:     getDatabaseSha(),
                            }),
                        }
                    );
                    if (res.ok) setDatabaseSha((await res.json()).content.sha);
                } catch (err) { console.error('[Launch] Purge sync failed:', err); }
            }
        }
    };

    // 🚀 Load Launchpad inside this panel — unlike ⚙ (which navigates the whole
    // page away and ends the session), this only replaces THIS iframe's content
    // with a fresh Launchpad instance; every other panel keeps running.
    launchpadBtn.onclick = (e) => {
        e.stopPropagation();
        setIframeUrl('index.html');
    };

    // ── Overlay Button Visibility + Quick Action Shortcuts ────────────────────
    // Hide any button the user turned off in Settings, and pull out whichever
    // ones are assigned to a Quick Action slot (those move below ··· instead
    // of living in the tray — never both).
    const visibility = Store.get('hotswapButtonVisibility') || {};
    const quickSlots = (Store.get('quickActionSlots') || []).filter(Boolean);

    HOTSWAP_ACTIONS.forEach(({ key, className }) => {
        const btn = overlay.querySelector(`.${className}`);
        if (!btn) return;
        // Position swap already hid itself above on pages that don't support
        // it at all (e.g. plain index.html) — leave that alone either way.
        if (key === 'position' && typeof ctx.getPositionOrder !== 'function') return;
        const isShortcut  = quickSlots.includes(key);
        const trayVisible = visibility[key] !== false && !isShortcut;
        btn.style.display = trayVisible ? '' : 'none';
    });

    let shortcutRow = null;
    const eligibleShortcuts = quickSlots.filter((key) =>
        HOTSWAP_ACTIONS.find((a) => a.key === key)?.shortcutable
    );
    if (eligibleShortcuts.length > 0) {
        shortcutRow = document.createElement('div');
        shortcutRow.className = 'hotswap-shortcut-row';
        eligibleShortcuts.forEach((key) => {
            const action = HOTSWAP_ACTIONS.find((a) => a.key === key);
            const trayBtn = overlay.querySelector(`.${action.className}`);
            if (!trayBtn) return;
            const shortcutBtn = document.createElement('button');
            shortcutBtn.className = 'hotswap-shortcut-btn';
            shortcutBtn.title = action.title;
            shortcutBtn.textContent = action.emoji;
            shortcutBtn.onclick = (e) => {
                e.stopPropagation();
                trayBtn.click(); // reuses that action's exact existing handler
            };
            shortcutRow.appendChild(shortcutBtn);
        });
    }

    // ── Viewport Director (postMessage play/pause) ────────────────────────────
    const viewportObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const msg = entry.isIntersecting ? 'LAUNCHPAD_PLAY' : 'LAUNCHPAD_PAUSE';
            try { iframe.contentWindow.postMessage({ type: msg }, '*'); } catch (e) {}
        });
    }, { threshold: 0.5 });
    viewportObserver.observe(panel);

    // ── Assemble ─────────────────────────────────────────────────────────────
    panel.appendChild(iframe);
    panel.appendChild(triggerBtn);
    if (shortcutRow) panel.appendChild(shortcutRow);
    panel.appendChild(overlay);

    return panel;
}

/**
 * Reusable stream panel factory for alternative layouts (e.g. index3.html).
 * Wraps the internal panel builder so behavior stays identical.
 */
export function buildStreamPanel(url, index, panelClass, panelHeight, ctx) {
    return _buildPanel(url, index, panelClass, panelHeight, ctx);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Filter URLs against the blacklist, build all iframe panels,
 * wire overlays, and transition from setup screen to loop screen.
 *
 * @param {string[]} urls
 * @param {Object}   ctx  — see module header for shape
 */
export function launchMatrix(urls, ctx) {
    // Filter blacklisted
    const filtered = urls.filter(u => !isBlacklisted(u));
    const skipped  = urls.length - filtered.length;

    if (filtered.length === 0) {
        alert('All provided links are on the domain blacklist. Add new links or clear the blacklist.');
        return;
    }
    if (skipped > 0) console.info(`[Blacklist] Skipped ${skipped} blacklisted URL(s).`);

    const isPortrait  = ctx.portraitToggle?.checked ?? false;
    const heights     = ctx.getFrameHeights();
    const panelHeight = isPortrait ? heights.portrait : heights.landscape;
    const panelClass  = isPortrait ? 'stream-panel mode-portrait' : 'stream-panel mode-landscape';

    // Switch screens
    if (ctx.setupScreenEl)   ctx.setupScreenEl.style.display  = 'none';
    if (ctx.loopScreenEl)    ctx.loopScreenEl.style.display   = 'block';
    if (ctx.feedContainerEl) ctx.feedContainerEl.innerHTML    = '';

    // Top spacer
    if (heights.spacerTopOn) {
        const spacer = document.createElement('div');
        spacer.className   = 'spacer-panel';
        spacer.style.height = heights.spacerTopHeight;
        ctx.feedContainerEl.appendChild(spacer);
    }

    // Build panels
    filtered.forEach((url, index) => {
        const panel = _buildPanel(url, index, panelClass, panelHeight, ctx);
        ctx.feedContainerEl.appendChild(panel);
    });

    // End spacer
    if (heights.spacerOn) {
        const spacer = document.createElement('div');
        spacer.className   = 'spacer-panel';
        spacer.style.height = heights.spacerHeight;
        ctx.feedContainerEl.appendChild(spacer);
    }

    if (ctx.statusEl)      ctx.statusEl.textContent = `${filtered.length} streams`;
    if (ctx.updateSpeedLabel) ctx.updateSpeedLabel();
}
