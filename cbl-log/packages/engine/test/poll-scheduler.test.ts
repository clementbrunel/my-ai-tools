import { afterEach, describe, expect, it } from "vitest";
import { defaultPollInterval, isUncPath, PollScheduler } from "../src/index";
import { waitFor } from "./helpers";

let scheduler: PollScheduler | undefined;
afterEach(() => {
  scheduler?.close();
  scheduler = undefined;
});

describe("PollScheduler", () => {
  it("interval: 250 ms locally, 1 s for UNC", () => {
    expect(isUncPath("\\\\nas\\share\\a.log")).toBe(true);
    expect(isUncPath("\\\\wsl.localhost\\Ubuntu\\var\\log\\a.log")).toBe(true);
    expect(isUncPath("C:\\logs\\a.log")).toBe(false);
    expect(defaultPollInterval("C:\\logs\\a.log")).toBe(250);
    expect(defaultPollInterval("\\\\nas\\share\\a.log")).toBe(1000);
  });

  it("staggers the first ticks", async () => {
    scheduler = new PollScheduler();
    const firstRun: number[] = [];
    for (let i = 0; i < 4; i++) {
      let n = 0;
      scheduler.add(() => {
        if (n++ === 0) firstRun.push(Date.now());
      }, 400);
    }
    await waitFor(() => firstRun.length === 4, "first 4 ticks");
    // phases 0.62 / 0.24 / 0.86 / 0.48 of the interval: never all at the same instant
    expect(Math.max(...firstRun) - Math.min(...firstRun)).toBeGreaterThan(50);
  });

  it("a slow task does not block the others and is never rerun in parallel", async () => {
    scheduler = new PollScheduler();
    let slowRuns = 0;
    let slowParallel = 0;
    let slowOverlap = false;
    let fastRuns = 0;
    scheduler.add(async () => {
      slowRuns++;
      if (++slowParallel > 1) slowOverlap = true;
      await new Promise((r) => setTimeout(r, 300));
      slowParallel--;
    }, 10);
    scheduler.add(() => void fastRuns++, 10);
    await waitFor(() => fastRuns >= 10, "10 fast ticks while a slow task runs");
    expect(slowOverlap).toBe(false);
    expect(slowRuns).toBeLessThanOrEqual(2);
  });

  it("poke brings the next tick forward; cancel stops the task; an error does not stop polling", async () => {
    scheduler = new PollScheduler();
    let runs = 0;
    const task = scheduler.add(() => {
      runs++;
      throw new Error("boom");
    }, 60_000);
    task.poke();
    await waitFor(() => runs === 1, "tick triggered by poke");
    task.poke();
    await waitFor(() => runs === 2, "second poke after an error");
    task.cancel();
    expect(scheduler.size).toBe(0);
    task.poke();
    await new Promise((r) => setTimeout(r, 50));
    expect(runs).toBe(2);
  });
});
