import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThrottle } from "./throttle";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createThrottle", () => {
  it("runs once after the interval, however many requests came meanwhile", () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 300);
    t.request();
    t.request();
    vi.advanceTimersByTime(299);
    t.request();
    expect(fn).not.toHaveBeenCalled();
    expect(t.pending).toBe(true);
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(t.pending).toBe(false);
  });

  it("is not postponed by a steady stream of requests (unlike a debounce)", () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 300);
    for (let elapsed = 0; elapsed < 3000; elapsed += 50) {
      t.request();
      vi.advanceTimersByTime(50);
    }
    expect(fn).toHaveBeenCalledTimes(10);
  });

  it("plans a new run for a request made after the previous one ran", () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 100);
    t.request();
    vi.advanceTimersByTime(100);
    t.request();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("cancel drops the planned run, and a later request plans again", () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 100);
    t.request();
    t.cancel();
    expect(t.pending).toBe(false);
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
    t.request();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
