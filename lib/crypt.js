/**
 * Field encryption for the words people write in health (6 November 2026).
 *
 * What it does: every free-text field (how you feel, notes, the journal, GP questions and medicines,
 * goals) is encrypted with AES-256-GCM before it is sent to the database, and decrypted after it is
 * read. Anyone looking at the database itself, in the Neon console, a backup or a leaked copy, sees
 * only "enc:v1:..." and cannot read it without the key.
 *
 * Where the key lives: HEALTH_DATA_KEY, a random 32-byte key in base64, set in the hosting provider's
 * environment settings (Vercel), never in the database or the repository. Losing the key means the
 * encrypted words cannot be read again, so keep a copy somewhere safe.
 *
 * What it does not do: the app's server holds the key, so the running app can read the words in order
 * to show them to you and build your GP summary. docs/PRIVACY.md explains this limit plainly.
 *
 * The cipher comes from @noble/ciphers (audited, no dependencies), which also runs in the Edge runtime
 * that middleware.js uses. The functions are synchronous because Drizzle's column mapping is.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes, utf8ToBytes, bytesToUtf8 } from "@noble/ciphers/utils.js";

const PREFIX = "enc:v1:";
const NONCE_BYTES = 12;

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromBase64(text) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

let cachedKey = null;
let cachedFrom = null;
function key() {
  const raw = process.env.HEALTH_DATA_KEY;
  if (raw && raw === cachedFrom) return cachedKey;
  if (!raw) {
    const err = new Error("HEALTH_DATA_KEY is not set, so health cannot save or read people's words. See .env.example.");
    err.status = 500;
    throw err;
  }
  const bytes = fromBase64(raw.trim());
  if (bytes.length !== 32) {
    const err = new Error("HEALTH_DATA_KEY must be 32 random bytes in base64. See .env.example.");
    err.status = 500;
    throw err;
  }
  cachedKey = bytes;
  cachedFrom = raw;
  return bytes;
}

/** True when a stored value is encrypted by this module. */
export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Encrypts a string for storage. null and undefined stay as they are. */
export function encryptText(value) {
  if (value == null) return value;
  const nonce = randomBytes(NONCE_BYTES);
  const sealed = gcm(key(), nonce).encrypt(utf8ToBytes(String(value)));
  const out = new Uint8Array(nonce.length + sealed.length);
  out.set(nonce, 0);
  out.set(sealed, nonce.length);
  return PREFIX + toBase64(out);
}

/**
 * Decrypts a stored value. Rows saved before encryption was switched on are plain text and are
 * returned as they are. A value that fails to decrypt (a wrong key, or a changed value) throws,
 * because showing scrambled or tampered text would be worse than an error.
 */
export function decryptText(value) {
  if (value == null || !isEncrypted(value)) return value;
  const bytes = fromBase64(value.slice(PREFIX.length));
  const nonce = bytes.subarray(0, NONCE_BYTES);
  const sealed = bytes.subarray(NONCE_BYTES);
  return bytesToUtf8(gcm(key(), nonce).decrypt(sealed));
}
