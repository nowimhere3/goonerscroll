/**
 * settings.js — Settings Page
 * Boots all settings panels for settings.html.
 * All panels are expanded by default — no drawer toggling.
 */

import { Store } from './storage.js';
import { fetchDatabaseWithUI, fetchDatabaseSilently } from './sync.js';
import { renderFolderManager } from './folders.js';

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
