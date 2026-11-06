"use client";
// The first thing on Today (health v2): the job is getting ready for the GP, so Today opens on it.
import { useEffect, useState } from "react";
import Link from "next/link";
import GlobalApi from "@/app/_services/GlobalApi";
import { daysAgoStr, todayDateStr } from "@/lib/dates";

export default function FeelPanel() {
  const [count, setCount] = useState(null);
  useEffect(() => {
    GlobalApi.GetFeelings({ from: daysAgoStr(14), to: todayDateStr() })
      .then((r) => setCount(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => setCount(0));
  }, []);
  return (
    <section aria-labelledby="feel-title" className="space-y-3 bg-card p-5 md:p-6">
      <h2 id="feel-title" className="font-display font-medium tracking-tight text-2xl sm:text-3xl">Anything going on today?</h2>
      <p className="text-base text-muted-foreground">
        {count ? `You have written down ${count} ${count === 1 ? "thing" : "things"} in the last two weeks, ready to show your GP.`
          : "Write down how you feel, in your own words, ready to show your GP."}
      </p>
      <Link href="/dashboard/feel" className="inline-flex h-12 w-full items-center justify-center bg-primary px-6 text-base font-medium text-primary-foreground sm:w-auto">
        Add how you feel
      </Link>
    </section>
  );
}
