export type DockerErrorCode =
  | "NOT_RUNNING" // ENOENT / ECONNREFUSED on the pipe: Docker Desktop is not started
  | "ACCESS_DENIED" // EACCES / EPERM: account not in the docker-users group
  | "API_TOO_OLD" // daemon ApiVersion below the supported minimum
  | "FORBIDDEN" // request refused by the read-only client (method or route)
  | "BAD_ENDPOINT" // unusable DOCKER_HOST / context endpoint
  | "HTTP" // the daemon answered with a non-2xx status
  | "CONNECTION"; // any other transport failure

export class DockerError extends Error {
  constructor(
    readonly code: DockerErrorCode,
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DockerError";
  }
}

export function toDockerError(err: unknown): DockerError {
  if (err instanceof DockerError) return err;
  const code = (err as NodeJS.ErrnoException | null)?.code;
  const detail = err instanceof Error ? err.message : String(err);
  if (code === "ENOENT" || code === "ECONNREFUSED") {
    return new DockerError("NOT_RUNNING", "Docker is unavailable: is Docker Desktop running?", undefined, { cause: err });
  }
  if (code === "EACCES" || code === "EPERM") {
    return new DockerError(
      "ACCESS_DENIED",
      "Access to Docker denied: add your account to the docker-users group, then sign out and back in.",
      undefined,
      { cause: err },
    );
  }
  return new DockerError("CONNECTION", `Docker connection failed: ${detail}`, undefined, { cause: err });
}
