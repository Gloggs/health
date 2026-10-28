"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Clock } from "lucide-react";
import HelpButton from "./HelpButton";
import NotificationsBell from "./NotificationsBell";

function formatNow(date) {
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TopBar() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!mounted) {
    return <div className="sticky top-0 z-20 h-14 border-b bg-background/80 backdrop-blur" />;
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {/* Page titles live in the page itself - TopBar just carries chrome. */}
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {formatNow(now)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <NotificationsBell />
        <HelpButton />
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  );
}
