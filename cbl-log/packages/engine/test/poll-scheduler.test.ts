import { afterEach, describe, expect, it } from "vitest";
import { defaultPollInterval, isUncPath, PollScheduler } from "../src/index";
import { waitFor } from "./helpers";

let scheduler: PollScheduler | undefined;
afterEach(() => {
  scheduler?.close();
  scheduler = undefined;
});

describe("PollScheduler", () => {
  it("intervalle : 250 ms en local, 1 s en UNC", () => {
    expect(isUncPath("\\\\nas\\share\\a.log")).toBe(true);
    expect(isUncPath("\\\\wsl.localhost\\Ubuntu\\var\\log\\a.log")).toBe(true);
    expect(isUncPath("C:\\logs\\a.log")).toBe(false);
    expect(defaultPollInterval("C:\\logs\\a.log")).toBe(250);
    expect(defaultPollInterval("\\\\nas\\share\\a.log")).toBe(1000);
  });

  it("decale les premiers ticks", async () => {
    scheduler = new PollScheduler();
    const firstRun: number[] = [];
    for (let i = 0; i < 4; i++) {
      let n = 0;
      scheduler.add(() => {
        if (n++ === 0) firstRun.push(Date.now());
      }, 400);
    }
    await waitFor(() => firstRun.length === 4, "4 premiers ticks");
    // phases 0.62 / 0.24 / 0.86 / 0.48 de l'intervalle : jamais tous au meme instant
    expect(Math.max(...firstRun) - Math.min(...firstRun)).toBeGreaterThan(50);
  });

  it("une tache lente ne bloque pas les autres et n'est jamais relancee en parallele", async () => {
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
    await waitFor(() => fastRuns >= 10, "10 ticks rapides pendant qu'une tache lente tourne");
    expect(slowOverlap).toBe(false);
    expect(slowRuns).toBeLessThanOrEqual(2);
  });

  it("poke avance le prochain tick ; cancel arrete la tache ; une erreur n'arrete pas le polling", async () => {
    scheduler = new PollScheduler();
    let runs = 0;
    const task = scheduler.add(() => {
      runs++;
      throw new Error("boom");
    }, 60_000);
    task.poke();
    await waitFor(() => runs === 1, "tick provoque par poke");
    task.poke();
    await waitFor(() => runs === 2, "second poke apres erreur");
    task.cancel();
    expect(scheduler.size).toBe(0);
    task.poke();
    await new Promise((r) => setTimeout(r, 50));
    expect(runs).toBe(2);
  });
});
