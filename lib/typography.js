/**
 * Typography preset system. Three "voices" the user can pick from in
 * Settings → Display → Type. Same brand language, different volume:
 *
 *   classic — Inter body, Source Serif headlines, JetBrains Mono numbers,
 *             Caveat handwritten accents. The default.
 *   journal — Source Serif everywhere except numbers + handwritten
 *             accents. Reads as a printed novel; quieter, slower.
 *   modern  — Inter everywhere including headlines; numbers stay mono,
 *             handwritten accents kept (otherwise the brand disappears).
 *             For users who prefer sharp/clean over warm/literary.
 *
 * Applied by setting a `data-type` attribute on <html> (NOT a class on
 * <body>, because document-level data-attribute selectors win specificity
 * over the default --font-* variables). The actual override happens in
 * globals.css under `[data-type='journal']` / `[data-type='modern']`.
 *
 * Persistence is localStorage-only — typography is per-device taste, not
 * a synced preference (a user signing in on a friend's iPad probably
 * doesn't want their custom type to follow). If we ever want cross-device
 * sync, USER_CONTEXT has room for a `typography` column.
 *
 * Used by:
 *   - app/dashboard/settings/page.js → the picker UI
 *   - app/ThemeProvider.jsx → reads the saved value on mount and applies
 *     it to <html> before paint (avoids flash of wrong type on reload)
 */

export const TYPOGRAPHY_KEY = "etch.typography.v1";

export const TYPE_PRESETS = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Inter body, serif headlines. The default.",
    sampleTitle: "Tuesday, etched.",
    sampleBody: "Quiet day, good walk. Mum still poorly.",
  },
  journal: {
    id: "journal",
    label: "Journal",
    description: "Serif everywhere. Slower, novel-like.",
    sampleTitle: "Tuesday, etched.",
    sampleBody: "Quiet day, good walk. Mum still poorly.",
  },
  modern: {
    id: "modern",
    label: "Modern",
    description: "Sans everywhere. Sharper, cleaner.",
    sampleTitle: "Tuesday, etched.",
    sampleBody: "Quiet day, good walk. Mum still poorly.",
  },
};

export const DEFAULT_TYPOGRAPHY = "classic";

export function normaliseTypography(input) {
  const v = typeof input === "string" ? input.toLowerCase().trim() : "";
  return v in TYPE_PRESETS ? v : DEFAULT_TYPOGRAPHY;
}

/**
 * Read the saved preset id from localStorage. SSR-safe — returns the
 * default when no `window`. Don't call this in render bodies of server
 * components.
 */
export function getStoredTypography() {
  if (typeof window === "undefined") return DEFAULT_TYPOGRAPHY;
  try {
    return normaliseTypography(window.localStorage.getItem(TYPOGRAPHY_KEY));
  } catch {
    return DEFAULT_TYPOGRAPHY;
  }
}

/**
 * Apply a preset to the document. Writes a data-attribute on <html> so
 * the CSS rules in globals.css can switch the --font-sans / --font-serif
 * tokens. Also persists to localStorage.
 */
export function applyTypography(id) {
  const normalised = normaliseTypography(id);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-type", normalised);
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(TYPOGRAPHY_KEY, normalised);
    } catch {
      // Quota / private mode — preset still applies in-memory.
    }
  }
  return normalised;
}
