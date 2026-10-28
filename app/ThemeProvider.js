"use client";
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { applyTypography, getStoredTypography } from "@/lib/typography";

export function ThemeProvider({ children, ...props }) {
  // Apply the user's saved typography preset on first paint so they
  // don't see a flash of Classic before their chosen Journal/Modern
  // takes over. SSR-safe — applyTypography no-ops outside the browser.
  React.useEffect(() => {
    applyTypography(getStoredTypography());
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey="theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
