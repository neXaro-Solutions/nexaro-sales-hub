import { describe, it, expect } from "vitest";
import { extractStatement, normalizeStatement, recognizedStatementValues } from "../src/lib/statement";
import { recommendHardware, defaultNeeds } from "../src/lib/payment-advisor";
import { paymentAnalysis } from "../src/lib/calculations";
describe("Statement review", () => {
  it("never turns negative counts or Unicode-negative fees into positive suggestions", () => {
    expect(
      extractStatement(
        "Anzahl Transaktionen: - 200\nTransaktionen: 20.09.2026\nGesamtkosten: − 12,00",
      ).transactions,
    ).toEqual([]);
    expect(extractStatement("Gesamtkosten: − 12,00").costs).toEqual([]);
  });
  it("extracts labelled German money without treating payout as turnover", () => {
    const c = extractStatement(
      "Kartenumsatz vor Ort: 5.123,45 EUR\nOnline-Umsatz: 100,00 EUR\nAnzahl Transaktionen: 240\nGesamtkosten netto: 85,50 EUR\nAuszahlungsbetrag: 5.137,95 EUR",
    );
    expect(c.volume.map((v) => v.value)).toEqual([5123.45]);
    expect(c.onlineVolume[0].value).toBe(100);
    expect(c.transactions[0].value).toBe(240);
    expect(c.costs[0].value).toBe(85.5);
  });
  it("preserves competing totals and never adds duplicates", () => {
    expect(
      extractStatement(
        "Kartenumsatz: 100,00\nKartenumsatz: 100,00\nGesamtumsatz: 200,00",
      ).volume.map((c) => c.value),
    ).toEqual([100, 200]);
  });
  it("leaves missing, negative, percentage and ambiguous date fields unfilled", () => {
    expect(
      extractStatement(
        "IBAN DE1012345\nAuszahlung 4.000,00\nGebühren gesamt 1,39 %\nGesamtkosten -12,00",
      ).costs,
    ).toEqual([]);
  });
  it("requires explicit missing values and normalizes all values to the same month", () => {
    const values = {
      volume: "12000",
      onlineVolume: "2000",
      transactions: "440",
      costs: "200",
    };
    expect(normalizeStatement(values, 2)).toEqual({
      volume: 6000,
      onlineVolume: 1000,
      transactions: 220,
      currentTotal: 100,
    });
    expect(() =>
      normalizeStatement({ ...values, onlineVolume: "" }, 2),
    ).toThrow();
    expect(() => normalizeStatement(values, 0)).toThrow();
    expect(() =>
      normalizeStatement({ ...values, transactions: "4.5" }, 1),
    ).toThrow();
  });
});
describe("Automatic photo-to-Ist-Bestand transfer", () => {
  it("immediately imports uniquely recognized amounts without inventing missing zeroes", () => {
    expect(recognizedStatementValues(
      "Kartenumsatz vor Ort: 5.200,00 EUR\nAnzahl Transaktionen: 260\nGesamtgebühren: 102,85 EUR"
        
    )).toEqual({ volume: 5200, transactions: 260, currentTotal: 102.85 });
  });
  it("leaves ambiguous values for correction in step two", () => {
    expect(recognizedStatementValues(
      "Kartenumsatz: 5.000,00\nKartenumsatz: 6.000,00\nAnzahl Transaktionen: 300"
        
    )).toEqual({ transactions: 300 });
  });
  it("allows going straight to step two with no reliable values", () => {
    expect(recognizedStatementValues("Foto unscharf")).toEqual({});
  });
});
describe("Payment / hardware advice", () => {
  const input = {
    volume: 10000,
    onlineVolume: 0,
    transactions: 200,
    currentRate: 9,
    currentFixed: 500,
    currentPerTransaction: 1,
    currentTotal: 130,
    hardware: 59,
    eligibleShare: 100,
    freeShare: 0,
    targetVolume: 10000,
  };
  it("uses reviewed total without double-counting fee components", () => {
    expect(paymentAnalysis(input).current).toBe(130);
  });
  it("requires annual opt-in and counts the annual fee exactly once", () => {
    const monthly = paymentAnalysis(input);
    expect(monthly.recommended).toBe("Zahlungen Plus");
    const annual = paymentAnalysis(input, true);
    expect(annual.recommended).toContain("Jahresabo");
    expect(annual.firstYear).toBe(79 * 12 + 199 + 59);
    expect(annual.firstMonth).toBe(79 + 199 + 59);
    expect(annual.annualSavings).toBe(130 * 12 - annual.firstYear);
  });
  it("does not recommend Plus when no volume is eligible", () => {
    expect(
      paymentAnalysis({ ...input, eligibleShare: 0 }, true).recommended,
    ).toBe("Umsatzbasiert");
  });
  it("honours printer, chip and standalone needs instead of selecting cheapest incompatible hardware", () => {
    expect(recommendHardware(defaultNeeds).best.name).toBe("Solo");
    expect(recommendHardware({ ...defaultNeeds, paper: true }).best.name).toBe(
      "Terminal",
    );
    expect(
      recommendHardware({
        ...defaultNeeds,
        smartphone: true,
        standalone: false,
      }).best.name,
    ).toBe("Solo Lite");
    expect(
      recommendHardware({
        ...defaultNeeds,
        smartphone: true,
        standalone: false,
        chip: false,
      }).best.name,
    ).toBe("Tap to Pay");
    expect(
      recommendHardware({ ...defaultNeeds, advancedPos: true }).warning,
    ).toContain("nicht eingepreist");
  });
});
