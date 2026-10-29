"use client";

import GlobalApi from "@/app/_services/GlobalApi";
import LogHistory from "@/components/log/LogHistory";
import { daysAgoStr, todayDateStr } from "@/lib/dates";

const MOOD = { 1: "Low", 2: "Meh", 3: "Okay", 4: "Good", 5: "Great" };
const ENERGY = { 1: "drained", 2: "tired", 3: "steady", 4: "good energy", 5: "wired" };

const load = () => GlobalApi.GetMood({ from: daysAgoStr(60), to: todayDateStr() }).then((r) => r.data);

const describe = (r) => ({
  title: r.mood ? `${MOOD[r.mood]}, ${r.mood} of 5` : "Energy",
  detail: [ENERGY[r.energy], ...(Array.isArray(r.tags) ? r.tags : [])].filter(Boolean).join(", "),
});

const remove = async (r) => {
  await GlobalApi.DeleteMood(r.id);
  return () => GlobalApi.SaveMood({ date: r.date, mood: r.mood, energy: r.energy, tags: r.tags ?? [], note: r.note });
};

export default function MoodLogPage() {
  return <LogHistory kind="mood" title="Mood and energy" logLabel="Log mood" load={load} describe={describe} remove={remove} />;
}
