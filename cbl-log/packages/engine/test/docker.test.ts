import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DockerClient,
  DockerError,
  LogDemuxer,
  compareApiVersions,
  parseDockerHost,
  resolveEndpoint,
} from "../src/docker/index";

function frame(stream: 1 | 2, text: string): Buffer {
  const payload = Buffer.from(text);
  const head = Buffer.alloc(8);
  head[0] = stream;
  head.writeUInt32BE(payload.length, 4);
  return Buffer.concat([head, payload]);
}

async function demux(chunks: Buffer[]): Promise<{ text: string; kinds: string[] }> {
  const kinds: string[] = [];
  const d = new LogDemuxer((k) => kinds.push(k));
  const parts: Buffer[] = [];
  d.on("data", (b: Buffer) => parts.push(b));
  const done = new Promise<void>((r) => d.on("end", () => r()));
  for (const c of chunks) d.write(c);
  d.end();
  await done;
  return { text: Buffer.concat(parts).toString(), kinds };
}

describe("LogDemuxer", () => {
  const stream = Buffer.concat([frame(1, "hello\n"), frame(2, "oops\n"), frame(1, ""), frame(1, "end\n")]);

  it("splits stdout and stderr frames", async () => {
    const { text, kinds } = await demux([stream]);
    expect(text).toBe("hello\noops\nend\n");
    expect(kinds).toEqual(["stdout", "stderr", "stdout"]);
  });

  it("survives chunks cut at every possible position", async () => {
    for (let cut = 1; cut < stream.length; cut++) {
      const { text } = await demux([stream.subarray(0, cut), stream.subarray(cut)]);
      expect(text).toBe("hello\noops\nend\n");
    }
  });

  it("survives byte-by-byte delivery", async () => {
    const bytes = Array.from(stream, (b) => Buffer.from([b]));
    expect((await demux(bytes)).text).toBe("hello\noops\nend\n");
  });

  it("handles an empty frame and an empty stream", async () => {
    expect((await demux([frame(1, "")])).text).toBe("");
    expect((await demux([])).text).toBe("");
  });

  it("keeps only the bytes received of a frame truncated by the end of the stream", async () => {
    expect((await demux([frame(1, "ok\n"), frame(1, "lost\n").subarray(0, 11)])).text).toBe("ok\nlos");
  });
});

describe("endpoint resolution", () => {
  const none = () => undefined;

  it("parses npipe, unix and tcp hosts", () => {
    expect(parseDockerHost("npipe:////./pipe/docker_engine")).toEqual({ socketPath: "\\\\.\\pipe\\docker_engine" });
    expect(parseDockerHost("unix:///var/run/docker.sock")).toEqual({ socketPath: "/var/run/docker.sock" });
    expect(parseDockerHost("tcp://10.0.0.5:2376")).toEqual({ host: "10.0.0.5", port: 2376 });
    expect(() => parseDockerHost("ssh://me@box")).toThrow(DockerError);
    expect(() => parseDockerHost("nonsense")).toThrow(DockerError);
  });

  it("defaults to the docker_engine pipe", () => {
    expect(resolveEndpoint({ env: {}, readFile: none })).toEqual({ socketPath: "\\\\.\\pipe\\docker_engine" });
  });

  it("settings.json beats DOCKER_HOST, which beats the context", () => {
    const env = { DOCKER_HOST: "tcp://env:1" };
    expect(resolveEndpoint({ settingsHost: "tcp://settings:2", env, readFile: none })).toEqual({ host: "settings", port: 2 });
    expect(resolveEndpoint({ env, readFile: none })).toEqual({ host: "env", port: 1 });
  });

  it("reads the current Docker context", () => {
    const meta = createHash("sha256").update("desktop-linux").digest("hex");
    const files: Record<string, string> = {
      [join("/h", ".docker", "config.json")]: JSON.stringify({ currentContext: "desktop-linux" }),
      [join("/h", ".docker", "contexts", "meta", meta, "meta.json")]: JSON.stringify({
        Name: "desktop-linux",
        Endpoints: { docker: { Host: "npipe:////./pipe/dockerDesktopLinuxEngine" } },
      }),
    };
    const readFile = (p: string) => files[p];
    expect(resolveEndpoint({ env: {}, homeDir: "/h", readFile })).toEqual({
      socketPath: "\\\\.\\pipe\\dockerDesktopLinuxEngine",
    });
    // DOCKER_HOST still wins over the context
    expect(resolveEndpoint({ env: { DOCKER_HOST: "tcp://h:3" }, homeDir: "/h", readFile })).toEqual({ host: "h", port: 3 });
  });

  it("ignores the default context and unreadable config", () => {
    const readFile = (p: string) => (p.endsWith("config.json") ? '{"currentContext":"default"}' : undefined);
    expect(resolveEndpoint({ env: {}, homeDir: "/h", readFile })).toEqual({ socketPath: "\\\\.\\pipe\\docker_engine" });
    expect(resolveEndpoint({ env: {}, homeDir: "/h", readFile: () => "{broken" })).toEqual({
      socketPath: "\\\\.\\pipe\\docker_engine",
    });
  });
});

