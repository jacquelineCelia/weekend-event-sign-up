// What the big screen shows next. Safe to import from client components.

/**
 * Goes through the list and starts again. A photo uploaded while the show is running goes next,
 * then the show returns to where it was; the photo keeps its normal place in later rounds too.
 */
export class PhotoOrder {
  private ids: string[] = [];
  private index = -1; // the photo last reached in the list; -1 before the first
  private fresh: string[] = []; // new uploads still to show
  private started = false;

  /** Brings in the current list. If the current photo is gone, the next one is whichever followed it. */
  sync(ids: string[]) {
    if (this.started) this.fresh.push(...ids.filter((id) => !this.ids.includes(id)));
    this.fresh = this.fresh.filter((id) => ids.includes(id));
    if (this.index >= 0) {
      const survivor = this.ids.slice(this.index).find((id) => ids.includes(id));
      const at = survivor ? ids.indexOf(survivor) : ids.length;
      this.index = survivor === this.ids[this.index] ? at : at - 1;
    }
    this.ids = ids;
    this.started = true;
  }

  next(): string | null {
    const fresh = this.fresh.shift();
    if (fresh) return fresh;
    if (!this.ids.length) return null;
    this.index = (this.index + 1) % this.ids.length;
    return this.ids[this.index];
  }
}
