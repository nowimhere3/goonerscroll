/**
 * settings.js — Settings Page
 * Boots all settings panels for settings.html.
 * All panels are expanded by default — no drawer toggling.
 */

import { Store } from './storage.js';
import { fetchDatabaseWithUI, fetchDatabaseSilently } from './sync.js';
import { renderFolderManager } from './folders.js';
import { HOTSWAP_ACTIONS } from './launch.js';

document.addEventListener('DOMContentLoaded', () => {
    Store.warmCache();
    bootSettings();
});

async function bootSettings() {

    // ── Restore persisted git credentials ─────────────────────────────────────
    const gitTokenEl = document.getElementById('git-token');
    const gitRepoEl  = document.getElementById('git-repo');
    if (gitTokenEl) gitTokenEl.value = Store.get('gitToken') || '';
    if (gitRepoEl)  gitRepoEl.value  = Store.get('gitRepo')  || '';

    // ── Connect & Fetch button ────────────────────────────────────────────────
    const connectBtn = document.getElementById('btn-connect-git');
    if (connectBtn) {
        connectBtn.onclick = async () => {
            const token = gitTokenEl?.value.trim() || '';
            const repo  = gitRepoEl?.value.trim()  || '';
            Store.set('gitToken', token);
            Store.set('gitRepo',  repo);
            const success = await fetchDatabaseWithUI(_refreshFolderManager);
            if (success) {
                _refreshFolderManager();
            }
        };
    }

    // ── Frame Height Settings ─────────────────────────────────────────────────
    _initFrameHeightSettings();

    // ── Hotswap Overlay Controls ───────────────────────────────────────────────
    _initHotswapControls();

    // ── Auto-fetch database if credentials are saved ──────────────────────────
    if (Store.get('gitToken') && Store.get('gitRepo')) {
        await fetchDatabaseSilently(_refreshFolderManager);
    }

    // Initial folder manager render
    _refreshFolderManager();
}

function _refreshFolderManager() {
    renderFolderManager(null, _refreshFolderManager);
}

