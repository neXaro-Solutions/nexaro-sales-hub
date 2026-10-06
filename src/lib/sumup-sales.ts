import { round } from "./calculations";

/** Öffentliche DE-Referenzpreise netto, Stand 2026-10-06. Null = Preis vor Angebot verifizieren. */
export const catalogCheckedAt = "2026-10-06";
export const catalogSource = "https://www.sumup.com/de-de/preise/";
export const catalogHardwareSource =
  "https://www.sumup.com/de-de/kartenterminals/";
export const hardwareCatalog = [
  {
    id: "tap",
    name: "Tap to Pay",
    price: 0,
    source: "https://www.sumup.com/de-de/tap-to-pay/",
  },
  { id: "lite", name: "Solo Lite", price: 22, source: catalogHardwareSource },
  { id: "solo", name: "Solo", price: 59, source: catalogHardwareSource },
  {
    id: "terminal",
    name: "Terminal",
    price: 139,
    source: catalogHardwareSource,
  },
  {
    id: "dock",
    name: "Solo Lite und Ladestation",
    price: 44,
    source: "https://www.sumup.com/de-de/solo-lite-kartenterminal/",
  },
  {
    id: "pos",
    name: "SumUp Kasse (zwei Bildschirme)",
    price: 399,
    source: "https://www.sumup.com/de-de/kassensystem-kasse/",
  },
  { id: "drawer", name: "Kassenschublade 330A", price: null, source: null },
  {
    id: "mpop",
    name: "Star mPOP – Bondrucker und Kassenschublade",
    price: null,
    source: null,
  },
  { id: "epson", name: "Epson TM-m30II Drucker", price: null, source: null },
  {
    id: "scanner",
    name: "Barcode-Scanner NETUM C-750",
    price: null,
    source: null,
  },
  { id: "lan", name: "RJ45 LAN-Kabel – 3 m", price: null, source: null },
  {
    id: "soloprinter",
    name: "Solo und Tresendrucker",
    price: null,
    source: null,
  },
  { id: "solodock", name: "Solo und Ladestation", price: null, source: null },
  {
    id: "posprinter",
    name: "SumUp Kasse und Bondrucker",
    price: null,
    source: null,
  },
  {
    id: "posbundle",
    name: "SumUp Kasse mit Drucker, Schublade und Scanner",
    price: null,
    source: null,
  },
  {
    id: "kdsdevice",
    name: "SumUp KDS – TES 15 inch",
    price: null,
    source: null,
  },
] as const;
export type HardwareId = (typeof hardwareCatalog)[number]["id"];
export type HardwareSelection = {
  id: HardwareId;
  quantity: number;
  price: number | null;
};
export const subscriptions = [
  {
    id: "posplus",
    name: "Kassensystem Plus",
    monthly: 49,
    source: catalogSource,
  },
  {
    id: "accountplus",
    name: "Geschäftskonto Plus (inkl. MwSt.)",
    monthly: 25,
    source: catalogSource,
  },
  {
    id: "invoicesplus",
    name: "Rechnungen Plus",
    monthly: 10,
    source: catalogSource,
  },
  {
    id: "posannual",
    name: "Kassensystem Plus jährlich",
    monthly: null,
    source: null,
  },
  { id: "kds", name: "SumUp KDS", monthly: null, source: null },
  { id: "beauty", name: "Beauty Plus", monthly: null, source: null },
] as const;
export type SubscriptionSelection = { id: string; monthly: number | null };
export type CardMix = {
  domesticDebit: number;
  domesticCredit: number;
  international: number;
  corporate: number;
  premium: number;
  cardNotPresent: number;
  amex: number;
  unknown: number;
  sumupCard: number;
};
export const emptyMix: CardMix = {
  domesticDebit: 0,
  domesticCredit: 0,
  international: 0,
  corporate: 0,
  premium: 0,
  cardNotPresent: 0,
  amex: 0,
  unknown: 0,
  sumupCard: 0,
};
export type PricingPlan = "payg" | "plus" | "annual";
export type ComparisonInput = {
  currentMode?: "formula" | "total";
  monthlyVolume: number;
  currentMonthly: number;
  currentFixed: number;
  currentVariablePercent: number;
  currentTransactionCount: number;
  currentPerTransaction: number;
  plan: PricingPlan;
  mix: CardMix;
  hardware: HardwareSelection[];
  subscriptions: SubscriptionSelection[];
  customRate?: number | null;
};
export function calculateComparison(input: ComparisonInput) {
  const mixTotal = Object.values(input.mix).reduce((sum, v) => sum + v, 0);
  if (Math.abs(mixTotal - 100) > 0.01) throw Error("Kartenmix muss 100 % ergeben.");
  if (input.monthlyVolume < 0 || input.currentMonthly < 0 || input.currentFixed < 0 ||
    input.currentVariablePercent < 0 || input.currentTransactionCount < 0 || input.currentPerTransaction < 0)
    throw Error("Werte dürfen nicht negativ sein.");
  const current = input.currentMode === "total"
    ? round(input.currentMonthly)
    : round(input.currentFixed + input.monthlyVolume * input.currentVariablePercent / 100 + input.currentTransactionCount * input.currentPerTransaction);
  const paygRate = input.customRate ?? 1.39;
  const plusDomestic = 0.79;
  const plusOther = 1.39;
  const domesticShare = input.mix.domesticDebit + input.mix.domesticCredit;
  const otherShare = 100 - domesticShare;
  const paymentFees = input.plan === "plus"
    ? round(input.monthlyVolume * domesticShare / 100 * plusDomestic / 100 + input.monthlyVolume * otherShare / 100 * plusOther / 100 + 19)
    : round(input.monthlyVolume * paygRate / 100);
  const subscriptionCost = round(input.subscriptions.reduce((sum,s)=>sum+(s.monthly||0),0));
  const sumupMonthly = round(paymentFees + subscriptionCost);
  const hardwareOneTime = round(input.hardware.reduce((sum,h)=>sum+(h.price||0)*h.quantity,0));
  return {current,sumupMonthly,paymentFees,subscriptionCost,hardwareOneTime,
    monthlyDifference:round(current-sumupMonthly),annualDifference:round((current-sumupMonthly)*12)};
}
