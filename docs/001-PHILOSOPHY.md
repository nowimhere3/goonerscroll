# Project Philosophy

This project is not a browser.

It is not a gallery.

It is not a bookmark manager.

It is a Runtime Orchestration Engine.

The browser is simply one runtime implementation.

---

# Architecture First

Every feature should improve the architecture.

Avoid temporary fixes.

Prefer structural improvements over local patches.

Good architecture compounds.

---

# Runtime First

Never ask:

"How should we save this?"

Instead ask:

"What does Runtime currently believe?"

Save becomes serialization.

Load becomes reconstruction.

Everything else follows naturally.

---

# Single Responsibility

Each major subsystem has one responsibility.

Workspace designs.

Runtime executes.

GitHub persists.

Collections organize media.

Settings configure behavior.

Reducing ownership overlap reduces complexity.

---

# Working Copies

A running Runtime Session is a working copy.

It is not the original Workspace.

Users should be free to experiment without risking the source.

Saving is an intentional action.

---

# Build Foundations

Features should emerge naturally from the architecture.

Examples include:

- Autosave
- Crash Recovery
- Session Restore
- Version History
- Cloud Sync
- Runtime Events
- Agents
- Automations

If a feature feels difficult to implement, improve the architecture first.

---

# Runtime Over UI

UI changes frequently.

Architecture changes rarely.

When choosing between improving architecture or improving UI, architecture usually produces greater long-term value.

The best UI is often a consequence of good architecture.

---

# Reduce Friction

The application should gradually require fewer user actions.

Automation should increase over time.

Manual work should decrease.

The software should eventually feel alive rather than reactive.

---

# Runtime Evolves

Runtime should become increasingly capable without increasing complexity.

Each new capability should integrate into the existing architecture rather than creating parallel systems.

Complex behavior should emerge from simple primitives.

---

# Design for the Future

Every major decision should make future development easier.

The goal is not simply to build features.

The goal is to build an engine that makes future features straightforward to implement.

Architecture is the product.

Features are consequences of the architecture.
