"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { mutate } from "swr";
import { toast } from "sonner";
import { todayDateStr } from "@/lib/dates";
import WaterSheet from "./sheets/WaterSheet";
import SleepSheet from "./sheets/SleepSheet";
import WeightSheet from "./sheets/WeightSheet";
import MoodSheet from "./sheets/MoodSheet";
import MealSheet from "./sheets/MealSheet";
import CardioSheet from "./sheets/CardioSheet";

const SHEETS = {
  water: WaterSheet,
  sleep: SleepSheet,
  weight: WeightSheet,
  mood: MoodSheet,
  meal: MealSheet,
  cardio: CardioSheet,
};

const LogContext = createContext({ openLog: () => {}, refreshAfterLog: () => {}, announce: () => {} });

/**
 * Lets any screen open any log sheet:
 *
 *   const { openLog } = useLog();
 *   openLog("water");
 *   openLog("meal", { slot: "dinner", date: "2026-10-27", onSaved: reload });
 *
 * After a save it shows one line with Undo, then refreshes every cached
 * request so Today, Log and Trends all show the new entry.
 */
export function LogProvider({ children }) {
  const [active, setActive] = useState(null); // { kind, date, slot, onSaved, n }
  const [open, setOpen] = useState(false);
  const counter = useRef(0);
  const pathname = usePathname();
  const demo = pathname?.startsWith("/demo") ?? false;

  const refreshAfterLog = useCallback((cb) => {
    mutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
    cb?.();
  }, []);

  const openLog = useCallback((kind, opts = {}) => {
    if (!SHEETS[kind]) return;
    counter.current += 1;
    setActive({ kind, date: opts.date ?? todayDateStr(), slot: opts.slot, onSaved: opts.onSaved, n: counter.current });
    setOpen(true);
  }, []);

  // One quiet line with Undo, used by the sheets and by one-tap quick logs.
  const announce = useCallback(
    ({ message, undo, after }) => {
      refreshAfterLog(after);
      toast(message, {
        duration: 5000,
        action: undo
          ? {
              label: "Undo",
              onClick: async () => {
                try {
                  await undo();
                  refreshAfterLog(after);
                  toast("Undone", { duration: 2000 });
                } catch {
                  toast.error("Could not undo. Edit it in Log instead.");
                }
              },
            }
          : undefined,
      });
    },
    [refreshAfterLog]
  );

  const onSaved = useCallback((result) => announce({ ...result, after: active?.onSaved }), [active, announce]);

  const value = useMemo(() => ({ openLog, refreshAfterLog, announce }), [openLog, refreshAfterLog, announce]);
  const Sheet = active ? SHEETS[active.kind] : null;

  return (
    <LogContext.Provider value={value}>
      {children}
      {Sheet ? (
        <Sheet
          key={active.n}
          open={open}
          onOpenChange={setOpen}
          initialDate={active.date}
          initialSlot={active.slot}
          onSaved={onSaved}
          demo={demo}
        />
      ) : null}
    </LogContext.Provider>
  );
}

export function useLog() {
  return useContext(LogContext);
}
