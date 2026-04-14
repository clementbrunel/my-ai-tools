import type { MistralClient } from './client.js';
import { trpcQueryUrl, PROCEDURES } from './endpoints.js';
import { extractTrpcData } from './messages.js';

export interface Conversation {
  id: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  [key: string]: unknown;
}

export async function listConversations(client: MistralClient): Promise<Conversation[]> {
  const url = trpcQueryUrl(PROCEDURES.getChats, null);
  const raw = await client.get<unknown>(url);
  const data = extractTrpcData(raw);
  return normalizeList(data);
}

export async function getConversation(
  client: MistralClient,
  id: string,
): Promise<ConversationWithMessages> {
  const url = trpcQueryUrl(PROCEDURES.getChatById, { id });
  const raw = await client.get<unknown>(url);
  const data = extractTrpcData(raw);
  return normalizeWithMessages(id, data);
}

function normalizeList(data: unknown): Conversation[] {
  if (Array.isArray(data)) return data as Conversation[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['chats', 'conversations', 'items', 'data']) {
      if (Array.isArray(obj[key])) return obj[key] as Conversation[];
    }
  }
  return [];
}

function normalizeWithMessages(id: string, data: unknown): ConversationWithMessages {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const conv = (obj['chat'] ?? obj['conversation'] ?? obj) as Record<string, unknown>;
    const msgs = (conv['messages'] ?? obj['messages'] ?? []) as Message[];
    return { id, ...conv, messages: msgs };
  }
  return { id, messages: [] };
}
