import type { OfferLine, Stop } from "./types";
export const money = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    n,
  );
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const dayKey = (value: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateLabel = (v: string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(v.length === 10 ? v + "T12:00:00Z" : v));
export const address = (c: { street: string; zip: string; city: string }) =>
  [c.street, [c.zip, c.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
export const finite = (value: number, label: string, min = 0, max = 1e9) => {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label}: Wert zwischen ${min} und ${max} erforderlich.`);
  return value;
};
export type PaymentInput = {
  currentTotal?: number;
  volume: number;
  eligibleShare: number;
  freeShare: number;
  onlineVolume: number;
  transactions: number;
  currentRate: number;
  currentFixed: number;
  currentPerTransaction: number;
  hardware: number;
  targetVolume: number;
};
export function paymentAnalysis(p: PaymentInput, allowAnnual = false) {
  Object.entries(p).forEach(([k, v]) => finite(v, k));
  finite(p.eligibleShare, "Plus-Kartenanteil", 0, 100);
  finite(p.freeShare, "SumUp-Kartenanteil", 0, 100);
  finite(p.currentRate, "Gebühr", 0, 100);
  if (p.eligibleShare + p.freeShare > 100)
    throw new Error("Kartenanteile dürfen zusammen höchstens 100 % ergeben.");
  const eligible = (p.volume * p.eligibleShare) / 100,
    free = (p.volume * p.freeShare) / 100,
    other = p.volume - eligible - free;
  const standard = round((p.volume - free) * 0.0139 + p.onlineVolume * 0.025);
  const plus = round(
    19 + eligible * 0.0079 + other * 0.0139 + p.onlineVolume * 0.025,
  );
  const current =
    p.currentTotal !== undefined
      ? finite(p.currentTotal, "Belegkosten")
      : round(
          ((p.volume + p.onlineVolume) * p.currentRate) / 100 +
            p.currentFixed +
            p.transactions * p.currentPerTransaction,
        );
  const plusAnnualTotal = round((plus - 19) * 12 + 199);
  const annualSelected =
    allowAnnual && plusAnnualTotal < Math.min(standard, plus) * 12;
  const best = annualSelected
      ? round(plusAnnualTotal / 12)
      : Math.min(standard, plus),
    bestYear = annualSelected ? plusAnnualTotal : round(best * 12),
    savings = round(current - best);
  return {
    standard,
    plus,
    current,
    best,
    savings,
    annualSavings: round(current * 12 - bestYear - p.hardware),
    firstYear: round(bestYear + p.hardware),
    firstMonth: round((annualSelected ? plus - 19 + 199 : best) + p.hardware),
    plusAnnual: round(plusAnnualTotal / 12),
    plusAnnualTotal,
    annualSelected,
    recommended: annualSelected
      ? "Zahlungen Plus · Jahresabo"
      : plus < standard
        ? "Zahlungen Plus"
        : "Umsatzbasiert",
    breakEven:
      p.eligibleShare > 0 ? 19 / ((0.006 * p.eligibleShare) / 100) : null,
    extraVolume: Math.max(0, p.targetVolume - p.volume),
    custom: p.volume >= 10000,
  };
}
export function margin(ek: number, vk: number, quantity = 1, shipping = 0) {
  [ek, vk, quantity, shipping].forEach((v) => finite(v, "Kalkulation"));
  const profit = round((vk - ek) * quantity - shipping);
  return {
    profit,
    margin: vk ? round(((vk - ek) / vk) * 100) : null,
    markup: ek ? round(((vk - ek) / ek) * 100) : null,
    revenue: round(vk * quantity),
    cost: round(ek * quantity + shipping),
  };
}
export function offerTotals(lines: OfferLine[]) {
  let net = 0,
    gross = 0;
  for (const l of lines) {
    finite(l.quantity, "Menge", 1, 1000000);
    finite(l.price, "Preis");
    finite(l.vat, "MwSt.", 0, 100);
    const line = round(l.quantity * l.price);
    net += line;
    gross += line + round((line * l.vat) / 100);
  }
  return { net: round(net), gross: round(gross), vat: round(gross - net) };
}
export function distance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat),
    dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function orderStops(
  stops: Stop[],
  origin?: { lat: number; lng: number },
) {
  const remaining = stops.filter((s) => s.lat !== null && s.lng !== null),
    missing = stops.filter((s) => s.lat === null || s.lng === null);
  const ordered: Stop[] = [];
  let current = origin ?? remaining[0];
  while (remaining.length) {
    let idx = 0;
    if (current)
      idx = remaining.reduce(
        (best, s, i) =>
          distance(
            current as { lat: number; lng: number },
            s as { lat: number; lng: number },
          ) <
          distance(
            current as { lat: number; lng: number },
            remaining[best] as { lat: number; lng: number },
          )
            ? i
            : best,
        0,
      );
    const [next] = remaining.splice(idx, 1);
    ordered.push(next);
    current = next;
  }
  return [...ordered, ...missing];
}
export function mapsRoutes(stops: Stop[], origin = "") {
  const urls: string[] = [];
  let previous = origin;
  // Max. 3 waypoints for mobile Google Maps URLs, so no stop is silently dropped.
  for (let i = 0; i < stops.length; i += 4) {
    const chunk = stops.slice(i, i + 4);
    const loc = (s: Stop) =>
      s.lat !== null && s.lng !== null ? `${s.lat},${s.lng}` : s.address;
    const q = new URLSearchParams({
      api: "1",
      travelmode: "driving",
      destination: loc(chunk[chunk.length - 1]),
    });
    if (previous) q.set("origin", previous);
    if (chunk.length > 1)
      q.set("waypoints", chunk.slice(0, -1).map(loc).join("|"));
    urls.push("https://www.google.com/maps/dir/?" + q);
    previous = loc(chunk[chunk.length - 1]);
  }
  return urls;
}
export const mapSearch = (query: string) =>
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent(query);
export const streetView = (lat: number, lng: number) =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
