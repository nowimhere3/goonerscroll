/**
 * scroll.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * The auto-scroll engine and all playback controls.
 *
 * Exports:
 *   initScrollEngine(ctx)   — wires all button/keyboard controls, returns
 *                             { startScrolling, stopScrolling, isScrolling }
 *   startScrolling()        — begin rAF loop
 *   stopScrolling()         — cancel rAF loop
 *   jumpNext()              — snap to next panel
 *   jumpPrev()              — snap to previous panel
 *   increaseSpeed()         — +0.05 speed
 *   decreaseSpeed()         — -0.05 speed
 *   updateSpeedLabel()      — refresh #speed-label text
 *
 * Why the scroll loop is performance-sensitive:
 *   smoothScrollLoop() runs inside requestAnimationFrame — up to 60 calls/sec.
 *   It must read scrollSpeed and isScrolling from local variables, not from
 *   Store (disk) or even State getters with overhead. These are kept as
 *   module-local vars that are synced to State on write, not on read.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Store } from './storage.js';
import {
    getScrollSpeed, setScrollSpeed,
    getIsScrolling, setIsScrolling,
    getAnimationFrameId, setAnimationFrameId,
    getAccurateYPosition, setAccurateYPosition,
} from './state.js';

// ── Module-local vars (perf: avoid getter overhead in rAF loop) ───────────────
let _scrollSpeed       = getScrollSpeed();
let _isScrolling       = false;
let _animationFrameId  = null;
let _accurateYPosition = 0;

// DOM refs — set by initScrollEngine
let _toggleBtn    = null;
let _speedLabel   = null;
let _loopScreenEl = null;

// ── Core loop ─────────────────────────────────────────────────────────────────

function _smoothScrollLoop() {
    if (!_isScrolling) return;

    _accurateYPosition += _scrollSpeed;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    if (_accurateYPosition >= maxScroll - 2) {
        _accurateYPosition = 0;
        window.scrollTo(0, 0);
    } else {
        window.scrollTo(0, Math.floor(_accurateYPosition));
    }

    _animationFrameId = requestAnimationFrame(_smoothScrollLoop);
}

// ── Public controls ───────────────────────────────────────────────────────────

export function startScrolling() {
    _isScrolling       = true;
    _accurateYPosition = window.scrollY;

    setIsScrolling(true);
    setAccurateYPosition(_accurateYPosition);

    if (_toggleBtn) {
        _toggleBtn.textContent = '⏸ PAUSE';
        _toggleBtn.className   = 'pause';
    }

    _animationFrameId = requestAnimationFrame(_smoothScrollLoop);
    setAnimationFrameId(_animationFrameId);
}

export function stopScrolling() {
    _isScrolling = false;
    setIsScrolling(false);

    if (_animationFrameId) {
        cancelAnimationFrame(_animationFrameId);
        _animationFrameId = null;
        setAnimationFrameId(null);
    }

    if (_toggleBtn) {
        _toggleBtn.textContent = '▶ PLAY';
        _toggleBtn.className   = '';
    }
}

export function isScrollingNow() {
    return _isScrolling;
}

export function jumpNext() {
    const panelEl   = document.querySelector('.stream-panel');
    const viewHeight = panelEl ? panelEl.offsetHeight : window.innerHeight;
    const nextTarget = Math.floor((window.scrollY + 10) / viewHeight) + 1;
    _accurateYPosition = nextTarget * viewHeight;
    setAccurateYPosition(_accurateYPosition);
    window.scrollTo({ top: _accurateYPosition, behavior: 'smooth' });
}

export function jumpPrev() {
    const panelEl    = document.querySelector('.stream-panel');
    const viewHeight = panelEl ? panelEl.offsetHeight : window.innerHeight;
    const prevTarget = Math.ceil((window.scrollY - 10) / viewHeight) - 1;
    _accurateYPosition = Math.max(0, prevTarget * viewHeight);
    setAccurateYPosition(_accurateYPosition);
    window.scrollTo({ top: _accurateYPosition, behavior: 'smooth' });
}

export function increaseSpeed() {
    _scrollSpeed = Math.min(15, _scrollSpeed + 0.05);
    setScrollSpeed(_scrollSpeed);
    Store.set('scrollSpeed', _scrollSpeed);
    updateSpeedLabel();
}

export function decreaseSpeed() {
    _scrollSpeed = Math.max(0.05, _scrollSpeed - 0.05);
    setScrollSpeed(_scrollSpeed);
    Store.set('scrollSpeed', _scrollSpeed);
    updateSpeedLabel();
}

export function updateSpeedLabel() {
    if (_speedLabel) _speedLabel.textContent = `Speed: ${_scrollSpeed.toFixed(2)}x`;
}

export function getCurrentSpeed() {
    return _scrollSpeed;
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Wire up all scroll-related controls.
 * Call once after DOM is ready.
 *
 * @param {Object} ctx
 * @param {HTMLElement} ctx.loopScreenEl  — #loop-screen, used by keyboard guard
 */
export function initScrollEngine({ loopScreenEl } = {}) {
    _toggleBtn    = document.getElementById('toggle');
    _speedLabel   = document.getElementById('speed-label');
    _loopScreenEl = loopScreenEl || document.getElementById('loop-screen');

    // Restore persisted speed
    _scrollSpeed = getScrollSpeed();
    updateSpeedLabel();

    // Button wiring
    if (_toggleBtn) {
        _toggleBtn.onclick = () => {
            if (_isScrolling) stopScrolling(); else startScrolling();
        };
    }

    const nextBtn  = document.getElementById('next-page-btn');
    const prevBtn  = document.getElementById('prev-page-btn');
    const fasterBtn = document.getElementById('faster');
    const slowerBtn = document.getElementById('slower');

    if (nextBtn)   nextBtn.onclick   = jumpNext;
    if (prevBtn)   prevBtn.onclick   = jumpPrev;
    if (fasterBtn) fasterBtn.onclick = increaseSpeed;
    if (slowerBtn) slowerBtn.onclick = decreaseSpeed;

    // Keyboard shortcuts (only active when loop screen is visible)
    document.addEventListener('keydown', (e) => {
        if (_loopScreenEl && _loopScreenEl.style.display !== 'block') return;
        if (document.activeElement.tagName === 'INPUT') return;

        switch (e.key) {
            case ' ':
            case 'Spacebar':
                e.preventDefault();
                if (_isScrolling) stopScrolling(); else startScrolling();
                break;
            case 'ArrowUp':    e.preventDefault(); jumpPrev();      break;
            case 'ArrowDown':  e.preventDefault(); jumpNext();      break;
            case 'ArrowLeft':  e.preventDefault(); decreaseSpeed(); break;
            case 'ArrowRight': e.preventDefault(); increaseSpeed(); break;
        }
    });
}
