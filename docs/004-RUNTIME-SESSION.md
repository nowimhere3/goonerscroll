# Runtime Session

The Runtime Session is the authoritative in-memory representation of a running Grid.

Everything visible should be represented here.

---

## Content

URLs

Folder assignments

Collections

Panel metadata

---

## Presentation

Arrangement

Layout

Orientation

Panel positions

---

## Responsibilities

Own runtime state.

Accept mutations.

Provide snapshots.

Serialize for saving.

Restore for loading.

Support Undo.

Support future Autosave.

---

## Rules

Never reconstruct Runtime from the DOM.

Never serialize Store.

Never serialize index.html.

Always serialize Runtime Session.