function _initFrameHeightSettings() {
    const fhLandscapeInput  = document.getElementById('fh-landscape-input');
    const fhPortraitInput   = document.getElementById('fh-portrait-input');
    const fhSpacerToggle    = document.getElementById('fh-spacer-toggle');
    const fhSpacerInput     = document.getElementById('fh-spacer-input');
    const fhSpacerTopToggle = document.getElementById('fh-spacer-top-toggle');
    const fhSpacerTopInput  = document.getElementById('fh-spacer-top-input');

    if (fhLandscapeInput)  fhLandscapeInput.value    = Store.get('fhLandscape');
    if (fhPortraitInput)   fhPortraitInput.value     = Store.get('fhPortrait');
    if (fhSpacerToggle)    fhSpacerToggle.checked    = Store.get('spacerEndOn');
    if (fhSpacerInput)     fhSpacerInput.value       = Store.get('spacerEndHeight');
    if (fhSpacerTopToggle) fhSpacerTopToggle.checked = Store.get('spacerTopOn');
    if (fhSpacerTopInput)  fhSpacerTopInput.value    = Store.get('spacerTopHeight');

    const applyBtn = document.getElementById('btn-fh-apply');
    if (applyBtn) {
        applyBtn.onclick = () => {
            const land      = parseFloat(fhLandscapeInput?.value);
            const port      = parseFloat(fhPortraitInput?.value);
            const spacerH   = parseFloat(fhSpacerInput?.value);
            const spacerTopH = parseFloat(fhSpacerTopInput?.value);

            if (isNaN(land)       || land < 10      || land > 300)      { alert('Landscape height must be 10–300 vh.'); return; }
            if (isNaN(port)       || port < 10      || port > 300)      { alert('Portrait height must be 10–300 vh.');  return; }
            if (isNaN(spacerH)    || spacerH < 5    || spacerH > 300)   { alert('End spacer must be 5–300 vh.');        return; }
            if (isNaN(spacerTopH) || spacerTopH < 5 || spacerTopH > 300){ alert('Top spacer must be 5–300 vh.');       return; }

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

            alert(`Saved! Landscape: ${land}vh · Portrait: ${port}vh\nTakes effect on next Launch.`);
        };
    }

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

function _initHotswapControls() {
    const toggleListEl   = document.getElementById('hotswap-toggle-list');
    const slotCountRowEl = document.getElementById('slot-count-row');
    const pickersEl      = document.getElementById('quick-slot-pickers');
    if (!toggleListEl || !slotCountRowEl || !pickersEl) return;

    const visibility = { ...Store.get('hotswapButtonVisibility') };
    let quickSlots    = [...(Store.get('quickActionSlots') || [])];

    const shortcutableActions = HOTSWAP_ACTIONS.filter((a) => a.shortcutable);

    function _renderToggleList() {
        toggleListEl.innerHTML = '';
        HOTSWAP_ACTIONS.forEach(({ key, emoji, title }) => {
            const isShortcut = quickSlots.includes(key);
            const row = document.createElement('div');
            row.className = 'hotswap-toggle-row';
            row.innerHTML = `
                <span class="hotswap-toggle-label">
                    <span class="hotswap-toggle-emoji">${emoji}</span>${title}
                    ${isShortcut ? '<span class="hotswap-shortcut-badge">Quick Action</span>' : ''}
                </span>
                <label class="switch" style="margin:0;">
                    <input type="checkbox" data-key="${key}" ${visibility[key] !== false ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;
            row.querySelector('input').onchange = (e) => {
                visibility[key] = e.target.checked;
                Store.set('hotswapButtonVisibility', visibility);
            };
            toggleListEl.appendChild(row);
        });
    }

    function _renderSlotCountButtons() {
        slotCountRowEl.querySelectorAll('.btn-slot-count').forEach((btn) => {
            btn.classList.toggle('active', parseInt(btn.dataset.count, 10) === quickSlots.length);
        });
    }

    function _renderSlotPickers() {
        pickersEl.innerHTML = '';
        for (let i = 0; i < quickSlots.length; i += 1) {
            const row = document.createElement('div');
            row.className = 'quick-slot-picker-row';

            const label = document.createElement('label');
            label.textContent = `Slot ${i + 1}`;

            const select = document.createElement('select');
            select.className = 'quick-slot-select';

            const noneOpt = document.createElement('option');
            noneOpt.value = '';
            noneOpt.textContent = '— none —';
            select.appendChild(noneOpt);

            shortcutableActions.forEach(({ key, emoji, title }) => {
                // Don't offer an action already picked in a DIFFERENT slot
                const takenElsewhere = quickSlots.some((v, idx) => v === key && idx !== i);
                if (takenElsewhere) return;
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = `${emoji} ${title}`;
                if (quickSlots[i] === key) opt.selected = true;
                select.appendChild(opt);
            });

            select.onchange = () => {
                quickSlots[i] = select.value;
                Store.set('quickActionSlots', quickSlots);
                _renderToggleList();
                _renderSlotPickers(); // refresh exclusion sets across slots
            };

            row.appendChild(label);
            row.appendChild(select);
            pickersEl.appendChild(row);
        }
    }

    slotCountRowEl.querySelectorAll('.btn-slot-count').forEach((btn) => {
        btn.onclick = () => {
            const newCount = parseInt(btn.dataset.count, 10);
            const next = [];
            for (let i = 0; i < newCount; i += 1) next.push(quickSlots[i] || '');
            quickSlots = next;
            Store.set('quickActionSlots', quickSlots);
            _renderSlotCountButtons();
            _renderSlotPickers();
            _renderToggleList();
        };
    });

    _renderToggleList();
    _renderSlotCountButtons();
    _renderSlotPickers();
}
