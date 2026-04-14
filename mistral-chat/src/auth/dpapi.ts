import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Extracts and decrypts the Chrome/Edge AES master key from the "Local State" JSON file.
 * The encrypted key is stored as a base64 string with a "DPAPI" prefix (first 5 bytes).
 * Decryption uses Windows DPAPI via PowerShell (no native addon required).
 */
export async function getMasterKey(localStatePath: string): Promise<Buffer> {
  const localState = JSON.parse(readFileSync(localStatePath, 'utf-8')) as {
    os_crypt?: { encrypted_key?: string };
  };

  const encryptedKeyB64 = localState?.os_crypt?.encrypted_key;
  if (!encryptedKeyB64) {
    throw new Error(`Clé maître introuvable dans ${localStatePath}`);
  }

  // Decode base64 and strip the 5-byte "DPAPI" prefix
  const encryptedKeyWithPrefix = Buffer.from(encryptedKeyB64, 'base64');
  const encryptedKey = encryptedKeyWithPrefix.subarray(5); // remove "DPAPI" prefix

  return decryptWithDPAPI(encryptedKey);
}

/**
 * Decrypts data using Windows DPAPI via PowerShell.
 * Uses -EncodedCommand (base64 UTF-16LE) to avoid all quoting/newline issues.
 */
function decryptWithDPAPI(encryptedData: Buffer): Buffer {
  const bytesArg = [...encryptedData].join(',');

  // Build the PowerShell script — semicolons make it single-line safe
  // $ProgressPreference = 'SilentlyContinue' suppresses the "Preparing modules" XML
  // that Add-Type emits on stdout and would corrupt the base64 result
  const psScript = [
    "$ProgressPreference = 'SilentlyContinue';",
    'Add-Type -AssemblyName System.Security;',
    `$bytes = [byte[]]@(${bytesArg});`,
    '$decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect(',
    '  $bytes, $null,',
    '  [System.Security.Cryptography.DataProtectionScope]::CurrentUser',
    ');',
    'Write-Output ([Convert]::ToBase64String($decrypted))',
  ].join(' ');

  // Encode as UTF-16LE base64 for -EncodedCommand (avoids all quoting issues)
  const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');

  let result: string;
  try {
    const raw = execSync(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`,
      { encoding: 'utf-8', windowsHide: true },
    );
    // Take the last non-empty line — guards against stray progress/verbose output
    result = raw.split(/\r?\n/).map((l) => l.trim()).findLast(Boolean) ?? '';
  } catch (err) {
    throw new Error(
      `Échec du déchiffrement DPAPI.\n` +
      `Assure-toi de lancer l'outil sous le même utilisateur Windows que le navigateur.\n` +
      `Détail: ${String(err)}`,
    );
  }

  if (!result) {
    throw new Error('DPAPI : PowerShell n\'a retourné aucune donnée.');
  }

  return Buffer.from(result, 'base64');
}
