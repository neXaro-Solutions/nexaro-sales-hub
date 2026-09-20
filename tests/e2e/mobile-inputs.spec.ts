import { test, expect } from "@playwright/test";

async function openOffers(page: import("@playwright/test").Page) {
  const menu = page.getByRole("button", { name: "Menü öffnen", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator("nav").getByRole("button", { name: "Angebote", exact: true }).click();
}

test("numeric offer inputs can be cleared and replaced without restored zeros", async ({ page }) => {
  await page.goto("/?demo=1");
  await openOffers(page);
  await page.getByRole("button", { name: "Angebot erstellen" }).click();
  const dialog = page.locator("dialog");
  const net = dialog.getByLabel("Netto (€)", { exact: true });
  await net.click();
  await expect(net).toHaveValue("");
  await net.fill("12.34");
  await expect(net).toHaveValue("12.34");
  const quantity = dialog.getByLabel("Menge", { exact: true });
  await quantity.click();
  await page.keyboard.type("2");
  await expect(quantity).toHaveValue("2");
  await expect(net).toHaveValue("12.34");
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
});

test("mobile dashboard and offer editor fit the viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile viewport only");
  await page.goto("/?demo=1");
  const fits = () => document.documentElement.scrollWidth <= innerWidth + 1;
  expect(await page.evaluate(fits)).toBe(true);
  await openOffers(page);
  expect(await page.evaluate(fits)).toBe(true);
  await page.getByRole("button", { name: "Angebot erstellen" }).click();
  const dialog = page.locator("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => el.getBoundingClientRect().width <= innerWidth + 1)).toBe(true);
  expect(await page.evaluate(fits)).toBe(true);
  await expect(dialog.getByLabel("Netto (€)", { exact: true })).toBeVisible();
});
