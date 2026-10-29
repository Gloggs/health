"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GlobalApi from "@/app/_services/GlobalApi";
import LogSheet from "../LogSheet";
import WhenPicker from "../WhenPicker";
import Ruler from "../Ruler";
import Usuals from "../Usuals";
import { addDays, dateStr } from "@/lib/dates";

const MEASURES = ["waistCm", "chestCm", "armsCm", "hipsCm", "thighsCm"];

export default function WeightSheet({ open, onOpenChange, initialDate, onSaved, demo = false }) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState(null);
  const [kg, setKg] = useState(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const from = dateStr(addDays(new Date(`${initialDate}T12:00:00`), -120));
    GlobalApi.GetBody({ from, to: initialDate })
      .then((r) => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]));
  }, [initialDate]);

  const existing = useMemo(() => rows?.find((r) => r.date === date) ?? null, [rows, date]);
  const last = useMemo(() => rows?.find((r) => r.date !== date && r.weightKg != null) ?? null, [rows, date]);

  useEffect(() => {
    if (!rows) return;
    const start = existing?.weightKg ?? last?.weightKg ?? 75;
    setKg(Math.round(Number(start) * 10) / 10);
    setNote(existing?.note ?? "");
  }, [rows, existing, last]);

  const value = kg ?? 75;
  const lastKg = last?.weightKg != null ? Number(last.weightKg) : null;
  const diff = lastKg != null ? Math.round((value - lastKg) * 10) / 10 : null;
  const aside =
    diff == null ? null : diff === 0 ? "Same as last time" : `${Math.abs(diff).toFixed(1)} kg ${diff < 0 ? "down" : "up"} on last`;

  const save = async () => {
    const before = existing;
    const keep = Object.fromEntries(MEASURES.map((k) => [k, before?.[k] ?? null]));
    const r = await GlobalApi.SaveBody({ date, weightKg: value, ...keep, note: note || null });
    const id = r.data?.id;
    onSaved({
      message: `Weight, ${value.toFixed(1)} kg saved`,
      undo: before
        ? () => GlobalApi.SaveBody({ date, weightKg: before.weightKg, ...keep, note: before.note })
        : id
        ? () => GlobalApi.DeleteBody(id)
        : null,
    });
  };

  return (
    <LogSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Weight"
      when={<WhenPicker value={date} onChange={setDate} />}
      value={`${value.toFixed(1)} kg`}
      aside={aside}
      saveLabel={`Save ${value.toFixed(1)} kg`}
      onSave={save}
      note={note}
      onNoteChange={setNote}
    >
      {lastKg != null ? (
        <Usuals
          label="Weight shortcuts"
          columns={1}
          items={[{ key: "last", label: "Same as last", sub: `${lastKg.toFixed(1)} kg`, on: value === lastKg, onPick: () => setKg(lastKg) }]}
        />
      ) : null}
      <Ruler
        label="Weight"
        value={value}
        onChange={setKg}
        min={25}
        max={300}
        step={0.1}
        majorEvery={5}
        format={(v) => v.toFixed(1)}
      />
      <Link
        href={demo ? "/demo/log/body" : "/dashboard/log/body"}
        className="flex h-12 items-center justify-center border border-foreground font-semibold"
      >
        Body measurements
      </Link>
    </LogSheet>
  );
}
