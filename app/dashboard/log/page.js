"use client";

import Link from "next/link";
import {
  Bed,
  Droplet,
  Smile,
  Scale,
  Footprints,
  UtensilsCrossed,
  ArrowRight,
} from "lucide-react";
import PageHero from "../_components/PageHero";

// Tile palette mirrors the Today dashboard tones so the modules read as the
// same modules - purple for sleep, cyan for water, etc.
const TILES = [
  {
    href: "/dashboard/log/sleep",
    label: "Sleep",
    desc: "Bedtime, wake, quality",
    icon: Bed,
    tone: "bg-[hsl(var(--chart-5)/0.14)] text-[hsl(var(--chart-5))]",
  },
  {
    href: "/dashboard/log/water",
    label: "Water",
    desc: "Tap to add intake",
    icon: Droplet,
    tone: "bg-[hsl(var(--chart-4)/0.14)] text-[hsl(var(--chart-4))]",
  },
  {
    href: "/dashboard/log/mood",
    label: "Mood + energy",
    desc: "Daily check-in",
    icon: Smile,
    tone: "bg-[hsl(var(--chart-2)/0.18)] text-[hsl(var(--chart-2))]",
  },
  {
    href: "/dashboard/log/body",
    label: "Body",
    desc: "Weight + measurements",
    icon: Scale,
    tone: "bg-primary/10 text-primary",
  },
  {
    href: "/dashboard/log/cardio",
    label: "Walks + cardio",
    desc: "Walks, runs, cycles",
    icon: Footprints,
    tone: "bg-[hsl(var(--chart-3)/0.14)] text-[hsl(var(--chart-3))]",
  },
  {
    href: "/dashboard/log/meals",
    label: "Meals",
    desc: "Breakfast, lunch, dinner, snacks",
    icon: UtensilsCrossed,
    tone: "bg-primary/10 text-primary",
  },
];

export default function LogHubPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <PageHero
        eyebrow="log"
        title="Off the mat"
        subtitle="Sleep, water, mood, body, walks, meals — every history at a glance."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map(({ href, label, desc, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className="hover-lift group flex items-center gap-4 rounded-xl bg-card/50 p-4 transition-colors hover:bg-card"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{label}</p>
              <p className="truncate text-xs text-muted-foreground">{desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
