"use client";

import { useEffect, useMemo, useState } from "react";
import GlobalApi from "@/app/_services/GlobalApi";
import LogSheet from "../LogSheet";
import WhenPicker from "../WhenPicker";
import Scale from "../Scale";
import { addDays, dateStr } from "@/lib/dates";
import { moodTagUsuals, normaliseTags } from "@/lib/usuals";
import { cn } from "@/lib/utils";

const MOOD = [
  { value: 1, hint: 1, label: "Low" },
  { value: 2, hint: 2, label: "Meh" },
  { value: 3, hint: 3, label: "Okay" },
  { value: 4, hint: 4, label: "Good" },
  { value: 5, hint: 5, label: "Great" },
];
const ENERGY = [
  { value: 1, label: "Drained" },
  { value: 2, label: "Tired" },
  { value: 3, label: "Steady" },
  { value: 4, label: "Good" },
  { value: 5, label: "Wired" },
];

export default function MoodSheet({ open, onOpenChange, initialDate, onSaved }) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState(null);
  const [mood, setMood] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const from = dateStr(addDays(new Date(`${initialDate}T12:00:00`), -60));
    GlobalApi.GetMood({ from, to: initialDate })
      .then((r) => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]));
  }, [initialDate]);

  const existing = useMemo(() => rows?.find((r) => r.date === date) ?? null, [rows, date]);
  const offered = useMemo(() => {
    const base = moodTagUsuals(rows ?? []);
    const extra = tags.filter((t) => !base.some((b) => b.toLowerCase() === t.toLowerCase()));
    return [...base, ...extra];
  }, [rows, tags]);

  useEffect(() => {
    if (!rows) return;
    setMood(existing?.mood ?? null);
    setEnergy(existing?.energy ?? null);
    setTags(Array.isArray(existing?.tags) ? existing.tags : []);
    setNote(existing?.note ?? "");
  }, [rows, existing]);

  const toggle = (t) =>
    setTags((cur) => (cur.some((c) => c.toLowerCase() === t.toLowerCase()) ? cur.filter((c) => c.toLowerCase() !== t.toLowerCase()) : normaliseTags([...cur, t])));

  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    setTags((cur) => normaliseTags([...cur, t]));
    setNewTag("");
  };

  const moodLabel = MOOD.find((m) => m.value === mood)?.label;

  const save = async () => {
    const before = existing;
    const r = await GlobalApi.SaveMood({ date, mood, energy, tags, note: note || null });
    const id = r.data?.id;
    onSaved({
      message: moodLabel ? `Mood, ${moodLabel.toLowerCase()} saved` : "Energy saved",
      undo: before
        ? () => GlobalApi.SaveMood({ date, mood: before.mood, energy: before.energy, tags: before.tags ?? [], note: before.note })
        : id
        ? () => GlobalApi.DeleteMood(id)
        : null,
    });
  };

  return (
    <LogSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Mood and energy"
      when={<WhenPicker value={date} onChange={setDate} />}
      value={moodLabel ? `${moodLabel}, ${mood} of 5` : "How are you?"}
      canSave={mood != null || energy != null}
      onSave={save}
      note={note}
      onNoteChange={setNote}
    >
      <Scale label="Mood" options={MOOD} value={mood} onChange={setMood} tall />
      <Scale label="Energy" options={ENERGY} value={energy} onChange={setEnergy} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">What played a part? Optional</legend>
        <div className="flex flex-wrap gap-1.5">
          {offered.map((t) => {
            const on = tags.some((c) => c.toLowerCase() === t.toLowerCase());
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t)}
                className={cn(
                  "h-10 px-3 text-sm",
                  on ? "bg-foreground font-bold text-background" : "border border-foreground bg-card font-semibold"
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            maxLength={24}
            placeholder="Add your own"
            aria-label="Add your own tag"
            className="h-10 border border-foreground bg-card px-2 text-base"
          />
          <button type="button" onClick={addTag} className="h-10 border border-foreground px-3 text-sm font-semibold">
            Add
          </button>
        </div>
      </fieldset>
    </LogSheet>
  );
}
