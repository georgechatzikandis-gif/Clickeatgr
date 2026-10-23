import { expect, test } from "@playwright/test";
import path from "node:path";
import { DEMO_PASSWORD } from "./helpers";

test("business uploads a product photo; it is shrunk in the browser, stored and served", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("cafe@demo.clickeat.local");
  await page.getByLabel("Κωδικός").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Σύνδεση" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto("/dashboard/menu");
  await page.getByRole("link", { name: /Πορτοκαλόπιτα/ }).click();
  await page.getByLabel("Εικόνα", { exact: true }).setInputFiles(path.join(__dirname, "fixtures/food.jpg"));
  await expect(page.getByText(/Έτοιμη \(\d+ KB\)/)).toBeVisible();
  await page.getByRole("button", { name: "Αποθήκευση" }).first().click();
  await expect(page.getByText("Αποθηκεύτηκε.")).toBeVisible();

  await page.reload();
  const img = page.locator('img[src^="/img/"]').first();
  await expect(img).toBeVisible();
  const res = await page.request.get((await img.getAttribute("src"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/jpeg");
  expect(res.headers()["cache-control"]).toContain("immutable");

  // Customers see it on the menu.
  await page.goto("/r/demo-cafe");
  await expect(page.locator('img[src^="/img/"]').first()).toBeVisible();

  // Clean up: remove the photo again.
  await page.goto("/dashboard/menu");
  await page.getByRole("link", { name: /Πορτοκαλόπιτα/ }).click();
  await page.getByLabel("Αφαίρεση εικόνας").check();
  await page.getByRole("button", { name: "Αποθήκευση" }).first().click();
  await expect(page.getByText("Αποθηκεύτηκε.")).toBeVisible();
});
