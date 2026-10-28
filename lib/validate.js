/**
 * Validation helpers for API route bodies.
 *
 * All helpers throw an Error with `.status` set so the auth wrappers in
 * `lib/auth.js` (withFamily / withFamilyWrite) map them to the right
 * NextResponse status code automatically.
 *
 * Usage:
 *   import { clampString } from "@/lib/validate";
 *
 *   export const POST = withFamilyWrite(async (req, _ctx, { userId }) => {
 *     const body = await req.json();
 *     const note = clampString(body.note, "note");           // default 2000
 *     const content = clampString(body.content, "content");  // default 4000 (journal)
 *     // ...
 *   });
 */

// Per-field default char limits. Picked to be generous for legitimate use
// while bounding DoS / cost-grief vectors (Neon free tier compute, storage).
// Family-chat content is already capped at 4000 inline in family/chat/route.js
// and matches the 'content' default here.
const DEFAULT_CHAR_LIMITS = {
  note: 2000,
  notes: 2000,
  content: 4000,        // journal / chat / messages
  description: 1000,    // meals / plans
  title: 200,
  label: 100,
  name: 100,
};

/**
 * Validate + return a string field, throwing a 400-status Error if it
 * exceeds the configured length. null / undefined / empty string returns
 * null (caller decides how to handle absence).
 *
 * @param {*} value - raw value from request body
 * @param {string} fieldName - human-readable field name for the error message
 * @param {number} [max] - explicit max; falls back to DEFAULT_CHAR_LIMITS[fieldName]
 *                         or 2000 if neither is set
 * @returns {string|null} trimmed string up to the cap, or null
 */
export function clampString(value, fieldName, max) {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const limit = max ?? DEFAULT_CHAR_LIMITS[fieldName] ?? 2000;
  if (s.length > limit) {
    const err = new Error(`${fieldName} too long (max ${limit} chars)`);
    err.status = 400;
    throw err;
  }
  return s;
}
