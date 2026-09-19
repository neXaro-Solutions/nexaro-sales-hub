import { test, expect } from "@playwright/test";
test("public inquiry preserves input on failure and retries the same request", async ({
  page,
}) => {
  const payloads: any[] = [];
  await page.route("**/functions/v1/nx-public-intake", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          id: "test-request",
          issued: Date.now(),
          signature: "test-signature",
        },
      });
      return;
    }
    payloads.push(route.request().postDataJSON());
    await route.fulfill({
      status: payloads.length === 1 ? 503 : 200,
      json: { ok: payloads.length > 1 },
    });
  });
  await page.goto("/public-lead.html");
  await page.getByLabel("Unternehmen *").fill("Testgeschäft");
  await page.getByLabel("Ansprechpartner *").fill("Testperson");
  await page.getByLabel("E-Mail *").fill("test@example.invalid");
  await page.getByLabel("Ort *", { exact: true }).fill("Halbe");
  await page.getByLabel("Wofür interessieren Sie sich? *").selectOption("both");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Eingaben bleiben erhalten",
  );
  await expect(page.getByLabel("Unternehmen *")).toHaveValue("Testgeschäft");
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Ihre Anfrage ist eingegangen",
  );
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toEqual(payloads[1]);
  expect(payloads[1].payload).toMatchObject({
    company: "Testgeschäft",
    interest: "both",
    consent: true,
  });
  await expect(page.getByLabel("Unternehmen *")).toHaveValue("");
});
async function navigate(page: any, label: string) {
  const menu = page.getByRole("button", { name: "Menü öffnen", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page
    .locator("nav")
    .getByRole("button", { name: label, exact: true })
    .click();
}
test("demo isolates data, creates linked customers, routes and offers", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let remoteWrites = 0;
  page.on("request", (r) => {
    if (
      r.url().includes("supabase.co") &&
      ["POST", "PATCH", "DELETE"].includes(r.method())
    )
      remoteWrites++;
  });
  await page.goto("/?demo=1");
  await expect(
    page.getByRole("heading", {
      name: "Starke Standorte. Klare nächste Schritte.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Standort erfassen", exact: true })
    .click();
  await page.getByLabel("Unternehmen *").fill("Teststandort");
  await page.getByLabel("Ort *").fill("Halbe");
  await page
    .getByRole("combobox", { name: "Vertriebsbereich", exact: true })
    .selectOption("both");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await navigate(page, "Kunden & Leads");
  await page.getByRole("button", { name: "Teststandort", exact: true }).click();
  await expect(
    page.locator("dialog").getByText("SumUp", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("dialog").getByText("Vapes", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await navigate(page, "SumUp Vertrieb");
  await page
    .getByLabel("Analyse einer Kundenakte zuordnen")
    .selectOption({ label: "Teststandort" });
  await page
    .getByRole("button", { name: "Analyse speichern", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("gespeichert");
  await page
    .getByRole("button", { name: "Angebot vorbereiten", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Angebot speichern", exact: true })
    .click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await navigate(page, "Angebote");
  await expect(
    page.getByRole("button", { name: "DEMO-1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "DEMO-1 Druckansicht" }).click();
  await expect(page.locator(".print-sheet")).toContainText("Teststandort");
  await expect(page.locator(".print-sheet")).not.toContainText("EK netto");
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await navigate(page, "Gebiet & Tagesroute");
  await page.getByRole("button", { name: "Café Morgenrot einplanen" }).click();
  await page.getByRole("button", { name: "Späti am Park einplanen" }).click();
  await page
    .getByRole("button", { name: "Tagesroute speichern", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("gespeichert");
  await expect(
    page.getByRole("link", { name: "In Google Maps navigieren" }),
  ).toHaveAttribute("href", /waypoints=/);
  expect(remoteWrites).toBe(0);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("authenticated data is unavailable on public landing", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Bereit für deinen nächsten Abschluss?",
    }),
  ).toBeVisible();
  await expect(page.locator("nav")).toHaveCount(0);
  await expect(page.getByLabel("Passwort", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
});
test("catalog import supports supplier mapping and margin calculation", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await navigate(page, "Vapes & Trends");
  await page
    .getByRole("button", { name: "Preisliste importieren", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "prices.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "sku;name;ek_net;vk_net;ean;stock;pack_size\nP-01;Test Pod;4,00;8,00;00123;100;10",
    ),
  });
  await expect(
    page.getByRole("heading", { name: "Vorschau · 1 Produkte" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "1 Produkte übernehmen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Test Pod", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Test Pod vergleichen", { exact: true }).check();
  await page
    .getByRole("button", { name: "Produktvergleich (1)", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Produkte & Lieferanten vergleichen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kalkulation übernehmen" }).click();
  await expect(
    page.getByRole("heading", { name: "Marge & Abnahmepotenzial" }),
  ).toBeVisible();
});

test("real local photo OCR feeds reviewed totals and hardware advice", async ({
  page,
}) => {
  test.setTimeout(120000);
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:4173") &&
      !r.url().startsWith("blob:")
    )
      external.push(r.url());
  });
  await page.goto("/?demo=1");
  await navigate(page, "SumUp Vertrieb");
  await page
    .getByRole("button", { name: "Abrechnung fotografieren / hochladen" })
    .click();
  await page
    .getByLabel("Abrechnungsfoto (JPG / PNG / WebP)")
    .setInputFiles("tests/fixtures/statement-test.png");
  await expect(
    page.getByRole("heading", { name: "Belegwerte prüfen", exact: true }),
  ).toBeVisible({ timeout: 100000 });
  await expect(
    page.getByLabel("Kartenumsatz vor Ort (€)", { exact: true }),
  ).toHaveValue("5000");
  await expect(
    page.getByLabel("Vergleichbare Gesamtkosten netto (€)", { exact: true }),
  ).toHaveValue("95");
  await expect(
    page.getByRole("button", { name: "Geprüfte Werte übernehmen" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "Ich habe Beträge, Nettobasis, Zeitraum und Umsatzaufteilung mit dem Beleg abgeglichen.",
    })
    .check();
  await page.getByRole("button", { name: "Geprüfte Werte übernehmen" }).click();
  await expect(
    page.getByLabel("Geprüfte Ist-Gesamtkosten / Monat (€)"),
  ).toHaveValue("95");
  await expect(
    page.getByLabel("Plus-Kartenanteil", { exact: true }),
  ).toHaveValue("0");
  await page
    .getByRole("checkbox", { name: "Gedruckte Belege erforderlich" })
    .check();
  await page
    .getByRole("button", { name: "Hardwarevorschlag übernehmen" })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Lösung", exact: true }),
  ).toHaveValue("3");
  await expect(
    page.getByLabel("Einmalige Hardwarekosten netto (€)"),
  ).toHaveValue("139");
  await page
    .getByLabel("Analyse einer Kundenakte zuordnen")
    .selectOption({ label: "Café Morgenrot" });
  await expect(
    page.getByLabel("Geprüfte Ist-Gesamtkosten / Monat (€)"),
  ).toHaveCount(0);
  await page
    .getByLabel("Kartenumsatz vor Ort / Monat (€)", { exact: true })
    .fill("1234");
  await page
    .getByRole("button", { name: "Analyse speichern", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("gespeichert");
  await page.getByLabel("Analyse einer Kundenakte zuordnen").selectOption("");
  await expect(
    page.getByLabel("Kartenumsatz vor Ort / Monat (€)", { exact: true }),
  ).toHaveValue("5000");
  await page
    .getByLabel("Analyse einer Kundenakte zuordnen")
    .selectOption({ label: "Café Morgenrot" });
  await expect(
    page.getByLabel("Kartenumsatz vor Ort / Monat (€)", { exact: true }),
  ).toHaveValue("1234");
  expect(external).toEqual([]);
  await page.screenshot({
    path: `test-results/advisor-${test.info().project.name}.png`,
    fullPage: true,
  });
});
