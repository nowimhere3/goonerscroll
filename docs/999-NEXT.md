# Next

This document tracks upcoming work.

Items are grouped by architectural phase rather than priority.

---

# Phase 1 — Runtime Foundation (Current)

## Runtime Session

- [ ] Finish Runtime Session ownership
- [ ] Finish Session Serialization
- [ ] Verify every runtime action updates Runtime Session
- [ ] Confirm Runtime as the single source of truth
- [ ] Investigate GitHub sync failure (after Runtime Session is complete)

---

# Phase 2 — Runtime Polish

## User Experience

- [ ] 🖥 Quick Action shortcut
- [ ] Quick Favourite
- [ ] Favourite Panel collection
- [ ] Runtime zoom in/out
- [ ] Adjustable (stream) runtime panel borders

---

# Phase 3 — Runtime Intelligence

## Runtime Systems

- [ ] Capability detection
- [ ] Runtime Events
- [ ] Timer engine
- [ ] Automation engine

---

# Phase 4 — Library Improvements

## Collections

- [ ] Move Blacklist into Settings
- [ ] Move "Ingest Extracted Directories" into Settings
- [ ] Paste-from-clipboard ingest mode
- [ ] Skip selected collections during Shuffle
- [ ] Less-played shuffle mode
- [ ] Shuffle weighting algorithms
- [ ] Favourite collections

---

# Phase 5 — Architecture

## Runtime Separation

- [ ] Extract Stream Runtime from index.html
- [ ] Separate Design-Time from Runtime
- [ ] Make all Runtime executors siblings

Prerequisites:

- Runtime Session complete
- Timer engine complete
- Automation engine underway

---

# Phase 6 — Long-Term

- [ ] Agent framework
- [ ] Media capability scanner
- [ ] NEAR integration

---

# Deferred

Ideas intentionally postponed until the architecture is ready.

- Advanced Runtime Events
- Cloud synchronization
- Autosave
- Crash recovery
- Version history
- Collaborative Runtime

These features should be built on top of Runtime Session rather than before it.
