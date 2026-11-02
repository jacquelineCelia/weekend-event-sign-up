// What the big screen shows next. Safe to import from client components.

export type OrderItem = { id: string; fresh: boolean; uploaded: number };

/**
 * Goes through the list and starts again. A photo that hasn't been shown yet goes first, oldest
 * upload first, then the show returns to where it was; the photo also has its normal place in the
 * list, for later rounds.
 */
export class PhotoOrder {
  private ids: string[] = [];
  private index = -1; // the photo last reached in the list; -1 before the first
  private fresh: OrderItem[] = []; // not yet shown, next up
  private taken = new Set<string>(); // handed out here, though the server may not have heard yet

  /** Brings in the current list. If the current photo is gone, the next one is whichever followed it. */
  sync(items: OrderItem[]) {
    const ids = items.map((x) => x.id);
    this.fresh = items.filter((x) => x.fresh && !this.taken.has(x.id)).sort((a, b) => a.uploaded - b.uploaded);
    if (this.index >= 0) {
      const survivor = this.ids.slice(this.index).find((id) => ids.includes(id));
      const at = survivor ? ids.indexOf(survivor) : ids.length;
      this.index = survivor === this.ids[this.index] ? at : at - 1;
    }
    this.ids = ids;
  }

  next(): string | null {
    const fresh = this.fresh.shift();
    if (fresh) {
      this.taken.add(fresh.id);
      return fresh.id;
    }
    if (!this.ids.length) return null;
    this.index = (this.index + 1) % this.ids.length;
    return this.ids[this.index];
  }
}