describe("compareApiVersions", () => {
  it("compares numerically", () => {
    expect(compareApiVersions("1.9", "1.41")).toBe(-1);
    expect(compareApiVersions("1.41", "1.41")).toBe(0);
    expect(compareApiVersions("1.47", "1.41")).toBe(1);
  });
});

// ---- fake daemon ----------------------------------------------------------------------------

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => (s.closeAllConnections(), s.close(r)))));
});

/** Fake daemon on a named pipe (Windows) or a Unix socket. */
async function fakeDaemon(handler: Handler): Promise<{ client: DockerClient; calls: string[] }> {
  const name = `cbl-log-test-${randomBytes(6).toString("hex")}`;
  const socketPath = process.platform === "win32" ? `\\\\.\\pipe\\${name}` : join(tmpdir(), `${name}.sock`);
  const calls: string[] = [];
  const server = createServer((req, res) => {
    calls.push(`${req.method} ${req.url}`);
    handler(req, res);
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(socketPath, r));
  return { client: new DockerClient({ endpoint: { socketPath } }), calls };
}

function json(res: ServerResponse, body: unknown, status = 200): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function daemon(apiVersion = "1.45", extra?: Handler): Handler {
  return (req, res) => {
    const url = (req.url ?? "").replace(/^\/v[\d.]+/, "");
    if (url === "/_ping") return void res.end("OK");
    if (url === "/version") return json(res, { Version: "27.0.1", ApiVersion: apiVersion, Os: "linux" });
    if (extra) return extra(req, res);
    json(res, { message: "not found" }, 404);
  };
}

describe("DockerClient against a fake daemon", () => {
  it("connects: ping, version, picks min(daemon, client max)", async () => {
    const { client, calls } = await fakeDaemon(daemon("1.45"));
    const info = await client.connect();
    expect(info).toMatchObject({ version: "27.0.1", apiVersion: "1.45" });
    expect(client.negotiatedApiVersion).toBe("1.45");
    expect(calls).toEqual(["GET /_ping", "GET /version"]);

    const newer = await fakeDaemon(daemon("1.99"));
    await newer.client.connect();
    expect(newer.client.negotiatedApiVersion).toBe("1.47");
  });

  it("rejects an API older than 1.41", async () => {
    const { client } = await fakeDaemon(daemon("1.40"));
    await expect(client.connect()).rejects.toMatchObject({ code: "API_TOO_OLD" });
  });

  it("reports Docker not running when the pipe does not exist", async () => {
    const socketPath = process.platform === "win32" ? "\\\\.\\pipe\\cbl-log-nope" : join(tmpdir(), "cbl-log-nope.sock");
    await expect(new DockerClient({ endpoint: { socketPath } }).connect()).rejects.toMatchObject({ code: "NOT_RUNNING" });
  });

  it("needs connect() before versioned calls", async () => {
    const { client } = await fakeDaemon(daemon());
    await expect(client.listContainers()).rejects.toBeInstanceOf(DockerError);
  });

  it("lists containers", async () => {
    const { client, calls } = await fakeDaemon(
      daemon("1.45", (req, res) =>
        json(res, [{ Id: "abc", Names: ["/web"], Image: "nginx", State: "running", Status: "Up 1h", Created: 5, Labels: { a: "b" } }]),
      ),
    );
    await client.connect();
    expect(await client.listContainers(true)).toEqual([
      { id: "abc", names: ["web"], image: "nginx", state: "running", status: "Up 1h", created: 5, labels: { a: "b" } },
    ]);
    expect(calls.at(-1)).toBe("GET /v1.45/containers/json?all=1");
  });

  it("inspects a container (tty, log driver, compose labels)", async () => {
    const { client } = await fakeDaemon(
      daemon("1.45", (req, res) =>
        json(res, {
          Id: "abc",
          Name: "/web",
          State: { Status: "running" },
          Config: {
            Image: "nginx:1",
            Tty: false,
            Labels: { "com.docker.compose.project": "shop", "com.docker.compose.service": "web" },
          },
          HostConfig: { LogConfig: { Type: "json-file" } },
        }),
      ),
    );
    await client.connect();
    expect(await client.inspect("abc")).toMatchObject({
      name: "web",
      image: "nginx:1",
      state: "running",
      tty: false,
      logDriver: "json-file",
      composeProject: "shop",
      composeService: "web",
    });
  });

  it("surfaces HTTP errors with the daemon message", async () => {
    const { client } = await fakeDaemon(daemon("1.45"));
    await client.connect();
    await expect(client.inspect("ghost")).rejects.toMatchObject({ code: "HTTP", status: 404, message: expect.stringContaining("not found") });
  });

  it("streams container events, filtered, until aborted", async () => {
    let url = "";
    const { client } = await fakeDaemon(
      daemon("1.45", (req, res) => {
        url = req.url ?? "";
        res.writeHead(200);
        const ev = (Action: string, extra = {}) =>
          JSON.stringify({ Type: "container", Action, Actor: { ID: "abc", Attributes: { name: "web", image: "nginx", ...extra } }, time: 7 });
        res.write(ev("start").slice(0, 20));
        setTimeout(() => res.write(ev("start").slice(20) + "\n" + ev("rename", { oldName: "/old" }) + "\n"), 20);
      }),
    );
    await client.connect();
    const ac = new AbortController();
    const seen: string[] = [];
    for await (const e of client.events(ac.signal)) {
      seen.push(e.action);
      if (e.action === "rename") {
        expect(e).toMatchObject({ id: "abc", name: "web", oldName: "old", image: "nginx", time: 7 });
        ac.abort();
      }
    }
    expect(seen).toEqual(["start", "rename"]);
    const q = new URL(url, "http://x").searchParams.get("filters");
    expect(JSON.parse(q!)).toEqual({ type: ["container"], event: ["create", "start", "die", "stop", "destroy", "rename"] });
  });

  it("throws when the event stream is cut without abort", async () => {
    const { client } = await fakeDaemon(daemon("1.45", (req, res) => res.end()));
    await client.connect();
    await expect(client.events().next()).rejects.toMatchObject({ code: "CONNECTION" });
  });

  it("demultiplexes logs of a non-TTY container and sends the options", async () => {
    let url = "";
    const { client } = await fakeDaemon(
      daemon("1.45", (req, res) => {
        url = req.url ?? "";
        if (url.includes("/json")) return json(res, { Id: "abc", Name: "/web", State: {}, Config: { Tty: false }, HostConfig: {} });
        res.write(Buffer.concat([frame(1, "a\n"), frame(2, "b")]));
        res.end(frame(1, "c\n"));
      }),
    );
    await client.connect();
    const stream = await client.logs("abc", { tail: 10, since: 100, timestamps: true });
    const parts: Buffer[] = [];
    for await (const c of stream) parts.push(c as Buffer);
    expect(Buffer.concat(parts).toString()).toBe("a\nbc\n");
    const p = new URL(url, "http://x").searchParams;
    expect(Object.fromEntries(p)).toMatchObject({ stdout: "1", stderr: "1", tail: "10", since: "100", timestamps: "1" });
    expect(p.has("follow")).toBe(false);
  });

  it("passes the raw stream through for a TTY container", async () => {
    const { client } = await fakeDaemon(
      daemon("1.45", (req, res) => {
        if ((req.url ?? "").includes("/json")) return json(res, { Id: "abc", Name: "/t", State: {}, Config: { Tty: true }, HostConfig: {} });
        res.end("raw line\n");
      }),
    );
    await client.connect();
    const parts: Buffer[] = [];
    for await (const c of await client.logs("abc")) parts.push(c as Buffer);
    expect(Buffer.concat(parts).toString()).toBe("raw line\n");
  });

  it("cancels a following log stream with the AbortSignal", async () => {
    const { client } = await fakeDaemon(
      daemon("1.45", (req, res) => {
        res.writeHead(200);
        res.write(frame(1, "first\n"));
      }),
    );
    await client.connect();
    const ac = new AbortController();
    const stream = await client.logs("abc", { follow: true, tty: false }, ac.signal);
    const parts: Buffer[] = [];
    for await (const c of stream) {
      parts.push(c as Buffer);
      ac.abort();
    }
    expect(Buffer.concat(parts).toString()).toBe("first\n");
  });
});

describe("read-only guarantee", () => {
  it("refuses every method but GET without touching the daemon", async () => {
    const { client, calls } = await fakeDaemon(daemon());
    for (const method of ["POST", "PUT", "DELETE", "PATCH", "HEAD", "get"]) {
      await expect(client.request(method, "/containers/abc/stop")).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(calls).toEqual([]);
  });

  it("refuses GET on routes outside the whitelist", async () => {
    const { client, calls } = await fakeDaemon(daemon());
    for (const path of ["/containers/abc/stats", "/v1.45/containers/abc/archive", "/images/json", "/containers/abc/json/../exec", "/info"]) {
      await expect(client.request("GET", path)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(calls).toEqual([]);
  });
});
