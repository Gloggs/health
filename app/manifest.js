// Generates /manifest.webmanifest. With app/icon.svg and the PNGs from
// scripts/make-icons.mjs, this lets Health be added to a phone's home screen
// and open full screen like an app.

export default function manifest() {
  return {
    name: "Health",
    short_name: "Health",
    description:
      "A health log for families. Log sleep, water, weight, workouts and meals in a tap or two.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F1F1EF",
    theme_color: "#142B38",
    orientation: "portrait",
    categories: ["health", "fitness", "lifestyle"],
    lang: "en-GB",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
