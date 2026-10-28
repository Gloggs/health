"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import PageHeader from "@/app/dashboard/_components/PageHeader";
import { useLog } from "@/components/log/LogProvider";
import { prettyDate } from "@/lib/dates";

/**
 * One layout for every Log page: a button that opens the log sheet, then
 * past entries. Tapping an entry opens the sheet for that day. Deleting
 * an entry happens straight away, with Undo, like every other change.
 *
 *   kind       which log sheet to open
 *   load       async () => rows, newest first
 *   describe   (row) => { title, detail }
 *   remove     async (row) => undo function, or null if it cannot be undone
 *   extra      optional content between the button and the list
 */
export default function LogHistory({ kind, title, logLabel, load, describe, remove, extra, emptyText = "Nothing logged yet." }) {
  const { openLog, announce } = useLog();
  const [rows, setRows] = useState(null);

  const reload = useCallback(() => {
    load()
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch(() => setRows([]));
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  const del = async (row) => {
    const undo = await remove(row);
    const { title: what } = describe(row);
    announce({
      message: `${what} deleted`,
      undo: undo ?? null,
      after: reload,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
      <PageHeader fallback="/dashboard/log" title={title} />

      <button
        type="button"
        onClick={() => openLog(kind, { onSaved: reload })}
        className="h-14 bg-foreground text-lg font-bold text-background"
      >
        {logLabel}
      </button>

      {extra}

      <section aria-labelledby={`${kind}-history`} className="flex flex-col gap-2">
        <h2 id={`${kind}-history`} className="font-display text-xl font-bold uppercase">
          History
        </h2>
        {rows === null ? (
          <div className="h-40 animate-pulse bg-muted" aria-label="Loading" />
        ) : rows.length === 0 ? (
          <p className="border border-border bg-card p-4 text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="border border-border bg-card">
            {rows.map((row, i) => {
              const { title: t, detail } = describe(row);
              return (
                <li key={row.id ?? `${row.date}-${i}`} className="flex items-center border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => openLog(kind, { date: row.date, slot: row.slot, onSaved: reload })}
                    className="flex min-h-[56px] min-w-0 flex-1 flex-col justify-center px-4 py-2 text-left"
                  >
                    <span className="text-base font-semibold">{t}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {prettyDate(row.date)}
                      {detail ? `, ${detail}` : ""}
                    </span>
                  </button>
                  {remove ? (
                    <button
                      type="button"
                      onClick={() => del(row)}
                      aria-label={`Delete ${t}, ${prettyDate(row.date)}`}
                      className="flex h-14 w-14 shrink-0 items-center justify-center text-muted-foreground"
                    >
                      <Trash2 className="h-5 w-5" aria-hidden />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
