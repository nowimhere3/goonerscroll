# Phase 4B

## Goal

Launch Runtime using a specific Workspace.

---

## Major Changes

Workspace launching now passes:

?workspace=<id>

Runtime loads the requested preset.

Grid no longer falls back to random URLs.

Undo behavior became consistent.

Runtime stopped writing back into Workspace state.

---

## Key Architectural Change

Runtime became isolated.

Workspace became persistent.

The two no longer shared mutable state.

---

## Lessons

Always load presets before Runtime initialization.

Never allow Runtime rendering to overwrite Workspace data.

Separate launch context from editing context.
