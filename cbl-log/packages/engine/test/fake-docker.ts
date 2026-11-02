import { randomBytes } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DockerClient } from "../src/docker/index";

interface FakeLine {
  ts: string;
  text: string;
}

interface FakeContainer {
  id: string;
  name: string;
  state: "running" | "exited";
  logDriver: string;
  lines: FakeLine[];
  followers: Set<{ res: ServerResponse; timestamps: boolean }>;
}

function frame(text: string): Buffer {
  const payload = Buffer.from(text);
  const head = Buffer.alloc(8);
  head[0] = 1;
  head.writeUInt32BE(payload.length, 4);
  return Buffer.concat([head, payload]);
}

/** Stateful fake Docker daemon on a named pipe (Windows) or Unix socket: containers with logs, follow, since, tail. */
export class FakeDocker {
  readonly calls: string[] = [];
  private readonly containers = new Map<string, FakeContainer>();
  private readonly server: Server;
  private readonly socketPath: string;
  private clock = Date.now();
  private listening = false;
  private readonly eventStreams = new Set<ServerResponse>();

  constructor() {
    const name = `cbl-log-fake-${randomBytes(6).toString("hex")}`;
    this.socketPath = process.platform === "win32" ? `\\\\.\\pipe\\${name}` : join(tmpdir(), `${name}.sock`);
    this.server = createServer((req, res) => this.handle(req.url ?? "", res));
  }

  async up(): Promise<void> {
    await new Promise<void>((r) => this.server.listen(this.socketPath, r));
    this.listening = true;
  }

  /** The daemon vanishes: connections are cut, new ones are refused. */
  async down(): Promise<void> {
    if (!this.listening) return;
    this.listening = false;
    this.server.closeAllConnections();
    await new Promise((r) => this.server.close(r));
  }

  client(): DockerClient {
    return new DockerClient({ endpoint: { socketPath: this.socketPath } });
  }

  add(name: string, opts: { logDriver?: string; lines?: string[] } = {}): string {
    const id = randomBytes(32).toString("hex");
    this.containers.set(id, { id, name, state: "running", logDriver: opts.logDriver ?? "json-file", lines: [], followers: new Set() });
    this.log(name, ...(opts.lines ?? []));
    return id;
  }

  /** Appends lines to a container and streams them to its followers. */
  log(name: string, ...texts: string[]): void {
    const c = this.byName(name)!;
    for (const text of texts) {
      this.clock = Math.max(this.clock + 1, Date.now());
      const line = { ts: new Date(this.clock).toISOString().replace("Z", "000000Z"), text };
      c.lines.push(line);
      for (const f of c.followers) f.res.write(frame(f.timestamps ? `${line.ts} ${line.text}\n` : `${line.text}\n`));
    }
  }

  /** Pushes a lifecycle event on the open `/events` streams. */
  emitEvent(action: string, name: string): void {
    const line = JSON.stringify({ Type: "container", Action: action, Actor: { ID: "x", Attributes: { name } }, time: 1 });
    for (const res of this.eventStreams) res.write(`${line}
`);
  }

  stop(name: string): void {
    const c = this.byName(name)!;
    c.state = "exited";
    for (const f of c.followers) f.res.end();
    c.followers.clear();
  }

  start(name: string): void {
    this.byName(name)!.state = "running";
  }

  /** `compose up` with a new image: same name, new id, empty logs. Returns the new id. */
  recreate(name: string): string {
    const old = this.byName(name)!;
    for (const f of old.followers) f.res.end();
    this.containers.delete(old.id);
    return this.add(name);
  }

  private byName(name: string): FakeContainer | undefined {
    return [...this.containers.values()].find((c) => c.name === name);
  }

  private handle(rawUrl: string, res: ServerResponse): void {
    this.calls.push(rawUrl);
    const url = new URL(rawUrl.replace(/^\/v[\d.]+/, ""), "http://x");
    const json = (body: unknown): void => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const path = url.pathname;
    if (path === "/_ping") return void res.end("OK");
    if (path === "/version") return json({ Version: "27.0.1", ApiVersion: "1.45", Os: "linux" });
    if (path === "/containers/json") {
      const all = url.searchParams.get("all") === "1";
      return json(
        [...this.containers.values()]
          .filter((c) => all || c.state === "running")
          .map((c) => ({ Id: c.id, Names: [`/${c.name}`], Image: "img", State: c.state, Status: c.state, Created: 1, Labels: {} })),
      );
    }
    if (path === "/events") {
      res.writeHead(200);
      this.eventStreams.add(res);
      res.on("close", () => this.eventStreams.delete(res));
      return;
    }
    const m = /^\/containers\/([^/]+)\/(json|logs)$/.exec(path);
    const c = m ? this.containers.get(m[1]!) : undefined;
    if (!m || !c) {
      res.writeHead(404, { "content-type": "application/json" });
      return void res.end(JSON.stringify({ message: "No such container" }));
    }
    if (m[2] === "json") {
      return json({
        Id: c.id,
        Name: `/${c.name}`,
        State: { Status: c.state },
        Config: { Image: "img", Tty: false, Labels: {} },
        HostConfig: { LogConfig: { Type: c.logDriver } },
      });
    }
    const timestamps = url.searchParams.get("timestamps") === "1";
    const since = url.searchParams.get("since");
    const tail = url.searchParams.get("tail");
    let lines = c.lines;
    if (since) lines = lines.filter((l) => Date.parse(l.ts.slice(0, 19) + "Z") / 1000 >= Number(since));
    if (tail && tail !== "all") lines = tail === "0" ? [] : lines.slice(-Number(tail));
    res.writeHead(200, { "content-type": "application/vnd.docker.raw-stream" });
    res.write(Buffer.concat(lines.map((l) => frame(timestamps ? `${l.ts} ${l.text}\n` : `${l.text}\n`))));
    if (url.searchParams.get("follow") === "1" && c.state === "running") c.followers.add({ res, timestamps });
    else res.end();
  }
}
