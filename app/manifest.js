// Next.js 14 manifest API. Generates /manifest.webmanifest at build time
// from this single source. Together with app/icon.svg, this is what makes
// etch.family installable as "Add to Home Screen" on Android Chrome and
// iOS Safari (16.4+).
//
// Colours sourced from BRAND.md §4 (Direction A — Ink & Paper). theme_color
// matches the in-app paper background so the browser chrome blends with
// the app surface seamlessly.
//
// Phase G.1 + G.2 follow-up:
//   - Bubblewrap reads this manifest to build the Google Play TWA wrapper
//   - Capacitor copies the icon for iOS App Icon assets
//   - apple-icon.png (180x180) still needs to be added as a real PNG for
//     iOS home-screen quality; create at app/apple-icon.png when a designer
//     produces the final logo artwork

export default function manifest() {
  return {
    name: "Etch",
    short_name: "Etch",
    description:
      "The family health app that makes you show up. Log every workout, meal, and night's sleep by hand. Track less. Notice more.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F8F5EF", // paper (BRAND.md §4)
    theme_color: "#F8F5EF",
    orientation: "portrait",
    categories: ["health", "fitness", "lifestyle"],
    lang: "en-GB",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      // Rasterised from the same tally-mark geometry by
      // scripts/make-icons.mjs (full-bleed, so Android maskable + TWA
      // splash both crop it cleanly). app/apple-icon.png (180x180) comes
      // from the same script - Next auto-serves it as apple-touch-icon.
      {
        src: "/icon-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
