import { expect, test, type Browser } from "@playwright/test";
import { DEMO_PASSWORD, placeDemoPizzaOrder, shot } from "./helpers";

async function loginAs(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Κωδικός").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Σύνδεση" }).click();
  await page.waitForURL(/\/(dashboard|admin)/);
  return page;
}

test("business receives an order and moves it through every status", async ({ page, browser }, info) => {
  const ref = await placeDemoPizzaOrder(page);
  const customerUrl = page.url();

  const biz = await loginAs(browser, "pizza@demo.clickeat.local");
  const card = biz.getByTestId("order-card").filter({ hasText: ref });
  await expect(card).toBeVisible();
  await expect(card.getByText("Νέα")).toBeVisible();
  await expect(card.getByText("Δοκιμαστικός Πελάτης")).toBeVisible();
  await shot(biz, info, "7-dashboard");

  for (const label of ["✓ Αποδοχή", "Ετοιμάζεται", "Έτοιμη", "Σε διανομή"]) {
    await card.getByRole("button", { name: label }).click();
    await expect(card.getByRole("button", { name: label })).toHaveCount(0);
  }
  // Survives a reload (persisted in the database).
  await biz.reload();
  await expect(biz.getByTestId("order-card").filter({ hasText: ref }).getByText("Σε διανομή").first()).toBeVisible();
  await biz.getByTestId("order-card").filter({ hasText: ref }).getByRole("button", { name: "Ολοκληρώθηκε" }).click();
  await expect(biz.getByTestId("order-card").filter({ hasText: ref })).toHaveCount(0);

  await biz.goto("/dashboard/history");
  await expect(biz.getByText(ref)).toBeVisible();

  await page.goto(customerUrl);
  await expect(page.getByText("Η παραγγελία ολοκληρώθηκε")).toBeVisible();
});

test("a business cannot see another business's orders or open the admin area", async ({ page, browser }) => {
  const ref = await placeDemoPizzaOrder(page);
  const other = await loginAs(browser, "cafe@demo.clickeat.local");
  await expect(other.getByRole("heading", { name: /Νέες παραγγελίες/ })).toBeVisible();
  await expect(other.getByText(ref)).toHaveCount(0);
  await other.goto("/dashboard/history");
  await expect(other.getByText(ref)).toHaveCount(0);
  await other.goto("/admin");
  await expect(other).toHaveURL(/\/dashboard$/);
});

test("unauthenticated users are sent to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("business can mark a product unavailable and customers then cannot order it", async ({ page, browser }) => {
  const biz = await loginAs(browser, "cafe@demo.clickeat.local");
  await biz.goto("/dashboard/menu");
  const row = biz.locator("li").filter({ hasText: "Πορτοκαλόπιτα" });
  await row.getByRole("button", { name: "Διαθέσιμο" }).click();
  await expect(row.getByRole("button", { name: "Μη διαθέσιμο" })).toBeVisible();

  await page.goto("/r/demo-cafe");
  await expect(page.getByRole("button", { name: /Πορτοκαλόπιτα/ })).toBeDisabled();

  await row.getByRole("button", { name: "Μη διαθέσιμο" }).click();
  await expect(row.getByRole("button", { name: "Διαθέσιμο" })).toBeVisible();
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("pizza@demo.clickeat.local");
  await page.getByLabel("Κωδικός").fill("wrong-password");
  await page.getByRole("button", { name: "Σύνδεση" }).click();
  await expect(page.getByText("Λάθος email ή κωδικός.")).toBeVisible();
});
