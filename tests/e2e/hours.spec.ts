import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD } from "./helpers";

test("copy Monday's hours to every day", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("souvlaki@demo.clickeat.local");
  await page.getByLabel("Κωδικός").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Σύνδεση" }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/dashboard/settings");

  const setMonday = async (open: string, close: string) => {
    await page.getByLabel("Δευτέρα άνοιγμα 1").fill(open);
    await page.getByLabel("Δευτέρα κλείσιμο 1").fill(close);
    await page.getByRole("button", { name: /Ίδιο ωράριο/ }).click();
    await page.getByRole("button", { name: "Αποθήκευση ωραρίου" }).click();
    await expect(page.getByText("Το ωράριο αποθηκεύτηκε.")).toBeVisible();
  };
  try {
    await setMonday("10:00", "22:00");
    await page.reload();
    await expect(page.getByLabel("Κυριακή άνοιγμα 1")).toHaveValue("10:00");
    await expect(page.getByLabel("Σάββατο κλείσιμο 1")).toHaveValue("22:00");
  } finally {
    // Restore the demo shop to 24/7 so other tests can order at any time.
    await setMonday("00:00", "00:00");
  }
});
