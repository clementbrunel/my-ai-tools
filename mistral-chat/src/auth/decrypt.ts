import { createDecipheriv } from 'node:crypto';

/**
 * Decrypts a Chrome/Edge cookie encrypted_value using AES-256-GCM.
 *
 * Format for v10/v11 cookies:
 * - Bytes 0-2:   version prefix ("v10" or "v11")
 * - Bytes 3-14:  nonce (12 bytes)
 * - Bytes 15-N:  ciphertext + GCM auth tag (last 16 bytes are the tag)
 */
export function decryptCookieValue(encryptedValue: Buffer, masterKey: Buffer): string | null {
  if (!encryptedValue || encryptedValue.length < 3) return null;

  const prefix = encryptedValue.subarray(0, 3).toString('utf-8');

  if (prefix === 'v10' || prefix === 'v11') {
    return decryptAesGcm(encryptedValue, masterKey);
  }

  // Legacy DPAPI-encrypted cookie (old Chrome versions, no master key involved)
  // Return null — these are rare and pre-v80 Chrome
  return null;
}

function decryptAesGcm(encryptedValue: Buffer, masterKey: Buffer): string {
  // v10/v11: [3 bytes prefix][12 bytes nonce][ciphertext][16 bytes auth tag]
  const nonce = encryptedValue.subarray(3, 15);
  const ciphertextWithTag = encryptedValue.subarray(15);

  if (ciphertextWithTag.length < 16) {
    throw new Error('Cookie chiffré trop court');
  }

  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', masterKey, nonce);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
}
