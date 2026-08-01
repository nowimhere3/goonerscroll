# Runtime Invariants

These are architectural rules.

They are expected to remain true unless intentionally redesigned.

Features should conform to these rules.

If a feature appears to require violating one of these invariants, the architecture should be reconsidered before implementation.

---

# Single Source of Truth

Every layer has exactly one owner.

Workspace owns design.

Runtime owns execution.

GitHub owns persistence.

Store owns user preferences.

Collections own media libraries.

No state should have multiple competing owners.

---

# Runtime Session

The Runtime Session is the authoritative in-memory representation of a running session.

Everything currently visible belongs to Runtime Session.

Every runtime mutation updates Runtime Session first.

UI renders from Runtime Session.

Save Session serializes Runtime Session.

Undo restores Runtime Session.

The DOM is never treated as state.

---

# Runtime Ownership

Every runtime action updates Runtime Session.

Examples include:

- Master Shuffle
- Panel Shuffle
- Manual URL edits
- Folder assignment
- Position swaps
- Kill panel
- Launchpad
- Runtime variables

If the user can currently see it, Runtime Session owns it.

---

# Working Copies

Launching a Workspace creates a working copy.

The running Runtime Session is not the Workspace itself.

It is an isolated execution copy.

Changes remain local until the user explicitly saves.

This applies equally to:

- Saved Workspaces
- The Live Builder

Runtime must never silently modify its source Workspace.

---

# Runtime Boot

Runtime copies its initial state exactly once.

After initialization:

Workspace is no longer consulted.

Runtime owns itself.

All subsequent changes belong only to Runtime Session.

---

# Content vs Presentation

Content State and Presentation State are independent.

Content includes:

- Panels
- URLs
- Folder assignments
- Collections
- Runtime variables

Presentation includes:

- Layout
- Arrangement
- Orientation
- Visible screen positions

Changing presentation must never require content to reload.

---

# Panel Identity

A panel owns its content.

A slot owns its position.

A panel may move between slots without changing identity.

Position swaps modify presentation only.

The panel itself never changes ownership.

---

# Undo

Undo is optional.

Runtime synchronization is mandatory.

Undo must never become the mechanism that keeps Runtime synchronized.

The Runtime Session is always updated regardless of whether Undo exists.

---

# Serialization

Saving serializes Runtime Session.

Loading reconstructs Runtime Session.

Serialization never inspects:

- DOM
- Store
- Workspace
- UI

Runtime already contains the complete answer.

---

# Workspace Editor

The Workspace Editor is a design environment.

It edits Workspaces.

It does not execute them.

It never performs autonomous behavior.

---

# Runtime

Runtime is the execution environment.

Timers

Automations

Runtime Events

Agents

Session State

Live orchestration

All runtime behavior belongs here.

---

# Automations

Automations execute only inside Runtime.

The Workspace Editor never executes automation.

A Workspace becomes automatable only after Runtime has been launched.

---

# Future Direction

Runtime Session is expected to eventually own:

- Panels
- Layout
- Arrangement
- Collections
- Runtime Variables
- Timers
- Runtime Events
- Agents
- Event Queue

Everything that is alive belongs here.
