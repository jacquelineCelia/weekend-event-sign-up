// Steps through the big-screen show in the feed's order. Safe to import from client components.

/** Goes through the list and starts again, keeping its place when photos are added or removed. */
export class PhotoOrder {
  private ids: string[] = [];
  private index = -1; // the photo last handed out; -1 before the first

  /** Brings in the current list. If the current photo is gone, the next one is whichever followed it. */
  sync(ids: string[]) {
    if (this.index >= 0) {
      const survivor = this.ids.slice(this.index).find((id) => ids.includes(id));
      const at = survivor ? ids.indexOf(survivor) : ids.length;
      this.index = survivor === this.ids[this.index] ? at : at - 1;
    }
    this.ids = ids;
  }

  next(): string | null {
    if (!this.ids.length) return null;
    this.index = (this.index + 1) % this.ids.length;
    return this.ids[this.index];
  }
}
