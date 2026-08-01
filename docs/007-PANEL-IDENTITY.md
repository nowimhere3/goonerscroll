# Panel Identity

Every runtime panel has a permanent identity.

Identity is independent from:

- Screen position
- Layout
- Arrangement
- Workspace
- Collection

A panel may move between screen positions without changing identity.

---

## UUID

Each panel owns a UUID.

The UUID never changes during the lifetime of that panel.

The UUID survives:

- Position swaps
- Layout changes
- Session saves
- Session loads

The UUID represents the panel itself,
not where it is displayed.

---

## Slot Identity

A slot is presentation.

A panel is content.

Slots may exchange panels.

Panels never become slots.

---

## Future Uses

Panel UUIDs will enable:

- Runtime Events
- Timers
- Automation targets
- Agents
- Analytics
- Watch history
- Playback history
- Future synchronization

Every runtime object should eventually have a stable identity.
