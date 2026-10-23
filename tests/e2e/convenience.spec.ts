import { expect, test } from "@playwright/test";
import { placeDemoPizzaOrder, resetRateLimits, sqlExec } from "./helpers";

test("returning customer: details are remembered and 'order again' places a new order", async ({ page }) => {
  const first = await placeDemoPizzaOrder(page);
  await page.goto("/");
  const recent = page.getByRole("region", { name: "Οι παραγγελίες σας" });
  await expect(recent.getByText(first)).toBeVisible();
  await recent.getByRole("button", { name: "Ξανά" }).first().click();
  await page.waitForURL("**/r/demo-pizza/checkout");
  await expect(page.getByLabel("Ονοματεπώνυμο")).toHaveValue("Δοκιμαστικός Πελάτης");
  await expect(page.getByLabel("Οδός και αριθμός")).toHaveValue("Οδός Δοκιμής 1");
  await page.getByLabel(/Αποδέχομαι/).check();
  await page.getByRole("button", { name: "Έλεγχος παραγγελίας" }).click();
  await resetRateLimits();
  await page.getByRole("button", { name: /Επιβεβαίωση/ }).click();
  await page.waitForURL("**/order/**");
  const second = (await page.getByTestId("order-reference").textContent())!.trim();
  expect(second).not.toBe(first);
});

test("checkout shows current prices if the business changed them after items were added", async ({ page }) => {
  try {
    await page.goto("/r/demo-souvlaki");
    await page.getByRole("button", { name: /Αναψυκτικό/ }).first().click();
    await page.getByRole("button", { name: /Προσθήκη/ }).click();
    await sqlExec("update products set price_cents = 250 where name = 'Αναψυκτικό 330ml'");
    await page.goto("/r/demo-souvlaki/checkout");
    await expect(page.getByText("Ορισμένες τιμές άλλαξαν")).toBeVisible();
    await expect(page.getByText("2,50 €").first()).toBeVisible();

    await sqlExec("update products set is_available = false where name = 'Αναψυκτικό 330ml'");
    await page.reload();
    await expect(page.getByText("Δεν είναι πλέον διαθέσιμο", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Έλεγχος παραγγελίας" })).toBeDisabled();
  } finally {
    await sqlExec("update products set price_cents = 180, is_available = true where name = 'Αναψυκτικό 330ml'");
  }
});

test("menu search and home sorting", async ({ page }) => {
  await page.goto("/r/demo-pizza");
  await page.getByLabel("Αναζήτηση στον κατάλογο").fill("χωριατ");
  await expect(page.getByRole("button", { name: /Χωριάτικη/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Σπέσιαλ/ })).toHaveCount(0);

  await page.goto("/");
  await page.getByLabel("Ταξινόμηση").selectOption("fee");
  await expect(page.getByText("3 καταστήματα")).toBeVisible();
});
