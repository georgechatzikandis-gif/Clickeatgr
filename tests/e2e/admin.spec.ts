import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, placeDemoPizzaOrder, shot } from "./helpers";

test("admin sees all orders, onboards a business and its user, and exports a report", async ({ page, browser }, info) => {
  const ref = await placeDemoPizzaOrder(page);

  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await admin.goto("/login");
  await admin.getByLabel("Email").fill("admin@demo.clickeat.local");
  await admin.getByLabel("Κωδικός").fill(DEMO_PASSWORD);
  await admin.getByRole("button", { name: "Σύνδεση" }).click();
  await admin.waitForURL("**/admin");
  await expect(admin.getByText("Παραγγελίες σήμερα")).toBeVisible();
  await expect(admin.getByText("Δωρεάν περίοδος: προμήθεια 0%")).toBeVisible();
  await shot(admin, info, "8-admin");

  await admin.goto("/admin/orders");
  await expect(admin.getByText(ref).first()).toBeVisible();

  // Onboard a new business.
  const name = `E2E Κατάστημα ${Date.now()}`;
  await admin.goto("/admin/businesses");
  await admin.getByLabel("Όνομα *").fill(name);
  await admin.getByRole("button", { name: "Δημιουργία" }).click();
  await admin.waitForURL(/\/admin\/businesses\/[0-9a-f-]+\?created=1/);
  await expect(admin.getByRole("heading", { name })).toBeVisible();

  const email = `e2e-${Date.now()}@example.com`;
  await admin.getByPlaceholder("Email").fill(email);
  await admin.getByPlaceholder(/Αρχικός κωδικός/).fill("e2e-password-123");
  await admin.getByRole("button", { name: "Δημιουργία λογαριασμού" }).click();
  await expect(admin.getByText(`Ο λογαριασμός ${email} δημιουργήθηκε`)).toBeVisible();
  await shot(admin, info, "9-admin-business");

  // The new business user can log in to their own (empty) dashboard.
  const bctx = await browser.newContext();
  const biz = await bctx.newPage();
  await biz.goto("/login");
  await biz.getByLabel("Email").fill(email);
  await biz.getByLabel("Κωδικός").fill("e2e-password-123");
  await biz.getByRole("button", { name: "Σύνδεση" }).click();
  await biz.waitForURL("**/dashboard");
  await expect(biz.getByText(name)).toBeVisible();
  await expect(biz.getByText(ref)).toHaveCount(0);

  // Inactive business is not public.
  await admin.goto("/");
  await expect(admin.getByText(name)).toHaveCount(0);

  // CSV report.
  const res = await admin.request.get("/admin/reports/export");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("Προμήθεια οφειλόμενη");
  const anon = await page.request.get("/admin/reports/export");
  expect(anon.status()).toBe(403);

  // Clean up: a business without orders can be deleted.
  await admin.goBack();
  await admin.goto("/admin/businesses");
  await admin.getByRole("link", { name: new RegExp(name) }).click();
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Διαγραφή καταστήματος" }).click();
  await admin.waitForURL("**/admin/businesses");
  await expect(admin.getByText(name)).toHaveCount(0);
});
