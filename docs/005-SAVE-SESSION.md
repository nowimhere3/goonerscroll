# Save Session

Save Session serializes Runtime.

It does not inspect UI.

It does not inspect the DOM.

It does not rebuild state.

---

## Save Session As

A Save Session should capture:

URLs

Folder assignments

Presentation

Arrangement

Layout

Panel state

Future runtime metadata

---

## Not Included

Bookmarks

Database changes

Blacklist

Repository operations

GitHub synchronization

These belong to separate systems.

---

## Session Ownership

Every runtime action must update Runtime Session.

Examples:

Master Shuffle

Panel Shuffle

Manual URL edits

Folder assignment

Position swaps

Launchpad loading

Kill panel

When Save Session executes, Runtime should already contain the complete answer.

Serialization becomes trivial.
