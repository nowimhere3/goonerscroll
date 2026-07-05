const STORAGE_KEY = 'goonerscroll_enabled';
const HOST_ID = 'goonerscroll-shadow-host';

function getHtmlTemplate() {
  return `
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    #solo-container { position:fixed; left:0; right:0; bottom:0; z-index:2147483647; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; }
    #control-bar { background:#161616; border-top:2px solid #2d2d2d; padding:12px 16px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; box-shadow:0 -4px 12px rgba(0,0,0,.5); color:#fff; }
    .solo-btn{ border:1px solid #333; padding:10px 14px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px; background:#222; color:#fff; white-space:nowrap; }
    .solo-btn.folder-btn{ background:#1a2a3a; border-color:#0095f6; color:#0095f6; }
    .solo-btn.fave-btn{ background:#2a1a3a; border-color:#7c4dff; color:#7c4dff; }
    .solo-btn.purge-btn{ background:#3a1a1a; border-color:#ff6b6b; color:#ff6b6b; }
    .solo-btn.delete-btn{ background:#3a1a1a; border-color:#ed4956; color:#ed4956; }
    .solo-btn.shuffle-btn{ background:#1a3a1a; border-color:#4caf50; color:#4caf50; }
    .folder-btn-container{ position:relative; }
    .folder-dropdown{ position:absolute; bottom:calc(100% + 8px); left:0; background:#1e1e1e; border:1px solid #333; border-radius:8px; max-height:300px; overflow-y:auto; z-index:1000; min-width:180px; display:none; }
    .folder-dropdown.open{ display:block; }
    .folder-dropdown-item{ padding:10px 14px; cursor:pointer; border-bottom:1px solid #2d2d2d; font-size:13px; color:#fff; }
    .folder-count{ color:#666; font-size:11px; margin-left:8px; }
    #bookmark-modal{ display:none; position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:10000; align-items:center; justify-content:center; }
    #bookmark-modal.open{ display:flex; }
    .bookmark-card{ background:#161616; border:1px solid #2d2d2d; border-radius:16px; padding:24px; max-width:400px; width:90%; color:#fff; }
    .bm-url-preview{ background:#1e1e1e; border:1px solid #333; border-radius:8px; padding:12px; margin:16px 0; font-size:12px; color:#aaa; word-break:break-all; max-height:80px; overflow-y:auto; }
    .bm-folder-select,.bm-new-folder-input{ width:100%; background:#222; border:1px solid #333; padding:10px 12px; color:#fff; border-radius:8px; font-size:13px; margin-bottom:12px; }
    .bm-actions{ display:flex; gap:10px; margin-top:20px; }
    .bm-actions button{ flex:1; padding:10px 14px; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px; }
    .btn-bm-cancel{ background:#2a2a2a; color:#aaa; }
    .btn-bm-save{ background:#7c4dff; color:#fff; }
    #status-message{ font-size:11px; color:#666; margin-right:8px; }
    .back-link{ color:#fff; text-decoration:none; font-size:14px; cursor:pointer; padding:8px 12px; border-radius:6px; display:flex; align-items:center; justify-content:center; width:28px; height:28px; background:#222; border:1px solid #333; }
  </style>

  <div id="solo-container">
    <div id="control-bar">
      <span id="status-message">Loading...</span>
      <a class="back-link" id="back-link" href="#" title="Extension active">⚙</a>

      <div class="folder-btn-container">
        <button class="solo-btn folder-btn" id="btn-folder">🌐 Folder ▼</button>
        <div class="folder-dropdown" id="folder-dropdown"></div>
      </div>

      <button class="solo-btn fave-btn" id="btn-favorite">☆ Favorite</button>
      <button class="solo-btn purge-btn" id="btn-purge">🗑️ Purge</button>
      <button class="solo-btn delete-btn" id="btn-delete-replace">❌ Delete & Replace</button>
      <button class="solo-btn shuffle-btn" id="btn-shuffle">🎲 Shuffle</button>
      <button class="solo-btn shuffle-btn" id="btn-shuffle-all">🎲 Shuffle All</button>
    </div>
  </div>

  <div id="bookmark-modal">
    <div class="bookmark-card">
      <h3>⭐ Save to Playlist</h3>
      <div class="bm-url-preview" id="bm-url-preview"></div>
      <label>Choose existing folder</label>
      <select class="bm-folder-select" id="bm-folder-select"><option value="">— select a folder —</option></select>
      <label>Or create a new folder</label>
      <input type="text" class="bm-new-folder-input" id="bm-new-folder-input" placeholder="New playlist name...">
      <div class="bm-actions">
        <button class="btn-bm-cancel" id="btn-bm-cancel">Cancel</button>
        <button class="btn-bm-save" id="btn-bm-save">⭐ Save</button>
      </div>
    </div>
  </div>
  `;
}

async function inject() {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const wrap = document.createElement('div');
  wrap.innerHTML = getHtmlTemplate();
  shadow.appendChild(wrap);

  const mod = await import(chrome.runtime.getURL('../js/single-mode.js'));
  mod.bootstrapSingleMode(shadow);
}

function remove() {
  document.getElementById(HOST_ID)?.remove();
}

async function applyEnabled() {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  const enabled = !!res[STORAGE_KEY];
  if (enabled) await inject();
  else remove();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'GOONERSCROLL_TOGGLE') {
    if (msg.enabled) inject();
    else remove();
  }
});

applyEnabled();
