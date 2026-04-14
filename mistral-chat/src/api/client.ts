import { BROWSER_HEADERS, BASE_URL } from './endpoints.js';
import { AUTH_URL } from '../config.js';
import type { CookieMap } from '../auth/cookie-store.js';
import { buildCookieHeader } from '../auth/cookie-store.js';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ClientOptions {
  cookies: CookieMap;
  bearerToken?: string;
  debug?: boolean;
}

export class MistralClient {
  private cookies: CookieMap;
  private readonly bearerToken?: string;
  private readonly debug: boolean;

  constructor(options: ClientOptions) {
    this.cookies = { ...options.cookies };
    this.bearerToken = options.bearerToken;
    this.debug = options.debug ?? false;
  }

  /**
   * Bootstrap: GET the main page, following all redirects manually (including
   * Keycloak silent re-auth) to refresh the session cookie before API calls.
   */
  async bootstrap(): Promise<void> {
    if (this.debug) console.error('[DEBUG] Bootstrap GET (avec suivi de redirects)', BASE_URL);
    try {
      await this.fetchFollowingRedirects(BASE_URL, { method: 'GET' });
    } catch (err) {
      if (this.debug) console.error('[DEBUG] Bootstrap échoué (non-fatal):', String(err));
    }
  }

  updateCookies(extra: Partial<CookieMap>): void {
    Object.assign(this.cookies, extra);
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      ...BROWSER_HEADERS,
      'Cookie': buildCookieHeader(this.cookies),
    };
    if (this.bearerToken) headers['Authorization'] = `Bearer ${this.bearerToken}`;
    if (extra) Object.assign(headers, extra);
    return headers;
  }

  private extractSetCookies(response: Response): void {
    const raw = response.headers.get('set-cookie');
    if (!raw) return;
    for (const pair of raw.split(',')) {
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      const name = pair.substring(0, eq).trim();
      const value = pair.substring(eq + 1).split(';')[0].trim();
      if (name && value) this.cookies[name] = value;
    }
  }

  /**
   * Manually follow HTTP redirects, sending our Cookie header at every hop.
   * Node's built-in fetch strips the Cookie header on cross-origin redirects;
   * this ensures the auth server (AUTH_MISTRAL_URL) receives our KEYCLOAK_SESSION
   * so it can do a silent re-authentication.
   */
  private async fetchFollowingRedirects(
    url: string,
    options: { method: string; body?: string; headers?: Record<string, string> },
    maxHops = 10,
  ): Promise<Response> {
    let currentUrl = url;
    let method = options.method;
    let body: string | undefined = options.body;

    for (let hop = 0; hop < maxHops; hop++) {
      const response = await this.doSingleRequest(method, currentUrl, body, options.headers, hop);
      this.extractSetCookies(response);

      if (response.status < 300 || response.status >= 400) return response;

      const next = this.resolveRedirect(response, currentUrl);
      if (!next) return response;

      currentUrl = next;
      if (response.status === 302 || response.status === 303) { method = 'GET'; body = undefined; }
    }

    throw new Error(`Trop de redirects (>${maxHops})`);
  }

  private async doSingleRequest(
    method: string,
    url: string,
    body: string | undefined,
    extraHeaders: Record<string, string> | undefined,
    hop: number,
  ): Promise<Response> {
    const headers = this.buildHeaders(
      method === 'POST' ? { 'Content-Type': 'application/json', ...extraHeaders } : extraHeaders,
    );
    if (this.debug) console.error(`[DEBUG] ${method} ${url} (hop ${hop})`);
    return fetch(url, { method, headers, body: method === 'POST' ? body : undefined, redirect: 'manual' });
  }

  private resolveRedirect(response: Response, currentUrl: string): string | null {
    const location = response.headers.get('location');
    if (!location) return null;
    const next = location.startsWith('http') ? location : new URL(location, currentUrl).toString();
    if (this.debug) console.error(`[DEBUG] Redirect ${response.status} → ${next}`);
    return next;
  }

  async trpcPost<T>(url: string, body: string): Promise<T> {
    if (this.debug) {
      console.error(`[DEBUG] POST ${url}`);
      console.error(`[DEBUG] Body: ${body.substring(0, 200)}`);
    }

    const response = await this.fetchFollowingRedirects(url, {
      method: 'POST',
      body,
    });

    return this.parseResponse<T>(response);
  }

  /**
   * Like trpcPost but returns ALL parsed JSONL chunks as an array.
   * Needed for SuperJSON streaming responses where data is split across multiple lines.
   */
  async trpcPostLines(url: string, body: string): Promise<unknown[]> {
    if (this.debug) {
      console.error(`[DEBUG] POST ${url}`);
      console.error(`[DEBUG] Body: ${body.substring(0, 200)}`);
    }

    const response = await this.fetchFollowingRedirects(url, { method: 'POST', body });
    const text = await response.text();

    if (this.debug) {
      const lines = text.split('\n').filter(Boolean);
      console.error(`[DEBUG] Status: ${response.status}, ${lines.length} JSONL line(s)`);
      lines.forEach((l, i) => console.error(`[DEBUG] Line ${i}: ${l.substring(0, 200)}`));
    }

    this.checkResponseErrors(response, text);

    const parsed: unknown[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try { parsed.push(JSON.parse(trimmed)); } catch { /* skip malformed */ }
    }
    return parsed;
  }

  /**
   * POST to a plain REST endpoint (not tRPC).
   * Returns all parsed JSONL lines from the streaming response.
   */
  async restPostLines(url: string, body: string): Promise<unknown[]> {
    if (this.debug) {
      console.error(`[DEBUG] REST POST ${url}`);
      console.error(`[DEBUG] Body: ${body.substring(0, 200)}`);
    }

    const response = await this.fetchFollowingRedirects(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    });
    const text = await response.text();

    if (this.debug) {
      const lines = text.split('\n').filter(Boolean);
      console.error(`[DEBUG] REST Status: ${response.status}, ${lines.length} line(s)`);
      lines.forEach((l, i) => console.error(`[DEBUG] REST Line ${i}: ${l.substring(0, 300)}`));
    }

    this.checkResponseErrors(response, text);

    const parsed: unknown[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Strip channel prefix "N:" or SSE prefix "data: "
      const data = trimmed.startsWith('data:')
        ? trimmed.slice(5).trim()
        : trimmed.replace(/^\d+:/, '');
      try { parsed.push(JSON.parse(data)); } catch { /* skip */ }
    }
    return parsed;
  }

  async get<T>(url: string): Promise<T> {
    if (this.debug) console.error(`[DEBUG] GET ${url}`);
    const response = await this.fetchFollowingRedirects(url, { method: 'GET' });
    return this.parseResponse<T>(response);
  }

  private checkResponseErrors(response: Response, text: string): void {
    if (response.status === 401 || response.status === 403) {
      throw new AuthError(
        `Session expirée (HTTP ${response.status}).\n` +
        `Reconnecte-toi à ${BASE_URL} puis relance avec --cookie.`,
      );
    }
    if (!response.ok) {
      if (text.includes('Sign in to') || text.includes('kc-form-login') || text.includes('KC_RESTART')) {
        throw new AuthError(
          `Session expirée — le serveur redirige vers la page de login.\n` +
          'Solutions :\n' +
          `  1. Inclure les cookies de ${AUTH_URL} dans --cookie (KEYCLOAK_SESSION, etc.)\n` +
          '  2. Copier les cookies IMMÉDIATEMENT après une action dans le navigateur\n' +
          `  3. Relancer le navigateur sur ${BASE_URL} pour rafraîchir la session`,
        );
      }
      throw new ApiError(`Erreur HTTP ${response.status}`, response.status, text);
    }
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const text = await response.text();

    if (this.debug) {
      console.error(`[DEBUG] Status: ${response.status}`);
      console.error(`[DEBUG] Response: ${text.substring(0, 400)}`);
    }

    this.checkResponseErrors(response, text);

    // Handle application/jsonl (newline-delimited JSON from tRPC)
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      for (let i = lines.length - 1; i >= 0; i--) {
        try { return JSON.parse(lines[i]) as T; } catch { /* next */ }
      }
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(`Réponse non-JSON (${response.status})`, response.status, text);
    }
  }
}
