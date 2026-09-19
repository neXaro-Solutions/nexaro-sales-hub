import { round } from "./calculations";

/** Öffentliche DE-Referenzpreise netto, Stand 2026-09-19. Null = Preis vor Angebot verifizieren. */
export const catalogCheckedAt = "2026-09-19";
export const catalogSource = "https://www.sumup.com/de-de/preise/";
export const catalogHardwareSource = "https://www.sumup.com/de-de/kartenterminals/";
export const hardwareCatalog = [
  { id: "tap", name: "Tap to Pay", price: 0, source: "https://www.sumup.com/de-de/tap-to-pay/" },
  { id: "lite", name: "Solo Lite", price: 34, source: catalogHardwareSource },
  { id: "solo", name: "Solo", price: 79, source: catalogHardwareSource },
  { id: "terminal", name: "Terminal", price: 169, source: catalogHardwareSource },
  { id: "dock", name: "Solo Lite und Ladestation", price: 44, source: "https://www.sumup.com/de-de/solo-lite-kartenterminal/" },
  { id: "pos", name: "SumUp Kasse (zwei Bildschirme)", price: 399, source: "https://www.sumup.com/de-de/kassensystem-kasse/" },
  { id: "drawer", name: "Kassenschublade 330A", price: null, source: null },
  { id: "mpop", name: "Star mPOP – Bondrucker und Kassenschublade", price: null, source: null },
  { id: "epson", name: "Epson TM-m30II Drucker", price: null, source: null },
  { id: "scanner", name: "Barcode-Scanner NETUM C-750", price: null, source: null },
  { id: "lan", name: "RJ45 LAN-Kabel – 3 m", price: null, source: null },
  { id: "soloprinter", name: "Solo und Tresendrucker", price: null, source: null },
  { id: "solodock", name: "Solo und Ladestation", price: null, source: null },
  { id: "posprinter", name: "SumUp Kasse und Bondrucker", price: null, source: null },
  { id: "posbundle", name: "SumUp Kasse mit Drucker, Schublade und Scanner", price: null, source: null },
  { id: "kdsdevice", name: "SumUp KDS – TES 15 inch", price: null, source: null },
] as const;
export type HardwareId = (typeof hardwareCatalog)[number]["id"];
export type HardwareSelection = { id: HardwareId; quantity: number; price: number | null };
export const subscriptions = [
  { id: "posplus", name: "Kassensystem Plus", monthly: 49, source: catalogSource },
  { id: "accountplus", name: "Geschäftskonto Plus (inkl. MwSt.)", monthly: 25, source: catalogSource },
  { id: "invoicesplus", name: "Rechnungen Plus", monthly: 10, source: catalogSource },
  { id: "posannual", name: "Kassensystem Plus jährlich", monthly: null, source: null },
  { id: "kds", name: "SumUp KDS", monthly: null, source: null },
  { id: "beauty", name: "Beauty Plus", monthly: null, source: null },
] as const;
export type SubscriptionSelection = { id: string; monthly: number | null };
export type CardMix = {
  domesticDebit: number; domesticCredit: number; international: number;
  corporate: number; premium: number; cardNotPresent: number; amex: number;
  unknown: number; sumupCard: number;
};
export const emptyMix: CardMix = {
  domesticDebit: 0, domesticCredit: 0, international: 0, corporate: 0,
  premium: 0, cardNotPresent: 0, amex: 0, unknown: 0, sumupCard: 0,
};
export type PricingPlan = "payg" | "plus" | "annual";
export type ComparisonInput = {
  monthlyVolume: number;
  currentMonthly: number;
  currentFixed: number;
  currentVariablePercent: number;
  currentTransactionCount: number;
  currentPerTransaction: number;
  mix: CardMix;
  splitConfirmed: boolean;
  hardware: HardwareSelection[];
  hardwareDiscount: number;
  subscriptions: SubscriptionSelection[];
};
const totalMix = (mix: CardMix) => Object.values(mix).reduce((a, b) => a + b, 0);
export function compareOffers(input: ComparisonInput) {
  const numeric = [input.monthlyVolume, input.currentMonthly, input.currentFixed,
    input.currentVariablePercent, input.currentTransactionCount, input.currentPerTransaction,
    input.hardwareDiscount, ...Object.values(input.mix)];
  if (numeric.some((n) => !Number.isFinite(n) || n < 0))
    throw Error("Beträge und Kartenumsätze müssen gültige, nichtnegative Zahlen sein.");
  if (input.hardwareDiscount > 25) throw Error("Hardware-Rabatt darf maximal 25 % betragen.");
  if (input.currentVariablePercent > 100) throw Error("Ist-Gebühr darf maximal 100 % betragen.");
  if (input.hardware.some(h => !Number.isInteger(h.quantity) || h.quantity < 1 || h.quantity > 100 ||
     h.price === null || !Number.isFinite(h.price) || h.price < 0) ||
     input.subscriptions.some(s => s.monthly === null || !Number.isFinite(s.monthly) || s.monthly < 0))
    throw Error("Ausgewählte Produkte ohne bestätigten Preis zuerst bepreisen.");
  const sum = totalMix(input.mix);
  if (sum > input.monthlyVolume + 0.01)
    throw Error("Kartenmix ist größer als das monatliche TPV.");
  const remaining = Math.max(0, input.monthlyVolume - sum);
  // Unaufgeschlüsselter Rest: konservativ mit 1,39 %, nicht als 0,79 % behandeln.
  const reduced = input.mix.domesticDebit + input.mix.domesticCredit;
  const online = input.mix.cardNotPresent;
  const taxable = Math.max(0, input.monthlyVolume - input.mix.sumupCard - online);
  const variablePayg = taxable * .0139 + online * .025;
  const variablePlus = reduced * .0079 + (taxable - reduced) * .0139 + online * .025;
  const fixedSubs = input.subscriptions.reduce((s, x) => s + (x.monthly || 0), 0);
  const current = input.currentMonthly || round(input.currentFixed +
    input.monthlyVolume * input.currentVariablePercent / 100 +
    input.currentTransactionCount * input.currentPerTransaction);
  const oneOffGross = input.hardware.reduce((s, h) => s + h.quantity * (h.price || 0), 0);
  const hardwareNet = round(oneOffGross * (1 - input.hardwareDiscount / 100));
  const hardwareSaving = round(oneOffGross - hardwareNet);
  const plans = ([
    { id: "payg", title: "Umsatzbasiertes Zahlen", base: 0, yearlyPrepaid: 0, variable: variablePayg },
    { id: "plus", title: "Zahlungen Plus · monatlich", base: 19, yearlyPrepaid: 0, variable: variablePlus },
    { id: "annual", title: "Zahlungen Plus · jährlich", base: 0, yearlyPrepaid: 199, variable: variablePlus },
  ] as const).map(plan => {
    const monthly = round(plan.variable + plan.base + fixedSubs + plan.yearlyPrepaid / 12);
    const year = round((plan.variable + plan.base + fixedSubs) * 12 + plan.yearlyPrepaid + hardwareNet);
    return {
      ...plan, monthly, year, firstMonth: round(plan.variable + plan.base + fixedSubs + plan.yearlyPrepaid + hardwareNet),
      savingsMonthly: round(current - monthly), savingsYear: round(current * 12 - year),
    };
  });
  const best = [...plans].sort((a, b) => a.year - b.year)[0];
  return { current, plans, best, hardwareNet, hardwareSaving, fixedSubs,
    missingMix: round(remaining), warning: !input.splitConfirmed || remaining > .01,
    customOffer: input.monthlyVolume >= 10000 };
}
