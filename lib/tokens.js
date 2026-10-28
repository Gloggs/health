/**
 * Token generation for invite links + family ids.
 *
 * Invite tokens are 32 random bytes encoded as base64url (43 chars). That's
 * 256 bits of entropy — same shape Stripe / GitHub use for unguessable URL
 * tokens. The token is the only secret in the invite URL, so we want
 * collisions to be effectively impossible.
 *
 * Family ids are 12 random bytes encoded as base64url (16 chars), prefixed
 * with `fam_`. Shorter than a UUID, still collision-safe at our scale
 * (millions of families before birthday-paradox risk gets interesting).
 *
 * Both use Node's `crypto.randomBytes` (synchronous, CSPRNG-backed) rather
 * than Web Crypto so they work in the Node runtime that Vercel uses for
 * API routes by default. Switching to `globalThis.crypto.getRandomValues`
 * would also work but adds nothing — both pull from /dev/urandom.
 */

import { randomBytes } from "crypto";

function toBase64Url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function generateInviteToken() {
  return toBase64Url(randomBytes(32));
}

export function generateFamilyId() {
  return "fam_" + toBase64Url(randomBytes(12));
}
