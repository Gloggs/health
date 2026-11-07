"use client";
// More (health v2): the extras, one tap away. Each row says what it is for in plain words.
import Link from "next/link";
import { Dumbbell, ChartLine, Users, Settings } from "lucide-react";
import { FAMILY_SHARING } from "@/lib/features";

const ROWS = [
  { href: "/dashboard/train", icon: Dumbbell, title: "Train", text: "Workout plans, today's session and your best lifts." },
  { href: "/dashboard/trends", icon: ChartLine, title: "Trends", text: "Your week against last week, and charts for each thing you log." },
  ...(FAMILY_SHARING ? [{ href: "/dashboard/family", icon: Users, title: "Family", text: "Who has logged today, the family chat, and what each person chose to share." }] : []),
  { href: "/dashboard/settings", icon: Settings, title: "Settings and help", text: FAMILY_SHARING ? "How to use health, your profile, what your family sees, and your data." : "How to use health, your profile, and your data." },
];

export default function MorePage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">More</h1>
      <ul className="space-y-2">
        {ROWS.map(({ href, icon: Icon, title, text }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-4 bg-card p-4">
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span>
                <span className="block text-lg font-medium">{title}</span>
                <span className="block text-sm text-muted-foreground">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
