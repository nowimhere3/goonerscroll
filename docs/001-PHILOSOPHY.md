# Project Philosophy

This project is not a browser.

It is a Runtime Orchestration Engine.

The browser panels are simply one type of runtime object.

---

## Design First

Every feature should simplify future development.

Avoid quick patches.

Prefer architectural fixes.

---

## Runtime First

Never ask:

"How do we save this?"

Instead ask:

"What does Runtime currently believe?"

Save simply serializes Runtime.

---

## Single Source of Truth

There should never be multiple competing sources of truth.

Runtime owns runtime.

Workspace owns design.

GitHub owns persistence.

Each layer has one responsibility.

---

## Stable Foundations

Every new feature should emerge naturally from the architecture.

Examples:

Autosave

Crash Recovery

Version History

Cloud Sync

Agents

Automations

All should be straightforward once Runtime owns state.

---

## User Experience

The application should eventually feel alive.

The user should spend less time managing panels and more time consuming content.

Clicks should decrease over time.

Automation should increase over time.

The goal is to reduce friction, not add configuration.

---

## Runtime Over Features

Whenever possible:

Improve architecture.

Not just UI.

Architecture compounds.

UI changes frequently.

Good architecture lasts.
