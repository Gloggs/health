"use client";

import GlobalApi from "@/app/_services/GlobalApi";
import LogHistory from "@/components/log/LogHistory";
import { daysAgoStr, todayDateStr } from "@/lib/dates";

const load = () => GlobalApi.GetCardio({ from: daysAgoStr(90), to: todayDateStr() }).then((r) => r.data);

const describe = (r) => ({
  title: `${r.type ?? "Cardio"}, ${r.durationMinutes ?? "?"} min`,
  detail: [r.distanceKm ? `${Number(r.distanceKm).toFixed(1)} km` : null, r.note].filter(Boolean).join(", "),
});

const remove = async (r) => {
  await GlobalApi.DeleteCardio(r.id);
  return () =>
    GlobalApi.AddCardio({ date: r.date, type: r.type, durationMinutes: r.durationMinutes, distanceKm: r.distanceKm, steps: r.steps, note: r.note });
};

export default function CardioLogPage() {
  return <LogHistory kind="cardio" title="Cardio" logLabel="Log cardio" load={load} describe={describe} remove={remove} />;
}
