// Renders the health mark (app/icon.svg) into the PNG icons the installable app needs:
//   app/apple-icon.png   180x180  (Next serves it as apple-touch-icon)
//   public/icon-512.png  512x512  (manifest icon, "any" and "maskable")
// The mark is drawn full-bleed; the octagon and pulse line sit inside the safe zone maskable icons keep.
// Run after changing the mark:  node scripts/make-icons.mjs   (needs: npx playwright install chromium)
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync(new URL("../app/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [size, out] of [[180, "../app/apple-icon.png"], [512, "../public/icon-512.png"]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  writeFileSync(new URL(out, import.meta.url), await page.screenshot());
}
await browser.close();
console.log("icons written");
