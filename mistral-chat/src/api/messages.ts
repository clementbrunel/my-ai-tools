import type { MistralClient } from './client.js';
import { trpcMutationUrl, trpcBody, PROCEDURES, REST_CHAT_URL } from './endpoints.js';

export interface ContentBlock {
  type: 'text';
  text: string;
}

export interface NewChatResult {
  chatId: string;
  assistantContent: string;
}

/**
 * Create a new chat and send the first message in one call.
 * Uses the confirmed tRPC endpoint: POST /api/trpc/message.newChat?batch=1
 */
export async function newChat(client: MistralClient, text: string): Promise<NewChatResult> {
  const url = trpcMutationUrl(PROCEDURES.newChat);

  const json = {
    content: [{ type: 'text', text }] as ContentBlock[],
    voiceInput: null,
    audioRecording: null,
    agentId: null,
    agentsApiAgentId: null,
    files: [] as unknown[],
    isSampleChatForAgentId: null,
    model: null,
    features: [] as unknown[],
    integrations: [] as unknown[],
    canva: null,
    action: null,
    libraries: [] as unknown[],
    projectId: null,
    incognito: false,
  };

  const undefinedKeys = [
    'voiceInput', 'audioRecording', 'agentId', 'agentsApiAgentId',
    'isSampleChatForAgentId', 'model', 'canva', 'action', 'projectId',
  ];

  const body = trpcBody(json, undefinedKeys);
  const chunks = await client.trpcPostLines(url, body);
  const { chatId } = parseNewChatFromChunks(chunks);

  // message.newChat stores the user message but the AI response is streamed
  // via the REST /api/chat endpoint.
  const assistantContent = await sendViaRestChat(client, chatId, text);
  return { chatId, assistantContent };
}

/**
 * Send a message to an existing chat via the REST streaming endpoint.
 */
export async function sendMessage(
  client: MistralClient,
  chatId: string,
  text: string,
): Promise<string> {
  return sendViaRestChat(client, chatId, text);
}

/**
 * POST /api/chat — the actual LLM streaming endpoint used for both
 * new-chat first messages and follow-ups.
 */
async function sendViaRestChat(client: MistralClient, chatId: string, text: string): Promise<string> {
  const body = JSON.stringify({
    chatId,
    mode: 'append',
    messageInput: [{ type: 'text', text }],
    messageFiles: [],
    messageId: crypto.randomUUID(),
    features: [],
    libraries: [],
    integrations: [],
    disabledFeatures: [],
    clientPromptData: {
      currentDate: new Date().toISOString().split('T')[0],
      userTimezone: 'T+02:00 (Europe/Paris)',
    },
    stableAnonymousIdentifier: 'cli',
    shouldAwaitStreamBackgroundTasks: true,
    shouldUsePersistentStream: true,
    shouldUseMessagePatch: true,
  });

  const chunks = await client.restPostLines(REST_CHAT_URL, body);
  return parseAssistantFromRestChunks(chunks);
}

// ── SuperJSON streaming chunk parser ─────────────────────────────────────────

/**
 * Extract the data payload from a single SuperJSON streaming chunk.
 * Chunks look like: {"json":[chunkIdx, 0, [[dataObject], ...]], "meta":{...}}
 * The actual data is at json[2][0][0].
 */
function extractChunkData(chunk: unknown): unknown {
  if (!chunk || typeof chunk !== 'object') return null;
  const obj = chunk as Record<string, unknown>;

  // SuperJSON streaming: {"json": [N, 0, [[data], ...]], "meta": {...}}
  if (Array.isArray(obj['json'])) {
    const arr = obj['json'] as unknown[];
    if (typeof arr[0] === 'number' && Array.isArray(arr[2])) {
      const patches = arr[2] as unknown[][];
      if (patches[0] && Array.isArray(patches[0]) && patches[0].length > 0) {
        return patches[0][0];
      }
    }
    // Manifest line: {"json": {"0": [...]}} — not useful data
    return null;
  }

  // Standard tRPC batch: [{"result":{"data":{"json":{...}}}}]
  return extractTrpcData(chunk);
}

function parseNewChatFromChunks(chunks: unknown[]): NewChatResult {
  let chatId = '';
  let assistantContent = '';

  for (const chunk of chunks) {
    const data = extractChunkData(chunk);
    if (!data || typeof data !== 'object') continue;
    const obj = data as Record<string, unknown>;

    if (!chatId) {
      const idRaw = obj['chatId'] ?? obj['id'] ?? obj['conversationId'];
      if (typeof idRaw === 'string' && idRaw) chatId = idRaw;
    }

    if (!assistantContent) {
      assistantContent = findAssistantContent(obj) ?? '';
    }
  }

  if (!chatId) {
    throw new Error('newChat: chatId introuvable dans les chunks:\n' + JSON.stringify(chunks, null, 2));
  }
  return { chatId, assistantContent };
}

