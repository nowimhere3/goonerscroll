/**
 * undo-stack.js — Stream Loop Launchpad
 * ─────────────────────────────────────────────────────────────────────────────
 * A tiny, generic snapshot stack — no opinion on what a "snapshot" contains,
 * no opinion on Store/GitHub/workspaces. Just push/pop/clear with a max size.
 *
 * Used by:
 *   workspace.js    → one instance, snapshots of index.html's shared editing
 *                     surface (urls/folderMap/lockState)
 *   grid-session.js → a separate instance per Grid session, snapshots of the
 *                     in-memory working copy
 *
 * Keeping this generic (rather than writing the same push/cap/pop logic
 * twice) is the whole point — if Undo ever needs a size limit change, a
 * "clear on X" hook, or eventually Redo, there's one place to make that
 * change for every stack in the app, not two.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function createUndoStack(maxSize = 50) {
    let stack = [];

    return {
        push(snapshot) {
            stack.push(snapshot);
            if (stack.length > maxSize) stack.shift();
        },
        pop() {
            return stack.length ? stack.pop() : null;
        },
        peek() {
            return stack.length ? stack[stack.length - 1] : null;
        },
        canPop() {
            return stack.length > 0;
        },
        clear() {
            stack = [];
        },
        get size() {
            return stack.length;
        },
    };
}
