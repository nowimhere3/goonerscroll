# Runtime Invariants

These are architectural rules that should not be violated unless intentionally redesigned.

---

## Runtime Session

The Runtime Session is the single source of truth while a Grid/Stream/Solo session is running.

All runtime mutations update the Runtime Session first.

UI should render from Runtime Session.

Save Session serializes Runtime Session.

Undo restores Runtime Session.

No runtime feature should reconstruct state by inspecting the DOM.

---

## Content vs Presentation

Content State and Presentation State are separate.

Content includes:

- URLs
- Folder assignments
- Collections
- Runtime variables

Presentation includes:

- Panel arrangement
- Layout
- Orientation
- Visible positions

Changing presentation must never require content to reload.

---

## Panel Identity

A panel owns its content.

A slot owns its position.

Moving a panel between slots must never reload the iframe.

Position swaps should only change presentation state.

---

## Runtime Ownership

Every runtime action must update Runtime Session.

Examples:

✓ Master Shuffle

✓ Panel Shuffle

✓ Manual URL

✓ Folder Assignment

✓ Position Swap

✓ Kill Panel

✓ Launchpad

Everything that changes what the user is currently seeing belongs in Runtime Session.

---

## Undo

Undo is optional.

Session synchronization is mandatory.

Never couple the two.

---

## Workspace Editor

index.html is a design environment.

It never performs autonomous behavior.

It edits presets.

It does not execute them.

---

## Runtime

index3.html is the execution environment.

Timers

Automations

Agents

Runtime Events

Session State

All live behavior belongs here.

---

## Automations

Automations may only execute inside Runtime.

The Workspace Editor never executes automations.

A Workspace only becomes automatable once running inside Runtime.

---

## Future Direction

The Runtime Session will eventually contain:

- Panels
- Layout
- Collections
- Timers
- Automations
- Runtime Variables
- Agents
- Event Queue

Everything live modifies this object.
