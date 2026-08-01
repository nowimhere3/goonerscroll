# Automations

## Purpose

Automations describe what Runtime should do when Runtime Events occur.

Automations only execute inside Runtime.

They never execute inside the Workspace Editor.

---

## Philosophy

Runtime Events answer:

"What happened?"

Automations answer:

"What should happen because it happened?"

---

## Basic Structure

IF

Runtime Event

AND

Conditions

THEN

Execute Actions

---

## Example

IF

Video Finished

AND

Repeat = On

THEN

Reload Panel

---

## Example

IF

Video Finished

AND

Reload Count >= 3

THEN

Shuffle Collection

---

## Example

IF

Timer Elapsed

THEN

Launch Workspace 4

---

## Example

IF

Panel Failed

THEN

Reload

WAIT 5 Seconds

IF Failed Again

THEN

Shuffle

---

## Runtime Variables

Automations may reference Runtime Variables.

Examples

Repeat Count

Reload Count

Time Watched

Panels Remaining

Random Value

Current Workspace

Current Collection

Current Folder

Current Capability

---

## Future Actions

Examples include:

Reload Panel

Shuffle

Shuffle All

Launch Workspace

Launch Stream

Launch Solo

Load Collection

Move Panel

Enable Timer

Disable Timer

Pause Runtime

Resume Runtime

Set Runtime Variable

Call Agent

Trigger Webhook

Run Script

---

## Design Goals

Automations should be:

Predictable

Composable

Serializable

Independent of UI

Independent of panel implementation

Everything should execute from Runtime Session.
