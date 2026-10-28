"use client";

import GlobalApi from "@/app/_services/GlobalApi";
import LogHistory from "@/components/log/LogHistory";
import { daysAgoStr, todayDateStr } from "@/lib/dates";

const QUALITY = { 3: "Healthy", 2: "Mixed", 1: "Treat" };
const ORDER = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "Meal");

const load = () =>
  GlobalApi.GetMeals({ from: daysAgoStr(30), to: todayDateStr() }).then((r) =>
    (r.data ?? []).slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (ORDER[a.slot] ?? 9) - (ORDER[b.slot] ?? 9)))
  );

const describe = (r) => ({
  title: cap(r.slot),
  detail: [r.description, QUALITY[r.quality]].filter(Boolean).join(", "),
});

const remove = async (r) => {
  await GlobalApi.DeleteMeal(r.id);
  return () => GlobalApi.SaveMeal({ date: r.date, slot: r.slot, description: r.description, quality: r.quality });
};

export default function MealsLogPage() {
  return <LogHistory kind="meal" title="Meals" logLabel="Log a meal" load={load} describe={describe} remove={remove} />;
}
