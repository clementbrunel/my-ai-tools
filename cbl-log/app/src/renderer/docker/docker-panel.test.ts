import { describe, expect, it } from "vitest";
import type { DockerContainerInfo } from "@cbl-log/shared";
import { connectionMessage, containerDot, dockerStatusText, groupContainers, nextSelection, NO_PROJECT } from "./docker-panel";

const c = (name: string, extra: Partial<DockerContainerInfo> = {}): DockerContainerInfo => ({ id: name, name, image: "img", state: "running", status: "Up", readable: true, ...extra });

describe("groupContainers", () => {
  const list = [c("shop-web-1", { composeProject: "shop", composeService: "web" }), c("shop-db-1", { composeProject: "shop", composeService: "db" }), c("redis"), c("api-1", { composeProject: "api" })];

  it("groups by compose project, sorted, with the others last", () => {
    expect(groupContainers(list, "").map((g) => [g.project, g.containers.length])).toEqual([["api", 1], ["shop", 2], [NO_PROJECT, 1]]);
  });

  it("filters on name, service, project or image, ignoring case", () => {
    expect(groupContainers(list, "DB").flatMap((g) => g.containers.map((x) => x.name))).toEqual(["shop-db-1"]);
    expect(groupContainers(list, "api").map((g) => g.project)).toEqual(["api"]);
    expect(groupContainers(list, "nothing")).toEqual([]);
  });
});

describe("containerDot", () => {
  it("tells running, stopped and unreadable containers apart", () => {
    expect(containerDot(c("a"))).toBe("running");
    expect(containerDot(c("a", { state: "exited" }))).toBe("stopped");
    expect(containerDot(c("a", { state: "paused" }))).toBe("other");
    expect(containerDot(c("a", { readable: false }))).toBe("unreadable");
  });
});

describe("nextSelection", () => {
  const order = ["a", "b", "c", "d"];
  it("replaces, toggles with Ctrl and extends with Shift", () => {
    const one = nextSelection(order, new Set(), undefined, "b", { ctrl: false, shift: false });
    expect([...one]).toEqual(["b"]);
    expect([...nextSelection(order, one, "b", "d", { ctrl: true, shift: false })].sort()).toEqual(["b", "d"]);
    expect([...nextSelection(order, new Set(["b", "d"]), "b", "d", { ctrl: true, shift: false })]).toEqual(["b"]);
    expect([...nextSelection(order, one, "b", "d", { ctrl: false, shift: true })]).toEqual(["b", "c", "d"]);
  });
});

describe("connectionMessage", () => {
  it("shows the versions when connected", () => {
    expect(connectionMessage({ status: "connected", version: "4.34.0", apiVersion: "1.47", context: "default" }).text).toBe("Connecté à Docker Desktop 4.34.0, API 1.47 · contexte default");
  });
  it("gives an actionable message per failure", () => {
    expect(connectionMessage({ status: "unavailable", errorCode: "NOT_RUNNING" }).text).toMatch(/démarrez Docker Desktop/);
    expect(connectionMessage({ status: "unavailable", errorCode: "ACCESS_DENIED" }).text).toMatch(/docker-users/);
    expect(connectionMessage({ status: "unavailable", errorCode: "API_TOO_OLD" }).text).toMatch(/trop ancienne/);
    expect(connectionMessage({ status: "unavailable", errorCode: "OTHER", error: "boom" })).toEqual({ ok: false, text: "boom" });
    expect(connectionMessage(undefined).ok).toBe(false);
  });
});

describe("dockerStatusText", () => {
  it("covers running, stopped and waiting", () => {
    const started = new Date(2026, 9, 31, 10, 2, 11).toISOString();
    expect(dockerStatusText("following", { state: "running", startedAt: started })).toBe("Docker · running depuis 10:02");
    expect(dockerStatusText("following", { state: "running" })).toBe("Docker · running");
    expect(dockerStatusText("stopped", undefined)).toBe("Docker · arrêté");
    expect(dockerStatusText("following", { state: "exited" })).toBe("Docker · arrêté");
    expect(dockerStatusText("waiting", undefined)).toBe("Docker · en attente de Docker");
  });
});
