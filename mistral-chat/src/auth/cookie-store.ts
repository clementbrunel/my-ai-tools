import { copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { decryptCookieValue } from './decrypt.js';
import { getMasterKey } from './dpapi.js';
import { DatabaseSync } from 'node:sqlite';
import { CHAT_URL, COOKIE_DOMAIN_PATTERN } from '../config.js';

export interface CookieMap {
  [name: string]: string;
}

interface RawCookieRow {
  name: string;
  encrypted_value: Uint8Array;
  host_key: string;
}

function getCookieDbPaths(browser: string, profile: string): string[] {
  const localAppData = process.env.LOCALAPPDATA ?? '';
  const base = browser === 'chrome'
    ? join(localAppData, 'Google', 'Chrome', 'User Data', profile)
    : join(localAppData, 'Microsoft', 'Edge', 'User Data', profile);

  return [
    join(base, 'Network', 'Cookies'),
    join(base, 'Cookies'),
  ].filter((p) => existsSync(p));
}

function getLocalStatePath(browser: string): string | null {
  const localAppData = process.env.LOCALAPPDATA ?? '';
  const base = browser === 'chrome'
    ? join(localAppData, 'Google', 'Chrome', 'User Data')
    : join(localAppData, 'Microsoft', 'Edge', 'User Data');

  const candidate = join(base, 'Local State');
  return existsSync(candidate) ? candidate : null;
}

/**
 * Copy a file that may be locked by Chrome/Edge.
 * - First tries fs.copyFileSync (fast, works when browser is closed)
 * - Falls back to PowerShell [System.IO.File]::Open with FileShare.ReadWrite,
 *   which reads even files held open by Chrome without requiring admin rights.
 */
function copyLocked(src: string, dst: string): void {
  try {
    copyFileSync(src, dst);
    return;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'EBUSY' && code !== 'EPERM') throw err;
    // fall through to PowerShell
  }

  // FileShare.ReadWrite lets us read even when Chrome has an exclusive write lock.
  // WriteAllBytes writes the raw bytes to dst — no encoding issues.
  // CopyTo() handles partial reads correctly (unlike a single Stream.Read() call)
  const psScript = [
    "$ProgressPreference = 'SilentlyContinue';",
    `$src = '${src.replaceAll("'", "''")}';`,
    `$dst = '${dst.replaceAll("'", "''")}';`,
    '$inStream = [System.IO.File]::Open($src,',
    '  [System.IO.FileMode]::Open,',
    '  [System.IO.FileAccess]::Read,',
    '  [System.IO.FileShare]::ReadWrite);',
    '$outStream = [System.IO.File]::Create($dst);',
    '$inStream.CopyTo($outStream);',
    '$outStream.Flush();',
    '$outStream.Close();',
    '$inStream.Close()',
  ].join(' ');

  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
    { windowsHide: true, encoding: 'utf-8' },
  );

  if (result.error) throw new Error(`PowerShell copy échoué: ${String(result.error)}`);
  if (result.status !== 0) {
    throw new Error(`PowerShell copy exit ${result.status}: ${String(result.stderr)}`);
  }
}

async function tryBrowser(
  browser: string,
  profile: string,
  debug: boolean,
): Promise<CookieMap | null> {
  if (debug) console.error(`[AUTH] Navigateur: ${browser}`);

  const dbPaths = getCookieDbPaths(browser, profile);
  if (debug) console.error(`[AUTH] DB: ${dbPaths[0] ?? 'introuvable'}`);
  if (dbPaths.length === 0) return null;

  const localStatePath = getLocalStatePath(browser);
  if (debug) console.error(`[AUTH] Local State: ${localStatePath ?? 'introuvable'}`);
  if (!localStatePath) return null;

  if (debug) console.error('[AUTH] Déchiffrement DPAPI...');
  const masterKey = await getMasterKey(localStatePath);
  if (debug) console.error(`[AUTH] Clé maître: ${masterKey.length} bytes ✓`);

  const cookies = readCookiesFromDb(dbPaths[0], masterKey, debug);
  if (debug) console.error(`[AUTH] Cookies déchiffrés: ${Object.keys(cookies).length}`);

  return Object.keys(cookies).length > 0 ? cookies : null;
}

export async function getMistralCookies(
  browser: string = 'chrome',
  profile: string = 'Default',
  debug: boolean = false,
): Promise<CookieMap> {
  const browsersToTry = browser === 'chrome' ? ['chrome', 'edge'] : ['edge', 'chrome'];

  for (const b of browsersToTry) {
    try {
      const cookies = await tryBrowser(b, profile, debug);
      if (cookies) return cookies;
    } catch (err) {
      if (debug) console.error(`[AUTH] Erreur (${b}): ${String(err)}`);
    }
  }

  throw new Error(
    `Aucun cookie de session trouvé pour ${CHAT_URL}.\n` +
    `Assure-toi d'être connecté à ${CHAT_URL} dans Chrome ou Edge.\n` +
    'Relance avec --debug pour diagnostiquer.',
  );
}

function readCookiesFromDb(dbPath: string, masterKey: Buffer, debug: boolean = false): CookieMap {
  const tmpPath = join(tmpdir(), `mistral-cookies-${Date.now()}.db`);

  // Copy main DB + WAL/SHM sidecar files (Chrome WAL mode: recent cookies live in -wal)
  copyLocked(dbPath, tmpPath);
  for (const suffix of ['-wal', '-shm']) {
    const src = dbPath + suffix;
    if (existsSync(src)) {
      try { copyLocked(src, tmpPath + suffix); } catch { /* optional files */ }
    }
  }

  const db = new DatabaseSync(tmpPath, { open: true });

  try {
    const rows = db.prepare(
      `SELECT name, encrypted_value, host_key
       FROM cookies
       WHERE host_key LIKE ?`,
    ).all(COOKIE_DOMAIN_PATTERN) as unknown as RawCookieRow[];

    if (debug) logRawRows(rows);

    return decryptRows(rows, masterKey, debug);
  } finally {
    db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      try { unlinkSync(tmpPath + suffix); } catch { /* ignore */ }
    }
  }
}

function logRawRows(rows: RawCookieRow[]): void {
  console.error(`[AUTH] Cookies bruts (filtre *.etat.lu): ${rows.length}`);
  for (const row of rows) {
    const len = row.encrypted_value?.length ?? 0;
    console.error(`[AUTH]   host="${row.host_key}" name="${row.name}" enc_len=${len}`);
  }
}

function decryptRows(rows: RawCookieRow[], masterKey: Buffer, debug: boolean): CookieMap {
  const result: CookieMap = {};
  let failed = 0;

  for (const row of rows) {
    try {
      const value = decryptCookieValue(Buffer.from(row.encrypted_value), masterKey);
      if (value) result[row.name] = value;
    } catch {
      failed++;
    }
  }

  if (debug && failed > 0) {
    console.error(`[AUTH] ${failed} cookie(s) non déchiffrés (ignorés)`);
  }

  return result;
}

export function buildCookieHeader(cookies: CookieMap): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * Parse a raw Cookie header string (e.g. from Chrome DevTools → Request Headers)
 * into a CookieMap. Handles both "name=value" pairs and trims whitespace.
 */
export function parseCookieString(raw: string): CookieMap {
  const result: CookieMap = {};
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.substring(0, eq).trim();
    const value = part.substring(eq + 1).trim();
    if (name) result[name] = value;
  }
  return result;
}
