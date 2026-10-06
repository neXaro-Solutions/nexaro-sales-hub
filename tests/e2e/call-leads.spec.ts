import { test, expect, type Page } from "@playwright/test";

function lead(id: string, status = "neu") {
  return { id, company: `Firma ${id}`, status, created_at: new Date().toISOString(), batch_date: "2026-10-01", phone: "030123456", email: "test@example.com", last_contact_at: status === "neu" ? null : new Date().toISOString(), customer_id: null, callback_at: null };
}
async function openHunter(page: Page) {
  await page.goto("/?demo=1");
  const menu = page.getByRole("button", { name: "Menü öffnen", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator("nav").getByRole("button", { name: "Telefonleads", exact: true }).click();
}

test("processed contacts stay out; successful info send removes card without skipping next lead", async ({ page }) => {
  const rows = [lead("termin", "termin"), lead("info", "kontaktiert"), lead("a"), lead("b"), lead("c")];
  const automations = [{ call_lead_id: "info", status: "completed", phase: "closed" }];
  await page.route("**/rest/v1/nx_daily_call_leads?*", r => r.fulfill({ json: rows }));
  await page.route("**/rest/v1/nx_sales_automations?*", r => r.fulfill({ json: automations }));
  await page.route("**/functions/v1/nx-sales-funnel-web", async r => {
    const id = r.request().postDataJSON().leadId;
    rows.find(row => row.id === id)!.status = "kontaktiert";
    automations.push({ call_lead_id: id, status: "active", phase: "information" });
    await r.fulfill({ json: { ok: true, initialSent: true } });
  });
  await openHunter(page);
  await expect(page.getByRole("button", { name: "3 Arbeitsliste", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Call-Modus starten", exact: true }).click();
  await expect(page.locator(".nx-company-overlay h1")).toHaveText("Firma a");
  await page.getByRole("button", { name: "Infos senden", exact: true }).click();
  await expect(page.locator(".nx-company-overlay h1")).toHaveText("Firma b");
  await page.getByRole("button", { name: "Call-Modus schließen", exact: true }).click();
  await openHunter(page);
  await expect(page.getByRole("button", { name: "2 Arbeitsliste", exact: true })).toBeVisible();
});

test("failed info send keeps contact; saved appointment is excluded after reload", async ({ page }) => {
  const rows = [lead("a")];
  await page.route("**/rest/v1/nx_daily_call_leads?*", async r => {
    if (r.request().method() === "PATCH") { Object.assign(rows[0], r.request().postDataJSON()); await r.fulfill({ json: rows[0] }); }
    else await r.fulfill({ json: rows });
  });
  await page.route("**/rest/v1/nx_sales_automations?*", r => r.fulfill({ json: [] }));
  await page.route("**/functions/v1/nx-sales-funnel-web", r => r.fulfill({ json: { ok: false, error: "Testfehler Versand" } }));
  await openHunter(page);
  await page.getByRole("button", { name: "Call-Modus starten", exact: true }).click();
  await page.getByRole("button", { name: "Infos senden", exact: true }).click();
  await expect(page.locator(".nx-call-mode-toast")).toContainText("Testfehler Versand");
  await expect(page.locator(".nx-company-overlay h1")).toHaveText("Firma a");
  await page.getByRole("button", { name: "Termin", exact: true }).click();
  await page.getByRole("button", { name: "Im Kalender anlegen", exact: true }).click();
  await expect.poll(() => rows[0].status).toBe("termin");
  await openHunter(page);
  await expect(page.getByRole("heading", { name: "Keine offenen Telefonleads", exact: true })).toBeVisible();
});

test("last info contact leaves an empty state with a working close button", async ({ page }) => {
  const rows = [lead("a")];
  const automations: object[] = [];
  await page.route("**/rest/v1/nx_daily_call_leads?*", r => r.fulfill({ json: rows }));
  await page.route("**/rest/v1/nx_sales_automations?*", r => r.fulfill({ json: automations }));
  await page.route("**/functions/v1/nx-sales-funnel-web", r => {
    automations.push({ call_lead_id: "a", status: "active", phase: "information" });
    return r.fulfill({ json: { ok: true, initialSent: true } });
  });
  await openHunter(page);
  await page.getByRole("button", { name: "Call-Modus starten", exact: true }).click();
  await page.getByRole("button", { name: "Infos senden", exact: true }).click();
  await expect(page.locator(".nx-call-mode").getByRole("heading", { name: "Keine offenen Telefonleads" })).toBeVisible();
  await page.getByRole("button", { name: "Call-Modus schließen", exact: true }).click();
  await expect(page.locator(".nx-call-mode")).not.toBeVisible();
});
