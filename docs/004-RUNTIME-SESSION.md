# Runtime Session API

## Purpose

The Runtime Session is the authoritative in-memory representation of a live Runtime.

It is the single source of truth while a Runtime is executing.

Every visible state should exist here before it exists anywhere else.

The UI renders from the Runtime Session.

Persistence serializes the Runtime Session.

Undo restores the Runtime Session.

---

# Responsibilities

The Runtime Session owns:

- Runtime content
- Runtime presentation
- Runtime metadata
- Runtime snapshots

It does not own persistence.

It does not own GitHub synchronization.

It does not own Workspace editing.

---

# Content State

Content represents what each panel contains.

Examples:

- URLs
- Folder assignments
- Collections
- Runtime variables
- Future runtime metadata

Changing content may change what the user is viewing.

---

# Presentation State

Presentation represents how content is displayed.

Examples:

- Panel arrangement
- Slot assignments
- Layout
- Orientation
- Visibility

Presentation changes should never require iframe reloads.

---

# Mutation Rules

Every runtime action updates the Runtime Session.

Examples:

- Master Shuffle
- Panel Shuffle
- Manual URL edits
- Folder assignment
- Position swaps
- Launchpad loading
- Kill panel

The Runtime Session should never be reconstructed from the DOM.

---

# Snapshots

The Runtime Session provides snapshots for:

- Undo
- Save Session
- Autosave
- Crash Recovery
- Version History
- Future Cloud Sync

Snapshots are a capability of the Runtime Session.

They are not the Runtime Session itself.

---

# Future Extensions

The Runtime Session will eventually own:

- Panels
- Collections
- Timers
- Runtime Events
- Automations
- Runtime Variables
- Agents
- Event Queue

Future systems should integrate with the Runtime Session rather than creating new sources of truth.
