export interface Debounced<A extends unknown[]> {
  /** (Re)starts the wait; `fn` runs with the latest arguments once `delayMs` pass without another call. */
  call(...args: A): void;
  /** Runs the pending call now (no-op when nothing is pending). */
  flush(): void;
  /** Drops the pending call. */
  cancel(): void;
  readonly pending: boolean;
}

/** Trailing debounce with `flush` / `cancel`: lets people finish typing before an expensive search starts. */
export function createDebouncer<A extends unknown[]>(fn: (...args: A) => void, delayMs: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: A | undefined;
  const run = (): void => {
    timer = undefined;
    const args = latest;
    latest = undefined;
    if (args) fn(...args);
  };
  return {
    call(...args) {
      latest = args;
      clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    },
    flush() {
      if (timer === undefined) return;
      clearTimeout(timer);
      run();
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
      latest = undefined;
    },
    get pending() {
      return timer !== undefined;
    },
  };
}
