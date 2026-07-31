# Session Serialization

## Purpose

Session Serialization converts the current Runtime Session into a persistent Workspace.

Serialization never inspects the UI.

Serialization never reconstructs state from the DOM.

Serialization simply records what Runtime already knows.

---

# Source of Truth

Serialization always reads from:

Runtime Session

Never from:

- Store
- DOM
- index.html
- Individual UI controls

If Runtime owns its state correctly, serialization becomes trivial.

---

# Serialized Content

A serialized session may include:

- URLs
- Folder assignments
- Collections
- Arrangement
- Slot mapping
- Layout
- Orientation
- Runtime metadata

As Runtime evolves, serialization evolves with it.

---

# Not Serialized

The following belong to other systems:

- Bookmarks
- Database modifications
- Blacklist
- GitHub synchronization
- Repository state
- Application settings

Serialization only captures Runtime.

---

# Save Session

"Save Session"

writes the current Runtime Session back to its originating Workspace.

---

# Save Session As

"Save Session As"

writes the current Runtime Session into another Workspace while leaving the original untouched.

After a successful Save Session As, the Runtime Session should consider the new Workspace its current owner.

---

# Future Uses

Session Serialization is also the foundation for:

- Autosave
- Crash Recovery
- Version History
- Cloud Sync
- Session Export
- Collaborative Runtime

These features should reuse the same serialization pipeline.
