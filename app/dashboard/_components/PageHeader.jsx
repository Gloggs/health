"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Header used at the top of sub-pages. The back arrow uses router.back()
// so navigation respects history - e.g. coming from Train into a plan,
// the back arrow returns to Train, not a hard-coded /plans.
//
// `fallback` is used only when there's no browser history (deep-link).
// `backLabel` overrides the derived label next to the arrow.

// Maps dashboard fallback paths to a short label so the back arrow can
// say where it's going. Falls back to "Back" for unknown paths.
const LABELS = {
  "/dashboard": "Today",
  "/dashboard/log": "Log",
  "/dashboard/me": "Me",
  "/dashboard/me/trends": "Trends",
  "/dashboard/trends": "Trends",
  "/dashboard/train": "Train",
  "/dashboard/plans": "Plans",
  "/dashboard/exercises": "Exercises",
  "/dashboard/chat": "Chat",
  "/dashboard/family": "Family",
  "/dashboard/settings": "Settings",
};

function labelFor(path) {
  if (!path) return "Back";
  return LABELS[path] ?? "Back";
}

export default function PageHeader({
  fallback = "/dashboard",
  icon: Icon,
  title,
  subtitle,
  backLabel,
}) {
  const router = useRouter();
  const label = backLabel ?? labelFor(fallback);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={goBack}
        aria-label={`Back to ${label}`}
        className="inline-flex h-11 shrink-0 items-center gap-1.5 border border-foreground bg-card px-3 text-sm font-semibold"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{label}</span>
      </button>
      {Icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <div className="flex-1">
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );
}
