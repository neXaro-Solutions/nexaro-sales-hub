import { describe,expect,it } from "vitest";
import { analyzeStatementText } from "../src/lib/statement-details";
const example=[
"TESTPAY",
"Händler: Cafe Muster Berlin GmbH",
"Kartenumsatz vor Ort 12.530,00 €",
"Anzahl Transaktionen 1.057",
"Gesamtgebühren netto 235,45 €",
"EC / Debit 80 % · 1,25 %",
"Kredit / Premium 20 % · 2,50 %",
"Monatliche Servicegebühr 39,95 €",
"Hardware Preis 9,00 €"
].join("\n");
describe("statement photo field extraction",()=>{
 it("extracts the user-provided TESTPAY demo settlement including the four-column table",()=>{
  const raw=[
   "TESTPAY","Einfach. Sicher. Zahlungen.","TESTABRECHNUNG – FIKTIVE DATEN",
   "Diese Abrechnung dient ausschließlich Demo- und Präsentationszwecken.",
   "Stadtcafé Musterblick","Alexanderplatz 1","10178 Berlin",
   "Monatsabrechnung","Zeitraum: 01.08.2025 – 31.08.2025",
   "Kundennummer: TP-1002387","Rechnungsnummer: 2025-08-77124",
   "Rechnungsdatum: 01.09.2025",
   "Kartenumsatz gesamt: 12.530,00 €",
   "Transaktionen: 1.057",
   "Durchschnittlicher Umsatz pro Transaktion: 11,86 €",
   "Position Umsatz Gebührensatz Gebührenbetrag",
   "Debitkarten (80 %) 10.024,00 € 1,25 % 125,30 €",
   "Kreditkarten (20 %) 2.506,00 € 2,50 % 62,65 €",
   "Summe Transaktionsgebühren 187,95 €",
   "Monatliche Servicegebühr 39,95 €",
   "Monatliche Hardwaregebühr 9,00 €",
   "Gesamtgebühren monatlich 236,90 €",
   "TESTPAY GmbH","Musterstraße 10 | 10115 Berlin"
  ].join("\n");
  const result=analyzeStatementText(raw);
  expect(result.details.provider).toBe("TESTPAY");
  expect(result.details.merchant).toBe("Stadtcafé Musterblick");
  expect(result.details.debitShare).toBe(80);
  expect(result.details.debitRate).toBe(1.25);
  expect(result.details.creditRate).toBe(2.50);
  expect(result.details.serviceFee).toBe(39.95);
  expect(result.details.terminalFee).toBe(9);
  expect(result.values.volume).toBe(12530);
  expect(result.values.transactions).toBe(1057);
  expect(result.values.currentTotal).toBe(236.90);
  expect(result.evidence.merchant).toContain("Alexanderplatz 1");
 });

 it("recognizes the provider, merchant and both card group shares/fees",()=>{
  const result=analyzeStatementText(example);
  expect(result.details.provider).toBe("TESTPAY");
  expect(result.details.merchant).toBe("Cafe Muster Berlin GmbH");
  expect(result.details.debitShare).toBe(80);
  expect(result.details.debitRate).toBe(1.25);
  expect(result.details.creditRate).toBe(2.5);
  expect(result.details.serviceFee).toBe(39.95);
  expect(result.details.terminalFee).toBe(9);
  expect(result.values.volume).toBe(12530);
  expect(result.values.transactions).toBe(1057);
  expect(result.values.currentTotal).toBe(235.45);
 });
 it("does not mistake card mix 80 % for fee rate when fee is separately labelled",()=>{
  const result=analyzeStatementText("Payone\nKartenmix EC / Debit 80 %\nEC-Gebühr 0,99 %\nKreditkarten-Gebühr 2,59 %");
  expect(result.details.debitShare).toBe(80);
  expect(result.details.debitRate).toBe(.99);
  expect(result.details.creditRate).toBe(2.59);
 });
 it("leaves an ambiguous fee unfilled rather than guessing",()=>{
  const result=analyzeStatementText("EC Gebühr 0,99 %\nEC Gebühr 1,29 %");
  expect(result.details.debitRate).toBeUndefined();
  expect(result.warnings).toContain("Mehrdeutige Angaben zu debitRate – bitte manuell prüfen.");
 });
 it("reads an unlabelled legal-entity letterhead without treating it as the payment provider",()=>{
  const result=analyzeStatementText("Muster Café Berlin GmbH\nPayone\nKartenumsatz 8.800,00 €");
  expect(result.details.merchant).toBe("Muster Café Berlin GmbH");
  expect(result.details.provider).toBe("Payone");
 });
 it("reads a verified-looking labelled 80/20 mix but never assumes it is confirmed",()=>{
  const result=analyzeStatementText("Kartenmix: EC/Debit 80 % / Kredit 20 %\nEC-Gebühr 0,99 %");
  expect(result.details.debitShare).toBe(80);
  expect(result.details.debitRate).toBe(.99);
 });
 it("recovers percent share and rate when OCR splits the amount columns into a second line",()=>{
  const text=["Debitkarten (80 %)","10.024,00 € 1,25 % 125,30 €","Kreditkarten (20 %)","2.506,00 € 2,50 % 62,65 €"].join("\n");
  const result=analyzeStatementText(text);
  expect(result.details.debitShare).toBe(80);
  expect(result.details.debitRate).toBe(1.25);
  expect(result.details.creditRate).toBe(2.50);
 });
 it("does not silently copy a merchant into the payment provider field",()=>{
  const result=analyzeStatementText("Händler: Muster GmbH\nKartenumsatz: 5.000,00 €");
  expect(result.details.provider).toBeUndefined();
  expect(result.details.merchant).toBe("Muster GmbH");
 });
});
