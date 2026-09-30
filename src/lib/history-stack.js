/**
 * Bounded undo/redo history of immutable snapshots (pure, no React).
 *
 * Pushes that arrive within `coalesceMs` of the previous push replace the
 * current entry instead of adding a new one, so dragging a marker produces one
 * undo step rather than hundreds.
 */
export class HistoryStack {
  constructor({ limit = 50, coalesceMs = 300 } = {}) {
    this.limit = limit;
    this.coalesceMs = coalesceMs;
    this.entries = [];
    this.index = 0;
    this.lastPushAt = 0;
  }

  /** Start over with a single baseline snapshot. */
  reset(snapshot) {
    this.entries = [snapshot];
    this.index = 0;
    this.lastPushAt = 0;
  }

  /** Drop all history (nothing to undo or redo). */
  clear() {
    this.entries = [];
    this.index = 0;
    this.lastPushAt = 0;
  }

  /** Record a new state, discarding any redo entries. */
  push(snapshot, now = Date.now()) {
    const rapid = now - this.lastPushAt < this.coalesceMs;
    this.lastPushAt = now;

    // Anything after the cursor is an abandoned redo branch.
    this.entries = this.entries.slice(0, this.index + 1);

    if (rapid && this.index > 0) {
      this.entries[this.index] = snapshot;
      return;
    }
    this.entries.push(snapshot);
    if (this.entries.length > this.limit) this.entries.shift();
    this.index = this.entries.length - 1;
  }

  /** @returns the previous snapshot, or null when there is nothing to undo */
  undo() {
    if (this.index <= 0) return null;
    this.index -= 1;
    return this.entries[this.index] ?? null;
  }

  /** @returns the next snapshot, or null when there is nothing to redo */
  redo() {
    if (this.index >= this.entries.length - 1) return null;
    this.index += 1;
    return this.entries[this.index] ?? null;
  }

  get canUndo() {
    return this.index > 0;
  }

  get canRedo() {
    return this.index < this.entries.length - 1;
  }
}
