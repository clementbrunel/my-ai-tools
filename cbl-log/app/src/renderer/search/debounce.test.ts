import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebouncer } from "./debounce";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createDebouncer", () => {
  it("runs once, with the latest arguments, after the quiet period", () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 400);
    d.call("a");
    vi.advanceTimersByTime(300);
    d.call("ab"); // typing goes on: the wait restarts
    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("ab");
    expect(d.pending).toBe(false);
  });

  it("flush runs the pending call immediately, once", () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 400);
    d.call("x");
    expect(d.pending).toBe(true);
    d.flush();
    expect(fn).toHaveBeenCalledWith("x");
    d.flush();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancel drops the pending call; flush with nothing pending does nothing", () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 400);
    d.call("x");
    d.cancel();
    expect(d.pending).toBe(false);
    vi.advanceTimersByTime(1000);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });
});
