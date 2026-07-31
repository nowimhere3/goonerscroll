# Terminology

This document defines the project's core architectural language.

These definitions should remain stable over time.

---

# Workspace

A persistent editable design.

A Workspace describes a future Runtime.

A Workspace never executes.

---

# Runtime

A live executing Workspace.

Runtime owns the Runtime Session.

Timers, Events, Automations and Agents execute here.

---

# Runtime Session

The authoritative in-memory state of a live Runtime.

Everything currently visible should be represented here.

---

# Panel

A Panel owns content.

Examples:

- URL
- Workspace
- Future runtime object

Panels should not own presentation.

---

# Slot

A Slot owns presentation.

Slots determine where Panels appear.

Panels may move between Slots without changing their content.

---

# Content

Information describing what a Panel contains.

Examples:

- URLs
- Folder assignments
- Collections
- Runtime variables

---

# Presentation

Information describing how Panels are displayed.

Examples:

- Layout
- Arrangement
- Orientation
- Visibility

Presentation should never require content reloads.

---

# Design-Time

The editing environment.

Currently represented by:

index.html

Responsibilities:

- Edit Workspaces
- Configure layouts
- Organize collections

Design-Time never performs autonomous behavior.

---

# Runtime Executor

A page responsible for executing a Runtime.

Current executors:

- index.html (Stream Runtime)
- index2.html (Solo Runtime)
- index3.html (Grid Runtime)

Long-term these should become sibling runtimes.

---

# Layer 1

A Runtime launched directly by the user.

Layer 1 establishes the primary execution environment.

---

# Layer 2

A Runtime executing inside another Runtime.

Layer 2 enables nested execution and Runtime composition.

Only Layer 2 objects participate in Runtime automation.

---

# Collection

A logical grouping of content.

Collections may eventually support:

- Favorites
- Shuffle weighting
- Skip rules
- Automation rules

---

# Folder

A storage grouping used for content organization.

Folders provide the source material for Runtime behavior.

---

# Automation

A rule executed by Runtime.

Automations only execute inside Runtime.

Design-Time never executes automations.

---

# Runtime Event

A significant occurrence within Runtime.

Examples:

- Timer fired
- Panel loaded
- Panel completed
- Shuffle completed
- User interaction

Automations respond to Runtime Events.

---

# Agent

An autonomous system capable of interacting with Runtime.

Agents observe Runtime Events and perform Runtime actions.

Agents never bypass the Runtime Session.
