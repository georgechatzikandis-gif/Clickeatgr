import type { Page, TestInfo } from "@playwright/test";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

export const DEMO_PASSWORD = "demo-password-123";

/** Saves a screenshot to SCREENSHOT_DIR when set (used for visual review). */
export async function shot(page: Page, info: TestInfo, name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${info.project.name}-${name}.png`, fullPage: true });
}

/** Runs one SQL statement against the local demo database (test setup only). */
export async function sqlExec(query: string) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await sql.unsafe(query);
  await sql.end();
}

/** The tests place many orders from one IP; reset the per-IP order limit so they aren't blocked. */
export async function resetRateLimits() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await sql`delete from rate_limits`;
  await sql.end();
}

export async function placeDemoPizzaOrder(page: Page, info?: TestInfo) {
  await resetRateLimits();
  await page.goto("/");
  await page.getByPlaceholder("Αναζήτηση").fill("μαργαρ");
  await page.getByRole("link", { name: /Πιτσαρία/ }).click();
  await page.waitForURL("**/r/demo-pizza");
  if (info) await shot(page, info, "2-menu");
  await page.getByRole("button", { name: /Μαργαρίτα/ }).first().click();
  await page.getByLabel("Μεγάλη").check();
  await page.getByLabel("Μπέικον").check();
  if (info) await shot(page, info, "3-product");
  await page.getByRole("button", { name: /Προσθήκη/ }).click();
  await page.getByRole("link", { name: /Καλάθι|Συνέχεια/ }).first().click();
  await page.waitForURL("**/checkout");
  await page.getByLabel("Ονοματεπώνυμο").fill("Δοκιμαστικός Πελάτης");
  await page.getByLabel("Κινητό τηλέφωνο").fill("6900000000");
  await page.getByLabel("Οδός και αριθμός").fill("Οδός Δοκιμής 1");
  await page.getByLabel(/Αποδέχομαι/).check();
  if (info) await shot(page, info, "4-checkout");
  await page.getByRole("button", { name: "Έλεγχος παραγγελίας" }).click();
  if (info) await shot(page, info, "5-review");
  await page.getByRole("button", { name: /Επιβεβαίωση/ }).click();
  await page.waitForURL("**/order/**");
  return (await page.getByTestId("order-reference").textContent())!.trim();
}
