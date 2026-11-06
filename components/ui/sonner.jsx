"use client";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

// One quiet line at the bottom of the screen: ink bar, chalk text, and an
// Undo action in sky. Square, flat and readable in both themes.
const Toaster = ({ ...props }) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      offset={88}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full min-h-[52px] items-center justify-between gap-3 bg-foreground py-2 pl-4 pr-1 font-sans text-[15px] text-background dark:bg-[#F1F1EF] dark:text-[#142B38]",
          title: "font-medium",
          description: "text-sm opacity-80",
          actionButton:
            "h-11 shrink-0 px-3 font-bold text-[hsl(var(--coral))] dark:text-[hsl(var(--forest))]",
          cancelButton: "h-11 shrink-0 px-3 font-semibold opacity-80",
          error: "bg-destructive text-destructive-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
