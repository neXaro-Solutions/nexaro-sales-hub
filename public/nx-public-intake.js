"use strict";
const endpoint =
  "https://hbuqzdmjqvgybwohfnqy.supabase.co/functions/v1/nx-public-intake";
const form = document.getElementById("leadForm");
const result = document.getElementById("result");
const button = document.getElementById("submitLead");
let challenge = null,
  busy = false,
  receivedAt = 0;
async function loadChallenge() {
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Error("unavailable");
  challenge = await response.json();
  receivedAt = Date.now();
  return challenge;
}
loadChallenge().catch(() => {
  result.textContent = "Die Verbindung wird beim Absenden erneut geprüft.";
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  button.disabled = true;
  button.textContent = "Anfrage wird gesendet …";
  result.textContent = "";
  try {
    if (!challenge || Date.now() - receivedAt > 3500000) await loadChallenge();
    const wait = Math.max(0, 2200 - (Date.now() - receivedAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    const values = Object.fromEntries(new FormData(form).entries());
    const { website, consent, ...fields } = values;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: { ...fields, consent: consent === "on" },
        website,
        challenge,
      }),
      signal: AbortSignal.timeout(18000),
    });
    if (!response.ok) {
      if (response.status === 429)
        throw Error(
          "Bitte warten Sie einige Minuten vor einer weiteren Anfrage. Sie erreichen uns auch per E-Mail oder Telefon.",
        );
      if (response.status === 400) {
        challenge = null;
        throw Error(
          "Bitte prüfen Sie Ihre Angaben und senden Sie die Anfrage erneut.",
        );
      }
      throw Error(
        "Die Anfrage konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten. Bitte erneut versuchen oder uns direkt kontaktieren.",
      );
    }
    result.textContent =
      "Vielen Dank! Ihre Anfrage ist eingegangen. Wir melden uns persönlich bei Ihnen.";
    form.reset();
    challenge = null;
    void loadChallenge().catch(() => {});
  } catch (error) {
    result.textContent =
      error instanceof Error && error.message !== "unavailable"
        ? error.message
        : "Die Verbindung ist gerade nicht verfügbar. Bitte versuchen Sie es erneut oder kontaktieren Sie uns direkt.";
  } finally {
    busy = false;
    button.disabled = false;
    button.textContent = "Anfrage senden ↗";
  }
});
// The previous CRM service worker used cache-first navigation. Remove only the
// registration whose scope contains this legacy form, so future visits stay fresh.
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .getRegistration(location.href)
    .then((reg) => reg?.unregister())
    .catch(() => {});
