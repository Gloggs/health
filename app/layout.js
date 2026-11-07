import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

// DM Sans, the Guild UK typeface, for text and headings (Skeleton v2), served from this site. The file comes
// from @fontsource-variable/dm-sans (SIL Open Font Licence), so builds never depend on downloading it from
// Google, which failed builds in CI twice on 6 and 7 November 2026.
const dmSans = localFont({
  src: "../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
  weight: "100 1000",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  // The site's own address, from APP_URL, so a copy of health run by someone else uses its own.
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "health", template: "%s | health" },
  description:
    "Get ready for your GP appointment. Write down what is going on, in your own words, and show your GP one clear page. Free, and only you can see it.",
  applicationName: "health",
  // Added to a phone's home screen, Health opens full screen with the navy
  // top bar running up behind the status bar (AppShell pads for the notch).
  appleWebApp: { capable: true, title: "health", statusBarStyle: "black-translucent" },
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
