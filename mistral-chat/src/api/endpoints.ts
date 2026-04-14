import { CHAT_URL } from '../config.js';

export const BASE_URL: string = CHAT_URL;
export const TRPC_BASE = `${BASE_URL}/api/trpc`;
export const REST_CHAT_URL = `${BASE_URL}/api/chat`;

/** Build a tRPC mutation URL (POST) */
export function trpcMutationUrl(procedure: string): string {
  return `${TRPC_BASE}/${procedure}?batch=1`;
}

/** Build a tRPC query URL (GET) with serialized input */
export function trpcQueryUrl(procedure: string, input: unknown = null): string {
  const encoded = encodeURIComponent(JSON.stringify({ '0': { json: input } }));
  return `${TRPC_BASE}/${procedure}?batch=1&input=${encoded}`;
}

/**
 * Wrap data in tRPC batch format.
 * Fields listed in `undefinedKeys` were `undefined` in TypeScript — superjson
 * marks them in meta.values so the server can deserialize them correctly.
 */
export function trpcBody(json: unknown, undefinedKeys: string[] = []): string {
  const values: Record<string, string[]> = {};
  for (const key of undefinedKeys) values[key] = ['undefined'];
  return JSON.stringify({ '0': { json, meta: { values } } });
}

// ── Known tRPC procedures ────────────────────────────────────────────────────

export const PROCEDURES = {
  /** Create a new chat AND send the first message */
  newChat: 'message.newChat',

  /** Send a message to an existing chat (endpoint guessed — adjust if needed) */
  sendMessage: 'message.sendMessage',

  /** List recent chats (endpoint guessed — adjust if needed) */
  getChats: 'chat.getChats',

  /** Get a chat with its messages */
  getChatById: 'chat.byId',
} as const;

// ── Headers required by tRPC / Next.js ──────────────────────────────────────

export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin': BASE_URL,
  'Referer': `${BASE_URL}/chat`,
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Ch-Ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  // tRPC-specific
  'trpc-accept': 'application/jsonl',
  'x-trpc-source': 'nextjs-react',
};
