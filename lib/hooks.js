"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { todayDateStr } from "@/lib/dates";

/**
 * Smoothly counts from 0 to `target` (numeric) on mount and whenever target
 * changes. Strings and non-finite numbers are returned as-is (no animation).
 *
 * The hook is hydration-safe: initial state is the target value so SSR/CSR
 * render the same number, then the mount effect resets to 0 and animates up.
 * That avoids the "stays at 0 until refresh" symptom we saw when the effect
 * didn't fire on the first paint.
 */
export function useCountUp(target, durationMs = 900) {
  const numeric = typeof target === "number" && Number.isFinite(target);
  const [value, setValue] = useState(numeric ? target : target);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!numeric) {
      setValue(target);
      return;
    }

    // Reset to 0 then drive an animation up to target. Using performance.now()
    // is more reliable across browsers than the RAF timestamp argument.
    setValue(0);
    const startTime = performance.now();

    const step = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        // Snap to the exact target so the final number isn't a rounding miss.
        setValue(target);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, numeric]);

  return value;
}

/**
 * Returns the current local-date string (YYYY-MM-DD) and updates it
 * automatically when the local day rolls over - without requiring a reload.
 *
 * Two triggers keep it fresh:
 *   1. A setTimeout aimed at the next midnight (+1s buffer) for app left open
 *   2. A visibilitychange listener so devices waking from sleep also re-check
 *
 * Consumers should also use the returned value in any SWR/fetch key so the
 * data layer refetches when the date changes.
 */
export function useTodayDate() {
  const [date, setDate] = useState(() => todayDateStr());
  useEffect(() => {
    let timer;
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 1, 0);
      timer = setTimeout(() => {
        setDate((prev) => {
          const next = todayDateStr();
          return prev === next ? prev : next;
        });
        schedule();
      }, nextMidnight.getTime() - now.getTime());
    };
    schedule();
    const onVis = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;
      setDate((prev) => {
        const next = todayDateStr();
        return prev === next ? prev : next;
      });
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }
    return () => {
      clearTimeout(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
  }, []);
  return date;
}

/**
 * Read the `?viewing=` URL param. Returns:
 *   - `viewingId`: string | null - the queried user id, or null when absent
 *   - `isViewingOther`: boolean - true only when ?viewing= names someone
 *     other than… well, the client doesn't know its own viewer id, so this
 *     mirrors "is the param set at all". The server clamps viewing=self to
 *     own-data anyway, so a misuse here is at worst a banner that says
 *     "viewing me" for one paint - which we avoid by always rendering the
 *     Family tile's link with a no-op (`/dashboard` plain) for the self row.
 *
 * The hook lives in /lib so the Today page, the ViewingBanner, and any
 * future viewing-aware surface share one definition.
 */
export function useViewing() {
  const search = useSearchParams();
  const viewingId = search.get("viewing");
  return useMemo(
    () => ({
      viewingId: viewingId || null,
      isViewingOther: !!viewingId,
    }),
    [viewingId]
  );
}

/**
 * Intersection-observer hook for one-shot reveal animations.
 * Returns [ref, inView]. Once inView is true it stays true.
 */
export function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return;
    const obs = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setInView(true),
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold, inView]);
  return [ref, inView];
}

/**
 * Who is looking at the screen, as a user id.
 *
 * Normally this is the Kinde session user. Inside the public demo
 * (/demo/*) there is no session — MockProvider sets
 * `window.__ETCH_DEMO_USER_ID__` instead, and that wins so reused pages
 * (chat alignment, "own message" affordances) behave as the demo persona.
 */
export function useViewerId() {
  const { user } = useKindeBrowserClient();
  if (typeof window !== "undefined" && window.__ETCH_DEMO_USER_ID__) {
    return window.__ETCH_DEMO_USER_ID__;
  }
  return user?.id ?? null;
}
