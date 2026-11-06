// What a stranger does: read the front page, try the demo, write down how they feel, and get it ready for the GP.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openDemo(page) {
  await page.goto("/demo");
  const guide = page.getByRole("dialog");
  await expect(guide).toBeVisible();
  return guide;
}

test("the front page says what health does, and leads to the demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Get ready for your GP appointment.");
  await expect(page.getByText("A sample page, made up for this example.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What health is not" })).toBeVisible();
  await page.getByRole("link", { name: "Try the demo" }).first().click();
  await expect(page).toHaveURL(/\/demo/);
});

test("the guide shows once, and again only when asked from Settings", async ({ page }) => {
  const guide = await openDemo(page);
  for (let i = 0; i < 3; i++) await guide.getByRole("button", { name: "Next" }).click();
  await guide.getByRole("button", { name: "Start using health" }).click();
  await expect(guide).toBeHidden();
  await page.reload();
  await expect(page.getByText("Anything going on today?")).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/demo/settings");
  await page.getByRole("button", { name: "Show the guide again" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("write down how you feel, then it is on the page for the GP, as a PDF and in FHIR", async ({ page }) => {
  const guide = await openDemo(page);
  await guide.getByRole("button", { name: "Skip the guide" }).click();
  // Move with the app's own links: the demo keeps its sample data in the page, so a reload starts it afresh.
  await page.getByRole("link", { name: "Add how you feel" }).click();
  await page.getByLabel("What is going on?").fill("Pain in my left knee");
  await page.getByRole("button", { name: "Moderate" }).click();
  await page.getByLabel("What makes it worse?").fill("Stairs");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved. Only you can see this.")).toBeVisible();

  await page.getByRole("link", { name: "See it for my GP" }).click();
  const sheet = page.getByRole("article", { name: "GP summary" });
  await expect(sheet.getByText(/Pain in my left knee\. Since/)).toBeVisible();
  await expect(sheet.getByText("Stairs")).toBeVisible();
  await expect(sheet).toContainText("Your GP decides what this means.");

  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF" }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^For my GP .*\.pdf$/);
  const [fhir] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download your entries in FHIR" }).click()]);
  const bundle = JSON.parse(await (await import("node:fs/promises")).readFile(await fhir.path(), "utf8"));
  expect(bundle.resourceType).toBe("Bundle");
  expect(JSON.stringify(bundle)).toContain("Pain in my left knee");
});

const SCREENS = [["Front page", "/"], ["Today", "/demo"], ["How I feel", "/demo/feel"], ["For my GP", "/demo/summary"], ["More", "/demo/more"], ["Settings", "/demo/settings"]];

for (const scheme of ["light", "dark"]) {
  test(`main screens pass automatic accessibility checks and never scroll sideways (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const guide = await openDemo(page);
    await guide.getByRole("button", { name: "Skip the guide" }).click();
    const failures = [];
    for (const [name, url] of SCREENS) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      for (const v of violations.filter((x) => ["serious", "critical"].includes(x.impact))) {
        failures.push(`${name}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
      }
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) failures.push(`${name}: scrolls sideways`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
}
