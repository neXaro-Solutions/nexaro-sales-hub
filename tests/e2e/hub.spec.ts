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
test("central customer import form and shared contact record", async ({page})=>{
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/?demo=1");
  await page.getByRole("button",{name:"Standort erfassen",exact:true}).click();
  const dialog=page.locator("dialog");
  await expect(dialog.getByRole("heading",{name:"Visitenkarte fotografieren oder importieren"})).toBeVisible();
  await expect(dialog.getByLabel("Visitenkarte aus Dateien / Galerie auswählen")).toHaveAttribute("type","file");
  await expect(dialog.getByLabel("Visitenkarte mit Kamera fotografieren")).toHaveAttribute("capture","environment");
  await dialog.getByLabel("Unternehmen *").fill("Musterhändler GmbH");
  await dialog.getByLabel("Ansprechpartner").fill("Max Muster");
  await dialog.getByLabel("E-Mail").fill("info@muster.invalid");
  await dialog.getByLabel("Website").fill("www.muster.invalid");
  await dialog.getByLabel("Telefon",{exact:true}).fill("030 1234567");
  await dialog.getByLabel("Straße / Hausnummer").fill("Musterstraße 1");
  await dialog.getByLabel("PLZ").fill("15757");
  await dialog.getByLabel("Ort *").fill("Halbe");
  await dialog.getByRole("button",{name:"Speichern",exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await navigate(page,"Kunden & Leads");
  await page.getByRole("button",{name:"Musterhändler GmbH",exact:true}).click();
  await expect(page.locator("dialog")).toContainText("info@muster.invalid");
  await expect(page.locator("dialog")).toContainText("Musterstraße 1");
  await page.getByRole("button",{name:"Schließen",exact:true}).click();
  expect(errors).toEqual([]);
});

test("current SumUp photo flow and centralized customer selection",async ({page})=>{
  await page.goto("/?demo=1");
  await navigate(page,"SumUp");
  await expect(page.getByRole("heading",{name:"SumUp Vertriebsstudio"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Foto aufnehmen / hochladen"})).toBeVisible();
  await page.getByLabel("Kundenakte für das Vertriebsstudio").selectOption({label:"Café Morgenrot"});
  await page.getByRole("button",{name:"Ist-Bestand"}).click();
  await expect(page.getByText("03 · Kartenmix & Gebühren")).toBeVisible();
  await expect(page.getByLabel("Aktueller Anbieter",{exact:true})).toBeVisible();
  await page.getByLabel("Aktueller Anbieter",{exact:true}).fill("Testanbieter");
  await page.getByRole("button",{name:"Bestand speichern"}).click();
  await expect(page.getByRole("status").filter({hasText:"zentralen Kundenakte"})).toBeVisible();
});

test("manual offer converts into branded invoice with independent number",async ({page})=>{
  await page.goto("/?demo=1");
  await navigate(page,"Angebote & Rechnungen");
  await page.getByRole("button",{name:"Angebot erstellen"}).click();
  await page.getByLabel("Kunde (für Entwurf optional)").selectOption({label:"Café Morgenrot"});
  await page.getByLabel("Bezeichnung *").fill("Zahlungsterminal");
  await page.getByRole("button",{name:"Angebot speichern"}).click();
  await expect(page.locator(".print-sheet")).toContainText("ANG-");
  await expect(page.locator(".print-sheet")).toContainText("Zahlungsterminal");
  await page.getByRole("button",{name:"Schließen",exact:true}).click();
  await page.getByRole("button",{name:/ANG-\d{4}-00001 in Rechnung umwandeln/}).click();
  await page.getByRole("button",{name:"Rechnung mit Nummer anlegen"}).click();
  await expect(page.locator(".print-sheet")).toContainText("RECHNUNG");
  await expect(page.locator(".print-sheet")).toContainText("DE367084019");
  await expect(page.locator(".print-sheet")).toContainText("DE02100110012046791637");
  await expect(page.locator(".print-sheet")).toContainText("Zahlungsterminal");
});

test("route can include existing shared customers",async ({page})=>{
  await page.goto("/?demo=1");
  await navigate(page,"Tagesroute");
  await page.getByRole("button",{name:"Café Morgenrot einplanen"}).click();
  await page.getByRole("button",{name:"Späti am Park einplanen"}).click();
  await page.getByRole("button",{name:"Tagesroute speichern",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("gespeichert");
  await expect(page.getByRole("link",{name:"In Google Maps navigieren"})).toHaveAttribute("href",/waypoints=/);
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



test("dashboard calendar navigates months, selects days and opens CRM tasks", async ({ page }) => {
  await page.goto("/?demo=1");
  const calendar = page.locator(".nx-calendar-card");
  await expect(calendar.getByRole("heading", { name: "Dein Außendienst-Kalender" })).toBeVisible();
  expect([28, 35, 42]).toContain(await calendar.getByRole("group", { name: /Kalender/ }).getByRole("button").count());
  await calendar.getByRole("button", { name: "Nächster Monat" }).click();
  await expect(calendar.getByRole("button", { name: / · 0 Einträge/ }).first()).toBeVisible();
  await calendar.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(calendar.getByText("Kartenzahlungsanalyse besprechen")).toBeVisible();
  await calendar.getByRole("button", { name: /Alle Termine & Wiedervorlagen/ }).click();
  await expect(page.getByRole("heading", { name: "Termine & Wiedervorlagen" })).toBeVisible();
});
