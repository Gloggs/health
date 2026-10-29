"use client";

import { toast } from "sonner";

/**
 * The one confirmation the app shows after a change: a quiet line at the
 * bottom with Undo when the change can be reversed, and a short buzz on
 * phones that support it. The log sheets use the same line (LogProvider).
 *
 *   saved({ message: "Today, done.", onUndo: () => ... })
 */
export function saved({ message, onUndo } = {}) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  } catch {
    // Some browsers throw when vibration is blocked; it is only a nicety.
  }
  if (!message) return;
  toast(message, {
    duration: onUndo ? 5000 : 2500,
    action: onUndo ? { label: "Undo", onClick: onUndo } : undefined,
  });
}
