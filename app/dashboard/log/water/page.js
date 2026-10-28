"use client";

import useSWR from "swr";
import axios from "axios";
import { Trash2 } from "lucide-react";
import GlobalApi from "@/app/_services/GlobalApi";
import LogHistory from "@/components/log/LogHistory";
import { useLog } from "@/components/log/LogProvider";
import { daysAgoStr, todayDateStr } from "@/lib/dates";

const litres = (ml) => `${(ml / 1000).toFixed(2).replace(/\.?0+$/, "")} L`;
const fetcher = (url) => axios.get(url).then((r) => r.data);

const load = () =>
  GlobalApi.GetWater({ from: daysAgoStr(60), to: todayDateStr() }).then((r) => (r.data ?? []).filter((d) => d.totalMl > 0));

const describe = (r) => ({ title: litres(r.totalMl), detail: null });

// Today's drinks one by one, so a wrong entry can be deleted. History below
// shows daily totals; tapping a day adds more water to that day.
function TodayDrinks() {
  const today = todayDateStr();
  const { data } = useSWR(`/api/water?date=${today}`, fetcher);
  const { announce } = useLog();
  const entries = data?.entries ?? [];
  if (!entries.length) return null;

  const del = async (e) => {
    await GlobalApi.DeleteWater(e.id);
    announce({
      message: `${e.amountMl} ml deleted`,
      undo: () => GlobalApi.AddWater({ date: e.date, amountMl: e.amountMl }),
    });
  };

  return (
    <section aria-labelledby="water-today" className="flex flex-col gap-2">
      <h2 id="water-today" className="font-display text-xl font-bold uppercase">
        Today, {litres(data.totalMl ?? 0)}
      </h2>
      <ul className="border border-border bg-card">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center border-b border-border last:border-b-0">
            <span className="flex min-h-[52px] flex-1 items-center px-4 text-base font-semibold">{e.amountMl} ml</span>
            {e.createdAt ? (
              <span className="text-sm text-muted-foreground">
                {new Date(e.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => del(e)}
              aria-label={`Delete ${e.amountMl} ml`}
              className="flex h-[52px] w-14 items-center justify-center text-muted-foreground"
            >
              <Trash2 className="h-5 w-5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function WaterLogPage() {
  return <LogHistory kind="water" title="Water" logLabel="Log water" load={load} describe={describe} extra={<TodayDrinks />} />;
}
