"use client";

import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import FlappyBird from "./FlappyBird";
import CrossyRoad from "./CrossyRoad";

// Landing-page section that hosts the two mini-games. Lives between
// the Hero and Features sections so visitors see it while skimming.
//
// Active-tab tracking is needed because each game runs its own
// requestAnimationFrame loop; pausing the inactive one (via the `active`
// prop) prevents two concurrent loops fighting over the keyboard.
//
// Tab choice persisted in localStorage so a sibling who picked Crossy
// on their phone lands on Crossy again next visit.

const STORAGE_KEY = "landingGameTab";

export default function GameSection() {
  // SSR-safe: default to flappy, then promote any saved choice on mount.
  const [tab, setTab] = useState("flappy");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "flappy" || saved === "crossy") setTab(saved);
  }, []);

  const switchTab = (next) => {
    setTab(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  return (
    <section className="border-t bg-muted/20 py-20">
      <div className="mx-auto max-w-3xl px-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            Take a break
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            One of the family favourites
          </h2>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            Two browser-classics built into the page. Best score per device is
            yours - we don't track it anywhere else.
          </p>

          <div className="mt-6 inline-flex rounded-lg border bg-card p-1">
            <TabBtn
              active={tab === "flappy"}
              onClick={() => switchTab("flappy")}
              label="Flappy"
            />
            <TabBtn
              active={tab === "crossy"}
              onClick={() => switchTab("crossy")}
              label="Crossy"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          {/* Both games are mounted so internal high-score state survives
              the tab switch, but only the active one runs its loop. */}
          <div className={tab === "flappy" ? "block" : "hidden"}>
            <FlappyBird active={tab === "flappy"} />
          </div>
          <div className={tab === "crossy" ? "block" : "hidden"}>
            <CrossyRoad active={tab === "crossy"} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TabBtn({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
