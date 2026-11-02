// The order photos appear in on the big screen. Safe to import from client components.

export function shuffled<T>(items: T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shows every photo once in random order, then reshuffles, so none repeats before all have been
 * seen. A new upload joins the photos still to come, at a random place.
 */
export class PhotoOrder {
  private known = new Set<string>();
  private queue: string[] = [];

  constructor(private rand: () => number = Math.random) {}

  /** Brings in the current list of ids: drops removed photos and mixes in new ones. */
  sync(ids: string[]) {
    const now = new Set(ids);
    this.queue = this.queue.filter((id) => now.has(id));
    for (const id of ids) {
      if (this.known.has(id)) continue;
      this.queue.splice(Math.floor(this.rand() * (this.queue.length + 1)), 0, id);
    }
    this.known = now;
  }

  /** The next photo to show, never the one on screen unless it is the only one. */
  next(current: string | null): string | null {
    if (!this.known.size) return null;
    if (!this.queue.length) {
      this.queue = shuffled([...this.known], this.rand);
      if (this.queue.length > 1 && this.queue[0] === current) this.queue.push(this.queue.shift()!);
    }
    return this.queue.shift()!;
  }
}
