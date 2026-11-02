import type { Row } from "@cbl-log/shared";

export const PAGE_SIZE = 200;
export const MAX_PAGES = 50;

export type PageFetcher = (first: number, count: number) => Promise<Row[]>;

interface Page {
  /** Sparse: indexed by `lineNo - pageStart` (unreadable segments leave holes); by rank when positional. */
  rows: (Row | undefined)[];
  /** Content may be outdated (the file grew): still shown, but refetched. */
  stale: boolean;
}

interface InFlight {
  /** Its answer is discarded. */
  stale: boolean;
  /** The file grew since the request left: the answer is still good to show, but a refetch must follow. */
  outdated: boolean;
}

/**
 * Per-tab cache of pages of PAGE_SIZE rows with LRU eviction, de-duplicated in-flight requests and
 * neighbour prefetching. Invalidated pages stay readable until their replacement arrives so that
 * a growing file does not make the viewport flicker.
 */
export class PageCache {
  private readonly pages = new Map<number, Page>();
  private readonly inFlight = new Map<number, InFlight>();
  private readonly listeners = new Set<() => void>();

  /**
   * `positional`: the fetcher returns consecutive rows from the position asked (the filtered view,
   * whose rows keep the line numbers of the file), so a row is placed by its rank in the answer.
   */
  constructor(
    private readonly fetchRows: PageFetcher,
    private readonly maxPages = MAX_PAGES,
    private readonly positional = false,
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getRow(lineNo: number): Row | undefined {
    const index = Math.floor(lineNo / PAGE_SIZE);
    const page = this.pages.get(index);
    if (!page) return undefined;
    this.touch(index, page);
    return page.rows[lineNo - index * PAGE_SIZE];
  }

  /** Page indexes covering [first, first+count) that are absent or stale (in-flight ones included). */
  missingPages(first: number, count: number, total: number): number[] {
    const missing: number[] = [];
    if (count <= 0) return missing;
    const last = Math.min(first + count, total) - 1;
    for (let p = Math.floor(first / PAGE_SIZE); p <= Math.floor(last / PAGE_SIZE); p++) {
      const page = this.pages.get(p);
      if (!page || page.stale) missing.push(p);
    }
    return missing;
  }

  /** Makes sure [first, first+count) and the pages on either side are loaded or loading. */
  request(first: number, count: number, total: number): void {
    if (count <= 0 || total <= 0) return;
    const firstPage = Math.max(0, Math.floor(first / PAGE_SIZE) - 1);
    const lastPage = Math.min(Math.floor((total - 1) / PAGE_SIZE), Math.floor((first + count - 1) / PAGE_SIZE) + 1);
    for (let p = firstPage; p <= lastPage; p++) {
      const page = this.pages.get(p);
      if ((!page || page.stale) && !this.inFlight.has(p)) this.load(p);
    }
  }

  /**
   * Number of leading rows (at most `total`) readable right now: the end of the last row present in the
   * cache. While a growing file's new lines are being fetched, the viewport shows up to there instead
   * of a blank tail that would flicker. `total` when nothing at all is loaded, or when the gap is
   * larger than a page (jump, burst of lines): those rows must be requested, so they stay in range.
   */
  readableEnd(total: number): number {
    if (total <= 0) return 0;
    const lastPage = Math.floor((total - 1) / PAGE_SIZE);
    for (let p = lastPage; p >= Math.max(0, lastPage - 1); p--) {
      const page = this.pages.get(p);
      if (!page) continue;
      for (let i = Math.min(total - p * PAGE_SIZE, PAGE_SIZE) - 1; i >= 0; i--) {
        if (page.rows[i]) return p * PAGE_SIZE + i + 1;
      }
    }
    return total;
  }

  /**
   * Rows from `row` on are outdated (growth of the last line, truncation, rolling).
   * `append`: the file only grew, so an answer already in flight stays usable (it is shown, then
   * refetched) instead of being thrown away — otherwise a file growing faster than a round trip to
   * the engine would never get its new lines on screen.
   */
  invalidateFrom(row: number, append = false): void {
    const from = Math.floor(Math.max(0, row) / PAGE_SIZE);
    for (const [index, page] of this.pages) if (index >= from) page.stale = true;
    for (const [index, flight] of this.inFlight) {
      if (index < from) continue;
      if (append) flight.outdated = true;
      else {
        flight.stale = true; // its answer is discarded
        this.inFlight.delete(index);
      }
    }
    this.notify();
  }

  clear(): void {
    this.pages.clear();
    for (const flight of this.inFlight.values()) flight.stale = true;
    this.inFlight.clear();
    this.listeners.clear();
  }

  private load(index: number): void {
    const flight: InFlight = { stale: false, outdated: false };
    this.inFlight.set(index, flight);
    const start = index * PAGE_SIZE;
    this.fetchRows(start, PAGE_SIZE).then(
      (rows) => {
        if (flight.stale) return;
        this.inFlight.delete(index);
        const page: Page = { rows: [], stale: flight.outdated };
        rows.forEach((row, rank) => {
          page.rows[this.positional ? rank : row.lineNo - start] = row;
        });
        this.pages.delete(index);
        this.pages.set(index, page);
        this.evict();
        this.notify();
      },
      () => {
        // tab closed or engine restarted: the next request retries
        if (!flight.stale) this.inFlight.delete(index);
      },
    );
  }

  private touch(index: number, page: Page): void {
    this.pages.delete(index);
    this.pages.set(index, page);
  }

  private evict(): void {
    while (this.pages.size > this.maxPages) {
      const oldest = this.pages.keys().next().value;
      if (oldest === undefined) return;
      this.pages.delete(oldest);
    }
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
