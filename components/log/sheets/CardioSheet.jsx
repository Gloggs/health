"use client";

import { useEffect, useMemo, useState } from "react";
import GlobalApi from "@/app/_services/GlobalApi";
import LogSheet from "../LogSheet";
import WhenPicker from "../WhenPicker";
import Ruler from "../Ruler";
import Scale from "../Scale";
import Usuals from "../Usuals";
import { addDays, dateStr } from "@/lib/dates";
import { cardioUsuals } from "@/lib/usuals";

const TYPES = ["Walk", "Run", "Cycle", "Swim", "Other"].map((t) => ({ value: t, label: t }));

function pace(minutes, km) {
  if (!minutes || !km) return null;
  const perKm = minutes / km;
  const m = Math.floor(perKm);
  const s = Math.round((perKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} per km`;
}

export default function CardioSheet({ open, onOpenChange, initialDate, onSaved }) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState([]);
  const [type, setType] = useState("Walk");
  const [minutes, setMinutes] = useState(30);
  const [withDistance, setWithDistance] = useState(false);
  const [km, setKm] = useState(3);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const from = dateStr(addDays(new Date(`${initialDate}T12:00:00`), -60));
    GlobalApi.GetCardio({ from, to: initialDate })
      .then((r) => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]));
  }, [initialDate]);

  const usuals = useMemo(() => cardioUsuals(rows), [rows]);
  const last = rows.find((r) => r.type && r.durationMinutes) ?? null;

  const apply = (u) => {
    setTouched(true);
    setType(TYPES.some((t) => t.value === u.type) ? u.type : "Other");
    setMinutes(u.durationMinutes);
    if (u.distanceKm) {
      setWithDistance(true);
      setKm(Math.round(Number(u.distanceKm) * 10) / 10);
    } else setWithDistance(false);
  };

  // Start from the person's most usual session the first time it loads.
  useEffect(() => {
    if (!touched && usuals[0]) apply(usuals[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuals]);

  const same = (u) => u && u.type === type && Number(u.durationMinutes) === minutes;
  const items = usuals.map((u, i) => ({
    key: `u${i}`,
    label: `${u.type}, ${u.durationMinutes} min`,
    sub: u.distanceKm ? `${Number(u.distanceKm).toFixed(1)} km` : "Usual",
    on: same(u),
    onPick: () => apply(u),
  }));
  if (last && !usuals.some((u) => u.type === last.type && u.durationMinutes === Number(last.durationMinutes))) {
    items.push({
      key: "last",
      label: "Same as last",
      sub: `${last.type}, ${last.durationMinutes} min`,
      on: false,
      onPick: () => apply({ type: last.type, durationMinutes: Number(last.durationMinutes), distanceKm: last.distanceKm }),
    });
  }

  const save = async () => {
    const r = await GlobalApi.AddCardio({
      date,
      type,
      durationMinutes: minutes,
      distanceKm: withDistance ? km : null,
      note: note || null,
    });
    const id = r.data?.id;
    onSaved({
      message: `${type}, ${minutes} min saved`,
      undo: id ? () => GlobalApi.DeleteCardio(id) : null,
    });
  };

  return (
    <LogSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Cardio"
      when={<WhenPicker value={date} onChange={setDate} />}
      value={`${minutes} min`}
      aside={withDistance ? [`${km.toFixed(1)} km`, pace(minutes, km)].filter(Boolean).join(", ") : null}
      saveLabel={`Save ${minutes} min ${type.toLowerCase()}`}
      onSave={save}
      note={note}
      onNoteChange={setNote}
    >
      <Scale label="Type" options={TYPES} value={type} onChange={(v) => v && setType(v)} allowClear={false} />
      <Usuals label="Your usual sessions" items={items.slice(0, 3)} columns={Math.min(items.length, 3) || 1} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">How long</span>
        <Ruler label="Minutes" value={minutes} onChange={setMinutes} min={1} max={300} step={1} majorEvery={10} format={(v) => `${v}`} />
      </div>
      {withDistance ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Distance</span>
            <button type="button" onClick={() => setWithDistance(false)} className="text-sm font-semibold text-harbour underline underline-offset-4">
              Remove distance
            </button>
          </div>
          <Ruler label="Kilometres" value={km} onChange={setKm} min={0.1} max={200} step={0.1} majorEvery={10} format={(v) => v.toFixed(1)} />
        </div>
      ) : (
        <button type="button" onClick={() => setWithDistance(true)} className="h-12 border border-foreground font-semibold">
          Add distance
        </button>
      )}
    </LogSheet>
  );
}
