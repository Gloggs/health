"use client";

import { useEffect, useMemo, useState } from "react";
import GlobalApi from "@/app/_services/GlobalApi";
import LogSheet from "../LogSheet";
import WhenPicker from "../WhenPicker";
import Ruler from "../Ruler";
import Usuals from "../Usuals";
import { normaliseContainers } from "@/lib/usuals";

const litres = (ml) => `${(ml / 1000).toFixed(2).replace(/\.?0+$/, "")} L`;

export default function WaterSheet({ open, onOpenChange, initialDate, onSaved }) {
  const [date, setDate] = useState(initialDate);
  const [ctx, setCtx] = useState(null);
  const [dayTotal, setDayTotal] = useState(0);
  const [amount, setAmount] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);

  useEffect(() => {
    GlobalApi.GetUserContext().then((r) => setCtx(r.data ?? {})).catch(() => setCtx({}));
  }, []);
  useEffect(() => {
    GlobalApi.GetWater({ date })
      .then((r) => setDayTotal(r.data?.totalMl ?? 0))
      .catch(() => setDayTotal(0));
  }, [date]);

  const containers = useMemo(() => normaliseContainers(ctx?.waterContainers), [ctx]);
  const goal = ctx?.waterTargetMl || 2500;
  useEffect(() => {
    if (amount == null && ctx) setAmount(containers[0].ml);
  }, [ctx, containers, amount]);

  const value = amount ?? 250;

  const save = async () => {
    const r = await GlobalApi.AddWater({ date, amountMl: value });
    const id = r.data?.id;
    onSaved({
      message: `Water, ${value} ml saved`,
      undo: id ? () => GlobalApi.DeleteWater(id) : null,
    });
  };

  const saveContainers = async () => {
    const next = normaliseContainers(draft);
    const r = await GlobalApi.SaveUserContext({ waterContainers: next });
    setCtx(r.data ?? { ...ctx, waterContainers: next });
    setEditing(false);
  };

  return (
    <LogSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Water"
      when={<WhenPicker value={date} onChange={setDate} />}
      value={`${value} ml`}
      aside={`Day total ${litres(dayTotal + value)} of ${litres(goal)}`}
      saveLabel={`Save ${value} ml`}
      onSave={save}
    >
      <div className="h-2 bg-muted" aria-hidden>
        <div className="h-2 bg-harbour" style={{ width: `${Math.min(100, ((dayTotal + value) / goal) * 100)}%` }} />
      </div>

      {editing ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Your containers</legend>
          {draft.map((c, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_44px] gap-2">
              <input
                aria-label={`Container ${i + 1} name`}
                value={c.name}
                maxLength={20}
                onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, name: e.target.value } : d)))}
                className="h-11 border border-foreground bg-card px-2 text-base"
              />
              <input
                aria-label={`Container ${i + 1} size in ml`}
                type="number"
                inputMode="numeric"
                min={50}
                max={2000}
                step={10}
                value={c.ml}
                onChange={(e) => setDraft(draft.map((d, j) => (j === i ? { ...d, ml: e.target.value } : d)))}
                className="h-11 border border-foreground bg-card px-2 text-base"
              />
              <button
                type="button"
                aria-label={`Remove ${c.name || "container"}`}
                onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                className="h-11 border border-foreground text-lg"
              >
                -
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            {draft.length < 6 ? (
              <button
                type="button"
                onClick={() => setDraft([...draft, { name: "", ml: 250 }])}
                className="h-11 flex-1 border border-foreground font-semibold"
              >
                Add container
              </button>
            ) : null}
            <button type="button" onClick={saveContainers} className="h-11 flex-1 bg-foreground font-bold text-background">
              Save containers
            </button>
          </div>
        </fieldset>
      ) : (
        <div className="flex flex-col gap-2">
          <Usuals
            label="Your containers"
            items={containers.map((c) => ({
              key: c.name,
              label: c.name,
              sub: `${c.ml} ml`,
              on: c.ml === value,
              onPick: () => setAmount(c.ml),
            }))}
          />
          <button
            type="button"
            onClick={() => {
              setDraft(containers);
              setEditing(true);
            }}
            className="self-start text-sm font-semibold text-harbour underline underline-offset-4"
          >
            Edit containers
          </button>
        </div>
      )}

      <Ruler label="Amount" value={value} onChange={setAmount} min={25} max={2000} step={25} majorEvery={4} />
    </LogSheet>
  );
}
