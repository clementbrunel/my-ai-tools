export interface Throttled {
  /** Plans a run `intervalMs` from now unless one is already planned (it will see the latest state). */
  request(): void;
  /** Drops the planned run. */
  cancel(): void;
  readonly pending: boolean;
}

/**
 * Trailing throttle: at most one `fn` per `intervalMs`, however often `request` is called. Unlike a
 * debounce, a steady stream of requests (a file growing line after line) cannot postpone the run forever.
 * `fn` takes no argument: it reads the current state when it runs.
 */
export function createThrottle(fn: () => void, intervalMs: number): Throttled {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    request() {
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        fn();
      }, intervalMs);
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
    },
    get pending() {
      return timer !== undefined;
    },
  };
}
