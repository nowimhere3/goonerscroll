/**
 * index.js — Main entry point for index.html
 * Loads and boots the app.js module
 */

import('./app.js').catch(err => {
    console.error('[index.js] Failed to load app.js:', err);
});
