import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The navy band at the top of Today: the date, the streak, this week, and
 * how many of the family have logged. Plain numbers, no animation.
 *
 * week: [{ label: "Mon", done, isToday, future }]
 */
export default function TodayHeader({ streak, week, familyLogged, familyTotal }) {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <section aria-label="Today" className="flex flex-col gap-4 bg-ink p-4 text-chalk md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-sm text-chalk/80 md:text-base">{date}</h1>
          <p className="flex items-baseline gap-2.5">
            <span className="font-display text-[64px] font-extrabold leading-[0.85] text-flame md:text-[76px]">{streak}</span>
            <span className="font-display text-xl font-bold uppercase">day streak</span>
          </p>
          {streak === 0 ? <p className="text-sm text-chalk/80">Log anything today to start one.</p> : null}
        </div>
        {familyTotal > 1 ? (
          <Link href="/dashboard/family" className="text-sm text-chalk/80 underline-offset-4 hover:underline">
            Family: {familyLogged} of {familyTotal} logged today
          </Link>
        ) : null}
      </div>

      <ol aria-label="This week" className="grid grid-cols-7 gap-1.5">
        {week.map((d) => (
          <li
            key={d.label}
            className={cn(
              "flex h-9 items-center justify-center text-[13px]",
              d.done ? "bg-brand-sky font-bold text-ink" : d.isToday ? "border-2 border-flame font-bold" : "border border-white/25 text-chalk/60"
            )}
          >
            <span aria-hidden>{d.label[0]}</span>
            <span className="sr-only">
              {d.label}: {d.done ? "logged" : d.isToday ? "today, not logged yet" : d.future ? "still to come" : "nothing logged"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
