Current Baseline

Phase 4A: Complete
Phase 4B: Complete
Phase 4C: In Progress

Current architectural direction:

- Runtime Session owns all runtime state.
- Grid never writes to Store.
- Save Session As serializes Runtime Session.
- Presentation state is separate from content state.
- Position swaps must never reload iframes.
- Layout belongs to presentation state.
