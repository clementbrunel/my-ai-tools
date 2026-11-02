import { join } from "node:path";
import type { DockerSettings } from "@cbl-log/shared";
import { DOCKER_ENV, encodeDockerEnv } from "../engine/docker-options";
import { MessageChannelMain, utilityProcess, type BrowserWindow, type UtilityProcess } from "electron";

/** Holds the engine utilityProcess; restarts it if it dies (open tabs are lost, acceptable in M1). */
export class EngineHost {
  private child: UtilityProcess | undefined;
  private readonly windows = new Set<BrowserWindow>();
  private stopped = false;
  private dockerEnv: string | undefined;

  /** Docker options of settings.json, read by the engine when it starts (so: before `start`). */
  setDockerSettings(docker: DockerSettings): void {
    this.dockerEnv = encodeDockerEnv(docker);
  }

  start(): void {
    this.stopped = false;
    const child = utilityProcess.fork(join(__dirname, "engine.js"), [], {
      serviceName: "cbl-log-engine",
      stdio: "inherit",
      env: { ...process.env, ...(this.dockerEnv ? { [DOCKER_ENV]: this.dockerEnv } : {}) },
    });
    this.child = child;
    child.once("exit", (code) => {
      if (this.child !== child) return;
      this.child = undefined;
      if (this.stopped) return;
      console.error(`[cbl-log] engine process exited (code ${code}), restarting`);
      this.start();
      for (const win of this.windows) this.connect(win);
    });
  }

  /** Registers a window and hands it a fresh port to the engine (now and after each reload). */
  attachWindow(win: BrowserWindow): void {
    this.windows.add(win);
    win.on("closed", () => this.windows.delete(win));
    win.webContents.on("did-finish-load", () => this.connect(win));
  }

  stop(): void {
    this.stopped = true;
    this.child?.kill();
    this.child = undefined;
  }

  private connect(win: BrowserWindow): void {
    if (!this.child || win.isDestroyed()) return;
    const { port1, port2 } = new MessageChannelMain();
    this.child.postMessage({ type: "connect" }, [port1]);
    win.webContents.postMessage("engine-port", null, [port2]);
  }
}
