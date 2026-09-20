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
    .getByRole("button", { name: "Analyse & Foto", exact: true })
    .click();
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
    page.getByRole("button", { name: /ANG-\d{4}-00001/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /ANG-\d{4}-00001 PDF ansehen/ }).click();
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
test("neutral dealer contacts keep notes, appointments and private documents together", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await navigate(page, "Händlerverwaltung");
  await expect(
    page.getByRole("button", { name: "Preisliste importieren" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Neuer Standort", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Vertriebsbereich", exact: true }),
  ).toHaveValue("vape");
  await page.getByLabel("Unternehmen *").fill("Kontakt Test GmbH");
  await page.getByLabel("Ort *").fill("Berlin");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page
    .getByRole("button", { name: "Kontakt Test GmbH", exact: true })
    .click();
  await page
    .getByLabel("Gesprächsnotiz", { exact: true })
    .fill("Ansprechpartner ist dienstags erreichbar.");
  await page
    .getByRole("button", { name: "Notiz speichern", exact: true })
    .click();
  await expect(page.getByLabel("Gesprächsnotiz", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.locator("dialog")).toContainText(
    "Ansprechpartner ist dienstags erreichbar.",
  );
  await page
    .getByRole("button", { name: "Wiedervorlage", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Art des Eintrags", exact: true })
    .selectOption("Termin");
  await page
    .getByLabel("Was steht an? *", { exact: true })
    .fill("Kontaktgespräch Dienstag");
  await page
    .getByLabel("Fällig am * (deutsche Ortszeit)", { exact: true })
    .fill("2026-09-22T14:30");
  await page
    .getByLabel("Termin- / Aufgabenhinweise")
    .fill("Vorher kurz anrufen.");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("dialog")).toContainText("14:30");
  await page.getByLabel("Dokument auswählen").setInputFiles({
    name: "Kontaktprotokoll.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Neutraler Kontaktvermerk"),
  });
  await page
    .getByRole("button", { name: "Dokument hochladen", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Kontaktprotokoll.txt herunterladen",
      exact: true,
    }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Kontaktprotokoll.txt herunterladen",
      exact: true,
    })
    .click();
  expect((await download).suggestedFilename()).toBe("Kontaktprotokoll.txt");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Kontaktprotokoll.txt löschen", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Kontaktprotokoll.txt herunterladen",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/dealers-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await navigate(page, "Kunden & Leads");
  await page
    .getByRole("button", { name: "Kontakt Test GmbH", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Kontaktprotokoll.txt herunterladen",
      exact: true,
    }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Kontaktprotokoll.txt löschen", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Kontaktprotokoll.txt herunterladen",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await navigate(page, "Händlerverwaltung");
  await page
    .getByRole("button", { name: "Termine & Wiedervorlagen", exact: true })
    .click();
  await expect(
    page.getByText("Kontaktgespräch Dienstag", { exact: true }),
  ).toBeVisible();
});

test("sales studio keeps customer state separate and saves zero-cost totals", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await navigate(page, "SumUp Vertrieb");
  await page
    .getByLabel("Analyse einer Kundenakte zuordnen")
    .selectOption({ label: "Café Morgenrot" });
  await page.getByLabel("Aktueller Anbieter (optional)").fill("Testanbieter A");
  await page
    .getByRole("button", { name: "Analyse & Foto", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Vertriebsstudio", exact: true })
    .click();
  await expect(page.getByLabel("Aktueller Anbieter (optional)")).toHaveValue(
    "Testanbieter A",
  );
  await page.getByLabel("Ist-Kosten verwenden").selectOption("total");
  await page
    .getByLabel("Ist-Gesamtkosten / Monat (€)", { exact: true })
    .fill("0");
  await expect(
    page.getByLabel("Monatliche Fixkosten (€)", { exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Vertriebsstudio speichern", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("gespeichert");
  await page
    .getByLabel("Analyse einer Kundenakte zuordnen")
    .selectOption({ label: "Studio West" });
  await expect(page.getByLabel("Aktueller Anbieter (optional)")).toHaveValue(
    "",
  );
  await page
    .getByLabel("Analyse einer Kundenakte zuordnen")
    .selectOption({ label: "Café Morgenrot" });
  await expect(page.getByLabel("Aktueller Anbieter (optional)")).toHaveValue(
    "Testanbieter A",
  );
  await expect(page.getByLabel("Ist-Kosten verwenden")).toHaveValue("total");
  await expect(
    page.getByLabel("Ist-Gesamtkosten / Monat (€)", { exact: true }),
  ).toHaveValue("0");
});

test("weather handles failure and retry with mocked responses", async ({
  page,
}) => {
  await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            name: "Berlin",
            country: "Deutschland",
            latitude: 52.52,
            longitude: 13.405,
          },
        ],
      },
    }),
  );
  let calls = 0;
  await page.route("https://api.open-meteo.com/**", (route) => {
    calls++;
    return route.fulfill(
      calls === 1
        ? { status: 503, body: "Unavailable" }
        : {
            json: {
              current: {
                temperature_2m: 21,
                apparent_temperature: 20,
                weather_code: 0,
                wind_speed_10m: 8,
              },
            },
          },
    );
  });
  await page.goto("/?demo=1");
  await page.getByLabel("Wetterstandort").fill("Berlin");
  await page.getByRole("button", { name: "Anzeigen", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Wetterdaten momentan nicht erreichbar",
  );
  await page
    .getByRole("button", { name: "Wetter aktualisieren", exact: true })
    .click();
  await expect(page.getByText("21 °C", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
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
    .getByRole("button", { name: "Analyse & Foto", exact: true })
    .click();
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
