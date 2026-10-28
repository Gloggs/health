"use client";
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Light by default. With no saved choice, the app follows the device, so a
// phone set to dark mode gets the dark palette.
export function ThemeProvider({ children, ...props }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