/**
 * Parse assistant content from REST /api/chat streaming chunks.
 *
 * The server sends JSON-patch frames: channel-prefixed JSONL lines (parsed
 * by the client into plain objects). Each frame has:
 *   {"json":{"type":"message","messageId":"...","patches":[{op,path,value}]}}
 *
 * Patches of interest:
 *   op:"replace"  path:"/contentChunks"         → sets initial text chunk array
 *   op:"append"   path:"/contentChunks/N/text"  → appends a token to chunk N
 */
function parseAssistantFromRestChunks(chunks: unknown[]): string {
  const texts: Record<number, string> = {};

  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== 'object') continue;
    const json = (chunk as Record<string, unknown>)['json'];
    if (!json || typeof json !== 'object') continue;
    const frame = json as Record<string, unknown>;
    if (frame['type'] !== 'message' || !Array.isArray(frame['patches'])) continue;

    for (const patch of frame['patches'] as unknown[]) {
      applyPatch(patch, texts);
    }
  }

  return Object.keys(texts)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => texts[i])
    .join('');
}

function applyPatch(patch: unknown, texts: Record<number, string>): void {
  if (!patch || typeof patch !== 'object') return;
  const p = patch as Record<string, unknown>;
  const op = p['op'];
  const path = typeof p['path'] === 'string' ? p['path'] : '';

  if (op === 'replace' && path === '/contentChunks') {
    // Initial replacement: value is an array of {type,text} chunk objects
    const arr = Array.isArray(p['value']) ? p['value'] : [];
    arr.forEach((c, i) => {
      if (c && typeof c === 'object' && typeof (c as Record<string, unknown>)['text'] === 'string') {
        texts[i] = (c as Record<string, unknown>)['text'] as string;
      }
    });
    return;
  }

  if (op === 'append') {
    // path: "/contentChunks/N/text"
    const m = path.match(/^\/contentChunks\/(\d+)\/text$/);
    if (m && typeof p['value'] === 'string') {
      const idx = Number(m[1]);
      texts[idx] = (texts[idx] ?? '') + p['value'];
    }
  }
}

/**
 * Search an object for assistant message content.
 * Handles: {role:'assistant', content:'...'} objects and common field names.
 */
function findAssistantContent(obj: Record<string, unknown>): string | null {
  return (
    contentIfAssistant(obj) ??
    contentFromMessagesField(obj['messages']) ??
    contentFromNamedFields(obj)
  );
}

function contentIfAssistant(msg: Record<string, unknown>): string | null {
  return msg['role'] === 'assistant' && typeof msg['content'] === 'string'
    ? msg['content']
    : null;
}

function contentFromMessagesField(msgs: unknown): string | null {
  if (!msgs || typeof msgs !== 'object') return null;
  const items = Array.isArray(msgs) ? msgs : [msgs];
  for (const m of items) {
    if (m && typeof m === 'object') {
      const result = contentIfAssistant(m as Record<string, unknown>);
      if (result) return result;
    }
  }
  return null;
}

function contentFromNamedFields(obj: Record<string, unknown>): string | null {
  for (const key of ['assistantMessage', 'response', 'answer']) {
    const val = obj[key];
    if (typeof val === 'string' && val) return val;
    if (val && typeof val === 'object') {
      const inner = val as Record<string, unknown>;
      if (typeof inner['content'] === 'string') return inner['content'];
    }
  }
  return null;
}

/**
 * Extract the actual data from a tRPC batch response.
 * Shape: [{"result":{"data":{"json":{...},"meta":{...}}}}]
 * or streamed JSON lines (we take the last non-empty line).
 */
export function extractTrpcData(raw: unknown): unknown {
  // Batch array: [{ result: { data: { json: ... } } }]
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0] as Record<string, unknown>;
    if (first['error']) {
      const err = first['error'] as Record<string, unknown>;
      const errJson = err['json'] as Record<string, unknown> | undefined;
      const msg = typeof errJson?.['message'] === 'string' ? errJson['message'] : JSON.stringify(err);
      throw new Error(`tRPC error: ${msg}`);
    }
    const result = first['result'] as Record<string, unknown> | undefined;
    const dataWrapper = result?.['data'] as Record<string, unknown> | undefined;
    return dataWrapper?.['json'] ?? dataWrapper ?? result;
  }

  // Single object (non-batched or streaming last chunk)
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (obj['result']) {
      const result = obj['result'] as Record<string, unknown>;
      const dataWrapper = result['data'] as Record<string, unknown> | undefined;
      return dataWrapper?.['json'] ?? dataWrapper ?? result;
    }
  }

  return raw;
}
