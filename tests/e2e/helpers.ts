import type { Page, TestInfo } from "@playwright/test";

export const DEMO_PASSWORD = "demo-password-123";

/** Saves a screenshot to SCREENSHOT_DIR when set (used for visual review). */
export async function shot(page: Page, info: TestInfo, name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${info.project.name}-${name}.png`, fullPage: true });
}

export async function placeDemoPizzaOrder(page: Page, info?: TestInfo) {
  await page.goto("/");
  await page.getByPlaceholder("Αναζήτηση").fill("μαργαρ");
  await page.getByRole("link", { name: /Πιτσαρία/ }).click();
  await page.waitForURL("**/r/demo-pizza");
  if (info) await shot(page, info, "2-menu");
  await page.getByRole("button", { name: /Μαργαρίτα/ }).click();
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
