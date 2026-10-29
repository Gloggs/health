"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import GlobalApi from "@/app/_services/GlobalApi";
import { useLog } from "@/components/log/LogProvider";
import { cn } from "@/lib/utils";

// Everything search can find that does not need the network. `go` is a path
// under the base; `log` opens a log sheet instead.
function staticItems(base) {
  const page = (label, path, words = "") => ({ group: "Go to", label, words, go: base + path });
  const log = (label, kind, words = "") => ({ group: "Log", label, words, log: kind });
  return [
    log("Log water", "water", "drink glass bottle mug hydration"),
    log("Log sleep", "sleep", "bed bedtime wake night"),
    log("Log weight", "weight", "weigh scale body kg"),
    log("Log cardio", "cardio", "walk run cycle swim steps"),
    log("Log a meal", "meal", "food breakfast lunch dinner snack eat"),
    log("Log mood and energy", "mood", "feeling energy tags"),
    page("Today", "", "home"),
    page("Log", "/log", "history"),
    page("Sleep history", "/log/sleep"),
    page("Water history", "/log/water"),
    page("Weight and body measurements", "/log/body", "waist chest arms hips thighs"),
    page("Cardio history", "/log/cardio"),
    page("Meal history", "/log/meals", "food"),
    page("Mood history", "/log/mood", "feelings tags"),
    page("Journal", "/journal", "notes diary private"),
    page("Train", "/train", "workout gym session"),
    page("Plans", "/plans", "programme routine week"),
    page("Exercise library", "/exercises", "lifts moves"),
    page("Trends", "/trends", "charts averages progress"),
    page("Family", "/family", "members leaderboard"),
    page("Family chat", "/chat", "messages room"),
    page("You", "/me", "profile account"),
    page("Settings", "/settings", "preferences"),
    page("Profile: name, date of birth, height", "/settings?tab=profile"),
    page("Water target and goals", "/settings?tab=coach", "target goal"),
    page("What your family sees", "/settings?tab=privacy", "privacy visibility share hide"),
    page("Light or dark mode", "/settings?tab=appearance", "theme display units kg lb"),
    page("Export my data", "/me", "download json backup"),
    page("Invite someone", "/family", "join link add member"),
  ];
}

function score(item, q) {
  const label = item.label.toLowerCase();
  // Any word starting with the term is a strong match; log actions win ties,
  // so "water" offers "Log water" before "Water history".
  if (label.startsWith(q) || label.split(/[\s:,]+/).some((w) => w.startsWith(q))) return 0;
  if (label.includes(q)) return 2;
  if (item.words?.includes(q)) return 3;
  return -1;
}

/**
 * One search box for the whole app: pages, settings, log actions, your
 * exercises, plans and family members. Opens with "/" or Ctrl/Cmd + K.
 */
export default function SearchPalette({ open, onOpenChange, base }) {
  const router = useRouter();
  const { openLog } = useLog();
  const [q, setQ] = useState("");
  const [extra, setExtra] = useState([]);
  const [index, setIndex] = useState(0);
  const loaded = useRef(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setIndex(0);
    if (loaded.current) return;
    loaded.current = true;
    Promise.allSettled([GlobalApi.ListExercises(), GlobalApi.ListPlans(), GlobalApi.GetFamily()]).then(([ex, pl, fam]) => {
      const out = [];
      for (const e of ex.value?.data ?? []) out.push({ group: "Exercises", label: e.name, words: `${e.muscleGroup} ${e.equipment}`.toLowerCase(), go: `${base}/exercises` });
      for (const p of pl.value?.data ?? []) out.push({ group: "Plans", label: p.name, words: "plan", go: `${base}/plans/${p.id}` });
      for (const m of fam?.value?.data?.members ?? []) {
        if (m.displayName) out.push({ group: "Family", label: m.displayName, words: "member", go: `${base}?viewing=${m.id}` });
      }
      setExtra(out);
    });
  }, [open, base]);

  const all = useMemo(() => [...staticItems(base), ...extra], [base, extra]);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all.filter((i) => i.group === "Log").concat(all.filter((i) => i.group === "Go to").slice(0, 6));
    return all
      .map((i) => ({ i, s: score(i, term) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => a.s - b.s || (a.i.log ? 0 : 1) - (b.i.log ? 0 : 1))
      .slice(0, 12)
      .map((x) => x.i);
  }, [all, q]);

  useEffect(() => setIndex(0), [q]);

  const run = (item) => {
    onOpenChange(false);
    if (item.log) openLog(item.log);
    else if (item.go) router.push(item.go);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[index]) {
      e.preventDefault();
      run(results[index]);
    }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  let lastGroup = null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-0 z-50 flex max-h-[85dvh] flex-col border-b border-foreground bg-card text-foreground outline-none md:left-1/2 md:top-[10vh] md:w-[560px] md:-translate-x-1/2 md:border"
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="h-5 w-5 shrink-0" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search logs, exercises, plans, settings"
              aria-label="Search"
              role="combobox"
              aria-expanded="true"
              aria-controls="search-results"
              aria-activedescendant={results[index] ? `search-${index}` : undefined}
              className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            <Dialog.Close className="h-11 px-2 text-sm font-semibold">Close</Dialog.Close>
          </div>
          <ul id="search-results" role="listbox" ref={listRef} className="overflow-y-auto py-2">
            {results.length === 0 ? (
              <li className="px-4 py-6 text-muted-foreground">Nothing found for "{q}".</li>
            ) : (
              results.map((item, i) => {
                const header = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                return (
                  <li key={`${item.group}-${item.label}-${i}`} role="presentation">
                    {header ? (
                      <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{header}</p>
                    ) : null}
                    <div
                      id={`search-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === index}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => run(item)}
                      className={cn("flex min-h-[48px] cursor-pointer items-center px-4 text-base", i === index && "bg-accent font-semibold")}
                    >
                      {item.label}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
