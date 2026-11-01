// A Docker container is identified in the session and in the recent list by `docker://<context>/<name>`:
// the container name, not its id, so that a recreated container (same name) is found again.

const PREFIX = "docker://";

export interface DockerRef {
  context: string;
  name: string;
}

export function dockerUri({ context, name }: DockerRef): string {
  return `${PREFIX}${context}/${name}`;
}

/** The container behind a `docker://<context>/<name>` URI; undefined for anything else (a file path…). */
export function parseDockerUri(uri: string): DockerRef | undefined {
  if (!uri.toLowerCase().startsWith(PREFIX)) return undefined;
  const rest = uri.slice(PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash <= 0 || slash === rest.length - 1) return undefined;
  return { context: rest.slice(0, slash), name: rest.slice(slash + 1) };
}
