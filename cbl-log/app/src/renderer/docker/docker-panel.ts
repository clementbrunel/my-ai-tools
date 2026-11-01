// Pure logic of the Docker side panel: grouping, filtering, selection and the texts of its states.
import type { DockerContainerInfo, DockerListResult } from "@cbl-log/shared";
import { formatClock } from "../viewer/roll-mark";

export const NO_PROJECT = "(hors compose)";

export interface ContainerGroup {
  project: string;
  containers: DockerContainerInfo[];
}

/** Containers whose name, image, service or project contains `text` (case-insensitive), grouped by compose project. */
export function groupContainers(containers: readonly DockerContainerInfo[], text: string): ContainerGroup[] {
  const needle = text.trim().toLowerCase();
  const groups = new Map<string, DockerContainerInfo[]>();
  for (const c of containers) {
    const hay = [c.name, c.image, c.composeService, c.composeProject].join("\n").toLowerCase();
    if (needle && !hay.includes(needle)) continue;
    const project = c.composeProject ?? NO_PROJECT;
    groups.set(project, [...(groups.get(project) ?? []), c]);
  }
  return [...groups.entries()]
    .map(([project, list]) => ({ project, containers: list }))
    .sort((a, b) => (a.project === NO_PROJECT ? 1 : b.project === NO_PROJECT ? -1 : a.project.localeCompare(b.project)));
}

export type Dot = "running" | "stopped" | "other" | "unreadable";

export function containerDot(c: DockerContainerInfo): Dot {
  if (!c.readable) return "unreadable";
  if (c.state === "running") return "running";
  if (c.state === "exited" || c.state === "created" || c.state === "dead") return "stopped";
  return "other";
}

/** Selection with the usual modifiers: Ctrl toggles one, Shift extends from the anchor, otherwise it is replaced. */
export function nextSelection(
  order: readonly string[],
  selected: ReadonlySet<string>,
  anchor: string | undefined,
  name: string,
  mods: { ctrl: boolean; shift: boolean },
): Set<string> {
  if (mods.shift && anchor && order.includes(anchor)) {
    const [a, b] = [order.indexOf(anchor), order.indexOf(name)].sort((x, y) => x - y) as [number, number];
    return new Set([...(mods.ctrl ? selected : []), ...order.slice(a, b + 1)]);
  }
  if (mods.ctrl) {
    const next = new Set(selected);
    if (!next.delete(name)) next.add(name);
    return next;
  }
  return new Set([name]);
}

/** Header of the panel: connected (with versions) or an error that says what to do. */
export function connectionMessage(res: Pick<DockerListResult, "status" | "error" | "errorCode" | "version" | "apiVersion" | "context"> | undefined): {
  ok: boolean;
  text: string;
} {
  if (!res) return { ok: false, text: "Connexion à Docker…" };
  if (res.status === "connected") {
    const engine = res.version ? `Docker Desktop ${res.version}` : "Docker";
    return { ok: true, text: `Connecté à ${engine}${res.apiVersion ? `, API ${res.apiVersion}` : ""}${res.context ? ` · contexte ${res.context}` : ""}` };
  }
  switch (res.errorCode) {
    case "NOT_RUNNING":
      return { ok: false, text: "Docker n'est pas lancé : démarrez Docker Desktop, la liste se met à jour toute seule." };
    case "ACCESS_DENIED":
      return { ok: false, text: "Accès à Docker refusé : ajoutez votre compte au groupe « docker-users », puis fermez et rouvrez votre session Windows." };
    case "API_TOO_OLD":
      return { ok: false, text: "Version de Docker trop ancienne : mettez Docker Desktop à jour (API 1.41 minimum, Docker 20.10)." };
    default:
      return { ok: false, text: res.error ?? "Docker est indisponible." };
  }
}

/** Status bar text of a Docker tab: "Docker · running depuis 10:02", "Docker · arrêté", "Docker · en attente de Docker". */
export function dockerStatusText(
  tabState: "following" | "missing" | "error" | "stopped" | "waiting",
  container: Pick<DockerContainerInfo, "state" | "startedAt"> | undefined,
): string {
  if (tabState === "waiting") return "Docker · en attente de Docker";
  if (tabState === "stopped" || (container && container.state !== "running")) return "Docker · arrêté";
  const since = container?.startedAt ? new Date(container.startedAt) : undefined;
  return since && !Number.isNaN(since.getTime()) ? `Docker · running depuis ${formatClock(since.getTime()).slice(0, 5)}` : "Docker · running";
}
