"use client";

import GlobalApi from "@/app/_services/GlobalApi";
import LogHistory from "@/components/log/LogHistory";
import { daysAgoStr, todayDateStr } from "@/lib/dates";
import { formatDuration } from "@/lib/format";

const QUALITY = { 1: "Awful", 2: "Poor", 3: "Okay", 4: "Good", 5: "Great" };

const load = () => GlobalApi.GetSleep({ from: daysAgoStr(60), to: todayDateStr() }).then((r) => r.data);

const describe = (r) => ({
  title: r.hours ? formatDuration(Number(r.hours)) : "Sleep",
  detail: [r.bedtime && r.wakeTime ? `${r.bedtime.slice(0, 5)} to ${r.wakeTime.slice(0, 5)}` : null, QUALITY[r.quality]]
    .filter(Boolean)
    .join(", "),
});

const remove = async (r) => {
  await GlobalApi.DeleteSleep(r.id);
  return () =>
    GlobalApi.SaveSleep({ date: r.date, bedtime: r.bedtime, wakeTime: r.wakeTime, hours: r.hours, quality: r.quality, note: r.note });
};

export default function SleepLogPage() {
  return <LogHistory kind="sleep" title="Sleep" logLabel="Log sleep" load={load} describe={describe} remove={remove} />;
}
