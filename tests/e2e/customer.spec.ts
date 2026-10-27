import { expect, test } from "@playwright/test";
import { placeDemoPizzaOrder, shot } from "./helpers";

test("customer can browse, customise a product and place a cash order", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ρόδο");
  await shot(page, info, "1-home");

  const ref = await placeDemoPizzaOrder(page, info);
  expect(ref).toMatch(/^CE-[A-Z0-9]{6}$/);
  // 9.00 + 3.00 (large) + 1.20 (bacon) = 13.20, + 1.00 delivery
  await expect(page.getByText("14,20 €")).toBeVisible();
  await expect(page.getByText("Μετρητά κατά την παράδοση")).toBeVisible();
  await shot(page, info, "6-confirmation");

  // Business phone numbers are never shown to customers (demo shops use +302241000000).
  expect(await page.content()).not.toContain("2241000000");
  const orderUrl = page.url();
  await page.goto("/r/demo-pizza");
  expect(await page.content()).not.toContain("2241000000");
  await page.goto(orderUrl);

  // The confirmation survives a reload, and the cart has been emptied.
  await page.reload();
  await expect(page.getByTestId("order-reference")).toHaveText(ref);
  await page.goto("/r/demo-pizza/checkout");
  await expect(page.getByText("Το καλάθι σας είναι άδειο")).toBeVisible();
  expect(errors).toEqual([]);
});

test("order page requires the secret token", async ({ page }) => {
  await placeDemoPizzaOrder(page);
  const url = new URL(page.url());
  const res = await page.goto(url.pathname); // no ?t=
  expect(res?.status()).toBe(404);
  const res2 = await page.goto(`${url.pathname}?t=wrong-token`);
  expect(res2?.status()).toBe(404);
});

test("cart is limited to one business", async ({ page }) => {
  await page.goto("/r/demo-cafe");
  await page.getByRole("button", { name: /Πορτοκαλόπιτα/ }).first().click();
  await page.getByRole("button", { name: /Προσθήκη/ }).click();
  await page.goto("/r/demo-pizza");
  await page.getByRole("button", { name: /Χωριάτικη/ }).first().click();
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: /Προσθήκη/ }).click();
  // Dismissed: the cart still belongs to the café.
  await page.goto("/r/demo-cafe/checkout");
  await expect(page.getByText("Πορτοκαλόπιτα")).toBeVisible();
});
