/**
 * Personality preset system (UX-PATTERNS.md §"3-preset Personality system").
 *
 * Same product, different volume. Each preset tunes:
 *   - etch animation duration (ms)
 *   - haptic intensity
 *   - family-chorus on/off
 *   - close-day prompt time (24h "HH:MM" or null to suppress)
 *   - streak number visual size
 *
 * Calm    🍃 — minimal, mature, quiet
 * Steady  📓 — default for new accounts, balanced
 * Warm    🔥 — full ritual, kid-friendly, satisfying
 *
 * Accessibility: when the OS reports `prefers-reduced-motion`, Health
 * automatically falls back to a Calm-equivalent regardless of the stored
 * preference. The user doesn't need to find a setting.
 *
 * Where this is consumed:
 *   - lib/etchFeedback.js → maps haptic + animation duration into the
 *     reward layer triggered on every tap-to-etch.
 *   - app/dashboard/_components/EtchAnimation.jsx → reads the animation
 *     duration to drive the SVG stroke-dasharray timing.
 *   - app/dashboard/_components/CloseTodayCard.jsx (E.2) → reads close-
 *     day prompt time to decide whether to show the nightly prompt.
 *
 * The current preset is cached in localStorage under PERSONALITY_KEY so
 * client-side reads are synchronous (no SWR call on every tap). When the
 * user changes preset, we write both the server (USER_CONTEXT.personality)
 * AND localStorage. Settings page hydrates from server on mount and
 * over-writes the cache.
 */

export const PERSONALITY_KEY = "log.personality.v1";

export const PRESETS = {
  calm: {
    id: "calm",
    label: "Calm",
    emoji: "🍃",
    description:
      "Minimal feedback. No nightly prompt. For mature users or anyone who prefers things quiet.",
    // Animation: 150ms stroke-in, ~600ms fade
    animationStrokeMs: 150,
    animationFadeMs: 600,
    // Haptic: ghost (8ms) for critical actions only
    hapticIntensity: "ghost",
    hapticEnabled: true,
    // Family chorus: own-screen ghost off (still get push if enabled)
    chorusGhost: false,
    // Close-day prompt: never auto-show. Available via gesture if user wants it.
    closeDayPromptTime: null,
    // Streak number scale on Today header (1 = base, default)
    streakScale: 0.9,
  },
  steady: {
    id: "steady",
    label: "Steady",
    emoji: "📓",
    description:
      "The default. Standard log animation, gentle prompts, family chorus on.",
    animationStrokeMs: 300,
    animationFadeMs: 1200,
    hapticIntensity: "subtle",
    hapticEnabled: true,
    chorusGhost: true,
    closeDayPromptTime: "21:00",
    streakScale: 1.0,
  },
  warm: {
    id: "warm",
    label: "Warm",
    emoji: "🔥",
    description:
      "Full ritual. Bigger animation, stronger haptic, nightly journal nudge. Great for kids.",
    animationStrokeMs: 400,
    animationFadeMs: 1500,
    hapticIntensity: "warm",
    hapticEnabled: true,
    chorusGhost: true,
    closeDayPromptTime: "20:00",
    streakScale: 1.15,
  },
};

export const DEFAULT_PERSONALITY = "steady";

/** Normalise any input to a valid preset id. Falls back to default. */
export function normalisePersonality(input) {
  const v = typeof input === "string" ? input.toLowerCase().trim() : "";
  return v in PRESETS ? v : DEFAULT_PERSONALITY;
}

/**
 * Get the preset config. Pass either the preset id ('calm'|'steady'|'warm')
 * or null/undefined to fall back to default. When `respectReducedMotion`
 * is true and the OS reports prefers-reduced-motion: reduce, returns Calm
 * regardless of what was passed.
 *
 * Server-side safe (no `window` access). On the client, prefer
 * `getEffectivePersonality()` which reads from localStorage AND the OS
 * media query in one call.
 */
export function presetFor(personality, { respectReducedMotion = false } = {}) {
  const id = normalisePersonality(personality);
  if (
    respectReducedMotion &&
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return PRESETS.calm;
  }
  return PRESETS[id];
}

/**
 * Client-side: read the cached preset id from localStorage, return the
 * effective preset (honoring prefers-reduced-motion). Safe to call from
 * any client component; returns Steady on SSR.
 */
export function getEffectivePersonality() {
  if (typeof window === "undefined") return PRESETS[DEFAULT_PERSONALITY];
  let stored = null;
  try {
    stored = window.localStorage.getItem(PERSONALITY_KEY);
  } catch {
    // Quota exceeded / Safari private mode - fall back to default.
  }
  return presetFor(stored, { respectReducedMotion: true });
}

/**
 * Client-side: write the chosen preset to localStorage. Caller is
 * responsible for the server write via /api/user-context PUT. Returns the
 * new effective preset.
 */
export function setPersonalityClient(personality) {
  const id = normalisePersonality(personality);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PERSONALITY_KEY, id);
    } catch {
      // Storage unavailable — preset still applies in-memory for this tab.
    }
    // Let any mounted component re-read on the fly.
    window.dispatchEvent(new CustomEvent("etch:personality-changed", {
      detail: { id },
    }));
  }
  return PRESETS[id];
}
