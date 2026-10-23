// A single timer for all followed sources (NF-11): each task's ticks are staggered
// so that N files do not issue N stat() calls at the same instant.

export const LOCAL_POLL_MS = 250;
export const UNC_POLL_MS = 1000;

/** Windows network path (`\\nas\share`, `\\wsl.localhost\...`): unreliable events, slower polling. */
export function isUncPath(path: string): boolean {
  return path.startsWith("\\\\") || path.startsWith("//");
}

export function defaultPollInterval(path: string): number {
  return isUncPath(path) ? UNC_POLL_MS : LOCAL_POLL_MS;
}

export interface PollTask {
  /** Requests an early check (fs.watch hint); no effect if the task is no longer registered. */
  poke(): void;
  cancel(): void;
}

interface Entry {
  run: () => unknown;
  interval: number;
  due: number;
  running: boolean;
  pokedWhileRunning: boolean;
  cancelled: boolean;
}

const GOLDEN = 0.6180339887498949;

export class PollScheduler {
  private readonly entries = new Set<Entry>();
  private timer: NodeJS.Timeout | undefined;
  private armedFor = Infinity;
  private phase = 0;
  private closed = false;

  get size(): number {
    return this.entries.size;
  }

  /** Registers `run`, called every `intervalMs` (never in parallel with itself). Errors are ignored. */
  add(run: () => unknown, intervalMs: number): PollTask {
    const interval = Math.max(1, intervalMs);
    // staggered first tick: a fraction of the interval (Weyl sequence) to spread the tasks out
    this.phase = (this.phase + GOLDEN) % 1;
    const entry: Entry = {
      run,
      interval,
      due: Date.now() + Math.max(1, Math.round(interval * this.phase)),
      running: false,
      pokedWhileRunning: false,
      cancelled: false,
    };
    if (!this.closed) this.entries.add(entry);
    this.arm();
    return {
      poke: () => {
        if (entry.cancelled || this.closed) return;
        if (entry.running) {
          entry.pokedWhileRunning = true;
          return;
        }
        entry.due = Date.now();
        this.arm();
      },
      cancel: () => {
        entry.cancelled = true;
        this.entries.delete(entry);
        this.arm();
      },
    };
  }

  close(): void {
    this.closed = true;
    this.entries.clear();
    this.arm();
  }

  private arm(): void {
    let next = Infinity;
    for (const e of this.entries) if (!e.running && e.due < next) next = e.due;
    if (next === this.armedFor && this.timer) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.armedFor = next;
    if (next === Infinity) return;
    this.timer = setTimeout(() => this.fire(), Math.max(0, next - Date.now()));
  }

  private fire(): void {
    this.timer = undefined;
    this.armedFor = Infinity;
    const now = Date.now();
    for (const e of [...this.entries]) {
      if (e.running || e.due > now) continue;
      e.running = true;
      const started = Date.now();
      const finish = (): void => {
        e.running = false;
        if (e.cancelled) return;
        e.due = e.pokedWhileRunning ? Date.now() : Math.max(Date.now(), started + e.interval);
        e.pokedWhileRunning = false;
        this.arm();
      };
      // in parallel: a hung network share must not delay the other files
      Promise.resolve()
        .then(e.run)
        .catch(() => {})
        .then(finish);
    }
    this.arm();
  }
}

let globalScheduler: PollScheduler | undefined;

/** Scheduler shared by all Tailers (a single timer for the whole application). */
export function getGlobalPollScheduler(): PollScheduler {
  return (globalScheduler ??= new PollScheduler());
}
