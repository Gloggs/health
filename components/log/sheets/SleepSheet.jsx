"use client";

import { useEffect, useMemo, useState } from "react";
import GlobalApi from "@/app/_services/GlobalApi";
import LogSheet from "../LogSheet";
import WhenPicker from "../WhenPicker";
import Ruler from "../Ruler";
import Scale from "../Scale";
import Usuals from "../Usuals";
import { addDays, dateStr } from "@/lib/dates";
import { formatDuration } from "@/lib/format";
import { minutesToTime, sleepMinutes, timeToMinutes, usualSleep } from "@/lib/usuals";

const QUALITY = [
  { value: 1, label: "Awful" },
  { value: 2, label: "Poor" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

// Bedtimes are measured from midday so 23:55 and 00:05 sit next to each
// other on the ruler instead of at opposite ends.
const NOON = 720;
const bedToRuler = (t) => ((timeToMinutes(t) ?? 1380) - NOON + 1440) % 1440;
const rulerToBed = (v) => minutesToTime(v + NOON);

export default function SleepSheet({ open, onOpenChange, initialDate, onSaved }) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState(null);
  const [bed, setBed] = useState(null);
  const [wake, setWake] = useState(null);
  const [quality, setQuality] = useState(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const from = dateStr(addDays(new Date(`${initialDate}T12:00:00`), -30));
    GlobalApi.GetSleep({ from, to: initialDate })
      .then((r) => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]));
  }, [initialDate]);

  const existing = useMemo(() => rows?.find((r) => r.date === date) ?? null, [rows, date]);
  const last = useMemo(() => rows?.find((r) => r.date !== date && r.bedtime && r.wakeTime) ?? null, [rows, date]);
  const usual = useMemo(() => usualSleep(rows ?? []), [rows]);

  useEffect(() => {
    if (!rows) return;
    const start = existing?.bedtime ? existing : usual ?? { bedtime: "23:00", wakeTime: "07:00" };
    setBed(start.bedtime?.slice(0, 5) ?? "23:00");
    setWake(start.wakeTime?.slice(0, 5) ?? "07:00");
    setQuality(existing?.quality ?? null);
    setNote(existing?.note ?? "");
  }, [rows, existing, usual]);

  const mins = bed && wake ? sleepMinutes(bed, wake) : null;
  const hours = mins ? Math.round((mins / 60) * 100) / 100 : null;

  const usuals = [];
  if (usual) {
    usuals.push({
      key: "usual",
      label: "Your usual",
      sub: `${usual.bedtime} to ${usual.wakeTime}`,
      on: bed === usual.bedtime && wake === usual.wakeTime,
      onPick: () => {
        setBed(usual.bedtime);
        setWake(usual.wakeTime);
      },
    });
  }
  if (last) {
    const lb = last.bedtime.slice(0, 5);
    const lw = last.wakeTime.slice(0, 5);
    usuals.push({
      key: "last",
      label: "Same as last",
      sub: `${lb} to ${lw}`,
      on: bed === lb && wake === lw,
      onPick: () => {
        setBed(lb);
        setWake(lw);
      },
    });
  }

  const save = async () => {
    const before = existing;
    const r = await GlobalApi.SaveSleep({ date, bedtime: bed, wakeTime: wake, hours, quality, note: note || null });
    const id = r.data?.id;
    onSaved({
      message: `Sleep, ${formatDuration(hours)} saved`,
      undo: before
        ? () =>
            GlobalApi.SaveSleep({
              date,
              bedtime: before.bedtime,
              wakeTime: before.wakeTime,
              hours: before.hours,
              quality: before.quality,
              note: before.note,
            })
        : id
        ? () => GlobalApi.DeleteSleep(id)
        : null,
    });
  };

  return (
    <LogSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Sleep"
      when={<WhenPicker value={date} onChange={setDate} todayLabel="Last night" yesterdayLabel="Night before" />}
      value={hours ? formatDuration(hours) : "Set your times"}
      aside={existing ? "Already logged. Saving replaces it." : null}
      saveLabel={hours ? `Save ${formatDuration(hours)}` : "Save"}
      canSave={!!hours}
      onSave={save}
      note={note}
      onNoteChange={setNote}
    >
      <Usuals label="Sleep shortcuts" items={usuals} columns={2} />
      {bed ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Went to bed</span>
          <Ruler
            label="Bedtime"
            value={bedToRuler(bed)}
            onChange={(v) => setBed(rulerToBed(v))}
            min={0}
            max={1435}
            step={5}
            majorEvery={6}
            format={rulerToBed}
          />
        </div>
      ) : null}
      {wake ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Woke up</span>
          <Ruler
            label="Wake time"
            value={timeToMinutes(wake) ?? 420}
            onChange={(v) => setWake(minutesToTime(v))}
            min={0}
            max={1435}
            step={5}
            majorEvery={6}
            format={minutesToTime}
          />
        </div>
      ) : null}
      <Scale label="How did you sleep?" options={QUALITY} value={quality} onChange={setQuality} />
    </LogSheet>
  );
}
