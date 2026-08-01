# Runtime Events

## Purpose

Runtime Events are observable occurrences inside a running Runtime.

They do not perform work themselves.

They notify the Automation Engine that something happened.

---

## Philosophy

Events answer the question:

"What just happened?"

Actions answer the question:

"What should happen next?"

These are intentionally separate systems.

---

## Examples

Panel Loaded

Page Loaded

Page Failed

Video Started

Video Paused

Video Finished

Timer Elapsed

Panel Reloaded

Shuffle Completed

Folder Empty

Capability Changed

Automation Completed

Runtime Started

Runtime Stopped

Workspace Loaded

Panel Removed

Launchpad Loaded

---

## Event Payload

Each event should provide enough context for automations.

Example:

Event:
Video Finished

Payload:

Panel ID

Workspace ID

Collection

URL

Timestamp

Runtime Variables

Capability State

---

## Event Queue

Events are placed into a Runtime Event Queue.

Automations consume events from the queue.

This prevents recursive execution and allows deterministic processing.

---

## Future Events

Future runtime objects may generate events.

Examples:

Audio

Images

PDFs

Live Streams

Agents

Timers

Playlists

External APIs

The Automation Engine should not care where an event originated.

Only that it conforms to the Runtime Event interface.
