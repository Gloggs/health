import { Inter, Source_Serif_4, JetBrains_Mono, Caveat } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

// Inter — primary body / UI sans-serif. Carried over from the original
// shadcn setup; works well alongside Source Serif headlines.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Source Serif 4 — display / headline family per BRAND.md §3.
// Refined slab/serif with presence; pairs with Inter body without fighting it.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// JetBrains Mono — data / numbers family per BRAND.md §3.
// Streak counts, weights, dates, leaderboard numbers - anything that feels
// like a *record* gets this. Gives stats a tactile, "this is etched" feel.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

// Caveat — handwritten accent per BRAND.md §3. Reserved for moments that
// should feel like a margin note in a journal: today's date, the streak
// caption, the "etched today" subtitle. Used SPARINGLY — overusing
// handwriting cheapens it. One or two glyphs per surface.
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-handwritten",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "Etch · the family health app that makes you show up",
  description:
    "Log every workout, meal, and night's sleep by hand. Hold each other accountable. Real progress, not metrics. Track less. Notice more.",
};

// Explicit viewport so iOS Safari uses device width + extends content under
// the safe-area inset (notch / home indicator). Maximum-scale and
// user-scalable are intentionally left at defaults so pinch-zoom still works
// for accessibility - the auto-zoom-on-input-focus problem is fixed in CSS
// (globals.css forces 16px on form inputs at mobile widths).
//
// themeColor matches BRAND.md §4 palette: paper #F8F5EF in light mode,
// paper-dark #15110D in dark mode. Mobile browser chrome colour-shifts to
// match the app surface, removing the visible seam.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "hsl(24 22% 6%)" },
    { media: "(prefers-color-scheme: light)", color: "hsl(40 39% 95%)" },
  ],
};

// suppressHydrationWarning is required because next-themes attaches a `class`
// to <html> client-side. Without the suppression, React logs a hydration
// mismatch warning on every navigation. Default theme is "light" (per
// BRAND.md and ThemeProvider) - family use is mostly daylight; dark mode
// stays available as a user choice.
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} ${caveat.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <Toaster richColors position="top-right" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
