"use client";

import { useEffect, useMemo, useState } from "react";
import GlobalApi from "@/app/_services/GlobalApi";
import LogSheet from "../LogSheet";
import WhenPicker from "../WhenPicker";
import Scale from "../Scale";
import { addDays, dateStr } from "@/lib/dates";
import { defaultMealSlot, MEAL_SLOTS, mealUsuals } from "@/lib/usuals";

const SLOT_OPTIONS = MEAL_SLOTS.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));
const QUALITY = [
  { value: 3, label: "Healthy" },
  { value: 2, label: "Mixed" },
  { value: 1, label: "Treat" },
];

export default function MealSheet({ open, onOpenChange, initialDate, initialSlot, onSaved }) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState([]);
  const [slot, setSlot] = useState(initialSlot ?? defaultMealSlot(new Date().getHours()));
  const [description, setDescription] = useState("");
  const [quality, setQuality] = useState(null);

  useEffect(() => {
    const from = dateStr(addDays(new Date(`${initialDate}T12:00:00`), -60));
    GlobalApi.GetMeals({ from, to: initialDate })
      .then((r) => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]));
  }, [initialDate]);

  const usuals = useMemo(() => mealUsuals(rows, slot), [rows, slot]);
  const slotLabel = SLOT_OPTIONS.find((s) => s.value === slot)?.label ?? "Meal";

  const save = async () => {
    const r = await GlobalApi.SaveMeal({ date, slot, description: description.trim() || null, quality });
    const id = r.data?.id;
    onSaved({
      message: `${slotLabel} saved`,
      undo: id ? () => GlobalApi.DeleteMeal(id) : null,
    });
  };

  return (
    <LogSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Meal"
      when={<WhenPicker value={date} onChange={setDate} />}
      saveLabel={`Save ${slotLabel.toLowerCase()}`}
      canSave={!!description.trim() || quality != null}
      onSave={save}
    >
      <Scale label="Which meal" options={SLOT_OPTIONS} value={slot} onChange={(v) => v && setSlot(v)} allowClear={false} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="meal-description" className="text-sm font-semibold">
          What did you have?
        </label>
        <input
          id="meal-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          autoComplete="off"
          className="h-12 border border-foreground bg-card px-3 text-base"
        />
        {usuals.length ? (
          <div role="group" aria-label="Your usual meals" className="flex flex-wrap gap-1.5">
            {usuals.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDescription(u)}
                aria-pressed={description.trim().toLowerCase() === u.toLowerCase()}
                className="h-9 border border-border bg-background px-2.5 text-sm"
              >
                {u}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <Scale label="How was it?" options={QUALITY} value={quality} onChange={setQuality} />
      <p className="-mt-2 text-sm text-muted-foreground">No calories to count. Just a rough idea.</p>
    </LogSheet>
  );
}
