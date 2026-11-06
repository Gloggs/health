import { DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

// DM Sans, the Guild UK typeface, for text and headings (Skeleton v2). next/font serves it from this site.
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });

export const metadata = {
  metadataBase: new URL("https://health.guilduk.com"),
  title: { default: "Health", template: "%s | Health" },
  description:
    "A health log for families. Log sleep, water, weight, workouts and meals in a tap or two, see whether the week is on track, and share only what you choose.",
  applicationName: "Health",
  // Added to a phone's home screen, Health opens full screen with the navy
  // top bar running up behind the status bar (AppShell pads for the notch).
  appleWebApp: { capable: true, title: "Health", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

// Explicit viewport so iOS Safari uses device width + extends content under
// the safe-area inset (notch / home indicator). Maximum-scale and
// user-scalable are intentionally left at defaults so pinch-zoom still works
// for accessibility - the auto-zoom-on-input-focus problem is fixed in CSS
// (globals.css forces 16px on form inputs at mobile widths).
//
// themeColor matches the page background in each mode, so the phone's
// browser bar blends into the app.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0E1E27" },
    { media: "(prefers-color-scheme: light)", color: "#F1F1EF" },
  ],
};

// suppressHydrationWarning is needed because next-themes sets a class on
// <html> in the browser. Light by default; dark follows the device.
export default function RootLayout({ children }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <Toaster position="bottom-center" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
