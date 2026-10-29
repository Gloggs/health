"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

// The two views inside the Family tab. Links, so each has its own address
// and the back button works.
export default function FamilyTabs({ active }) {
  const tabs = [
    { key: "members", label: "Members", href: "/dashboard/family" },
    { key: "chat", label: "Chat", href: "/dashboard/chat" },
  ];
  return (
    <nav aria-label="Family" className="grid grid-cols-2 border border-foreground">
      {tabs.map((t, i) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "flex h-11 items-center justify-center text-[15px]",
            i > 0 && "border-l border-foreground",
            active === t.key ? "bg-foreground font-bold text-background" : "bg-card font-semibold"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
