/**
 * content.js — GoonerScroll Chrome Extension (Manifest V3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Injected into every page. Manages the persistent bottom-bar overlay that
 * mirrors the Single Mode control bar from index2.html.
 *
 * Toggle key: chrome.storage.local key "enabled" (boolean).
 *   true  → overlay is shown
 *   false → overlay is hidden/removed
 *
 * Shadow DOM is used so the host page's CSS cannot affect the overlay styles.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Constants ─────────────────────────────────────────────────────────────────
const HOST_ID      = 'goonerscroll-overlay-host';
const STORAGE_KEY  = 'enabled';

// ── Overlay CSS (injected into the Shadow Root) ───────────────────────────────
const OVERLAY_CSS = `
  :host {
    all: initial;
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  }

  #control-bar {
    background: #161616;
    border-top: 2px solid #2d2d2d;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.5);
  }

  #status-message {
    font-size: 11px;
    color: #666;
    padding: 8px 12px;
    order: -1;
  }

  .solo-btn {
    border: 1px solid #333;
    padding: 10px 14px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    font-size: 13px;
    background: #222;
    color: #fff;
    transition: background 0.2s, border-color 0.2s, transform 0.1s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .solo-btn:active  { transform: scale(0.98); }
  .solo-btn:hover   { background: #2a2a2a; border-color: #555; }

  .folder-btn  { background: #1a2a3a; border-color: #0095f6; color: #0095f6; }
  .folder-btn:hover { background: #243a4a; border-color: #19a4f9; }

  .fave-btn    { background: #2a1a3a; border-color: #7c4dff; color: #7c4dff; }
  .fave-btn:hover   { background: #3a2a4a; border-color: #9d6dff; }
  .fave-btn.favorited { background: #7c4dff; color: #fff; }

  .purge-btn   { background: #3a1a1a; border-color: #ff6b6b; color: #ff6b6b; }
  .purge-btn:hover  { background: #4a2a2a; border-color: #ff8585; }

  .delete-btn  { background: #3a1a1a; border-color: #ed4956; color: #ed4956; }
  .delete-btn:hover { background: #4a2a2a; border-color: #ff6575; }

  .shuffle-btn { background: #1a3a1a; border-color: #4caf50; color: #4caf50; }
  .shuffle-btn:hover { background: #2a4a2a; border-color: #66bb6a; }

  .spacer-gap-full { width: 8px; flex-shrink: 0; }
  .spacer-gap-half { width: 4px; flex-shrink: 0; }

  .folder-btn-container { position: relative; }

  .folder-dropdown {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
    min-width: 180px;
    display: none;
  }
  .folder-dropdown.open { display: block; }

  .folder-dropdown-item {
    padding: 10px 14px;
    cursor: pointer;
    border-bottom: 1px solid #2d2d2d;
    transition: background 0.1s;
    font-size: 13px;
    color: #fff;
  }
  .folder-dropdown-item:hover { background: #2a2a2a; }
  .folder-dropdown-item:last-child { border-bottom: none; }

  #btn-shuffle-all { margin-right: 12px; }
`;

// ── Overlay HTML (faithful scaffold of index2.html #control-bar) ───────────────
const OVERLAY_HTML = `
  <div id="control-bar">
    <!-- Status: shows current folder / URL -->
    <span id="status-message">GoonerScroll</span>

    <!-- Folder selector -->
    <div class="folder-btn-container">
      <button class="solo-btn folder-btn" id="btn-folder" title="Select folder">🌐 Folder ▼</button>
      <div class="folder-dropdown" id="folder-dropdown"></div>
    </div>

    <!-- Favorite -->
    <button class="solo-btn fave-btn" id="btn-favorite" title="Save to playlist">☆ Favorite</button>

    <div class="spacer-gap-full"></div>

    <!-- Purge -->
    <button class="solo-btn purge-btn" id="btn-purge" title="Remove & load next">🗑️ Purge</button>

    <!-- Delete & Replace -->
    <button class="solo-btn delete-btn" id="btn-delete-replace" title="Remove & pick new folder">❌ Delete &amp; Replace</button>

    <div class="spacer-gap-full"></div>

    <!-- Shuffle current folder -->
    <button class="solo-btn shuffle-btn" id="btn-shuffle" title="Random from current folder">🎲 Shuffle</button>

    <!-- Shuffle all folders -->
    <button class="solo-btn shuffle-btn" id="btn-shuffle-all" title="Random from any folder">🎲 Shuffle All</button>
  </div>
`;

// ── Overlay lifecycle ─────────────────────────────────────────────────────────

/**
 * Inject the overlay into the page using a Shadow DOM host.
 * Guards against duplicate injection.
 */
function injectOverlay() {
    if (document.getElementById(HOST_ID)) return; // already injected

    const host = document.createElement('div');
    host.id = HOST_ID;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });

    // Styles
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    shadow.appendChild(style);

    // Markup
    const wrapper = document.createElement('div');
    // innerHTML used intentionally with static, hardcoded HTML strings (not user input)
    wrapper.innerHTML = OVERLAY_HTML;
    shadow.appendChild(wrapper);

    _wireButtons(shadow);
}

/**
 * Remove the overlay from the page if present.
 */
function removeOverlay() {
    const host = document.getElementById(HOST_ID);
    if (host) host.remove();
}

/**
 * Wire placeholder click handlers for the control buttons.
 * Full business logic (single-launch.js) will be integrated in a future step.
 *
 * @param {ShadowRoot} shadow
 */
function _wireButtons(shadow) {
    const btnFolder      = shadow.getElementById('btn-folder');
    const folderDropdown = shadow.getElementById('folder-dropdown');

    // Toggle the folder dropdown open/closed
    if (btnFolder && folderDropdown) {
        btnFolder.addEventListener('click', (e) => {
            e.stopPropagation();
            folderDropdown.classList.toggle('open');
        });

        // Close dropdown on outside click (listen on the document, not shadow)
        document.addEventListener('click', () => {
            folderDropdown.classList.remove('open');
        });
    }

    // Remaining buttons are scaffolded; handlers will be added in a later task
    // when single-launch.js is adapted for the extension context.
    const noopButtons = ['btn-favorite', 'btn-purge', 'btn-delete-replace', 'btn-shuffle', 'btn-shuffle-all'];
    noopButtons.forEach((id) => {
        const btn = shadow.getElementById(id);
        if (btn) btn.addEventListener('click', () => console.debug(`[GoonerScroll] ${id} clicked (not yet wired)`));
    });
}

// ── State synchronisation ─────────────────────────────────────────────────────

/**
 * Read the persisted enabled flag and show/hide the overlay accordingly.
 * Called once on page load.
 */
function applyStoredState() {
    // chrome.storage.local.get resolves asynchronously; defaults to disabled
    // so the overlay is not shown on first install until explicitly toggled on.
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY] === true) {
            injectOverlay();
        } else {
            removeOverlay();
        }
    });
}

/**
 * Listen for changes made by the popup (or any other extension context).
 * When the "enabled" key changes, reflect the new state on the current page
 * without requiring a full page refresh.
 */
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!(STORAGE_KEY in changes)) return;

    const newValue = changes[STORAGE_KEY].newValue;
    if (newValue === true) {
        injectOverlay();
    } else {
        removeOverlay();
    }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
applyStoredState();
