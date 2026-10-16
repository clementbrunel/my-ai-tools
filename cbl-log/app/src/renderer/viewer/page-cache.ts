import type { Row } from "@cbl-log/shared";

export const PAGE_SIZE = 200;
export const MAX_PAGES = 50;

export type PageFetcher = (first: number, count: number) => Promise<Row[]>;

interface Page {
  /** Sparse: indexed by `lineNo - pageStart` (unreadable segments leave holes). */
  rows: (Row | undefined)[];
  /** Content may be outdated (the file grew): still shown, but refetched. */
  stale: boolean;
}

interface InFlight {
  stale: boolean;
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

  constructor(
    private readonly fetchRows: PageFetcher,
    private readonly maxPages = MAX_PAGES,
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

  /** Rows from `row` on are outdated (growth of the last line, truncation, rolling). */
  invalidateFrom(row: number): void {
    const from = Math.floor(Math.max(0, row) / PAGE_SIZE);
    for (const [index, page] of this.pages) if (index >= from) page.stale = true;
    for (const [index, flight] of this.inFlight) {
      if (index >= from) {
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
    const flight: InFlight = { stale: false };
    this.inFlight.set(index, flight);
    const start = index * PAGE_SIZE;
    this.fetchRows(start, PAGE_SIZE).then(
      (rows) => {
        if (flight.stale) return;
        this.inFlight.delete(index);
        const page: Page = { rows: [], stale: false };
        for (const row of rows) page.rows[row.lineNo - start] = row;
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
