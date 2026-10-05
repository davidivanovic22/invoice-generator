/**
 * Per-document undo/redo. Edits that arrive in quick succession (typing) are
 * coalesced into one step, so Ctrl+Z undoes a word or a change, not a letter.
 */
export class DocHistory<T> {
  private entries = new Map<string, { past: T[]; future: T[]; lastAt: number }>();

  constructor(private coalesceMs = 900, private limit = 100) {}

  private entry(id: string) {
    let entry = this.entries.get(id);
    if (!entry) {
      entry = { past: [], future: [], lastAt: 0 };
      this.entries.set(id, entry);
    }
    return entry;
  }

  /** Call with the document as it was before an edit. */
  record(id: string, previous: T, now = Date.now()) {
    const entry = this.entry(id);
    if (entry.past.length === 0 || now - entry.lastAt > this.coalesceMs) {
      entry.past.push(previous);
      if (entry.past.length > this.limit) entry.past.shift();
    }
    entry.future = [];
    entry.lastAt = now;
  }

  undo(id: string, current: T): T | undefined {
    const entry = this.entry(id);
    const previous = entry.past.pop();
    if (previous === undefined) return undefined;
    entry.future.push(current);
    entry.lastAt = 0;
    return previous;
  }

  redo(id: string, current: T): T | undefined {
    const entry = this.entry(id);
    const next = entry.future.pop();
    if (next === undefined) return undefined;
    entry.past.push(current);
    entry.lastAt = 0;
    return next;
  }

  canUndo(id: string) {
    return (this.entries.get(id)?.past.length ?? 0) > 0;
  }

  canRedo(id: string) {
    return (this.entries.get(id)?.future.length ?? 0) > 0;
  }
}
