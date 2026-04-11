export type Status = "ok" | "warning" | "error";

export interface McpServer {
  name: string;
  source: string; // where the config was found
  type: "stdio" | "sse" | "unknown";
  command?: string;
  args?: string[];
  url?: string;
  envVars: EnvVarCheck[];
  commandAvailable: boolean | null; // null if not applicable (e.g. SSE)
  status: Status;
  diagnostics: string[];
  subServers?: string[]; // for Docker MCP gateway: list of enabled sub-servers
}

export interface EnvVarCheck {
  name: string;
  isSet: boolean;
  isApiKey: boolean; // heuristic: matches *_API_KEY, *_TOKEN, *_SECRET patterns
}

export interface ContextFile {
  path: string;
  exists: boolean;
  sizeBytes: number;
  estimatedTokens: number;
  scope: "project" | "user" | "parent";
}

export interface Hook {
  event: string;
  matcher: string;
  type: string;
  command: string;
  source: string;
  scriptExists: boolean | null;
  status: Status;
  diagnostics: string[];
}

export interface ModelInfo {
  configured: string | null;
  source: string | null;
  isSonnet: boolean;
  status: Status;
  diagnostics: string[];
}

export interface Integration {
  name: string;
  description: string;
  detected: boolean;
  status: Status;
  source?: string;
  diagnostics: string[];
}

export interface ScanResult {
  projectPath: string;
  model: ModelInfo;
  mcpServers: McpServer[];
  contextFiles: ContextFile[];
  hooks: Hook[];
  integrations: Integration[];
  envVarSummary: {
    total: number;
    set: number;
    missing: number;
    missingList: string[];
    setList: string[];
  };
}
