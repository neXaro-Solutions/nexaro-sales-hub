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
 it("recognizes the provider, merchant and both card group shares/fees",()=>{
  const result=analyzeStatementText(example);
  expect(result.details.provider).toBe("Testpay");
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
 it("does not silently copy a merchant into the payment provider field",()=>{
  const result=analyzeStatementText("Händler: Muster GmbH\nKartenumsatz: 5.000,00 €");
  expect(result.details.provider).toBeUndefined();
  expect(result.details.merchant).toBe("Muster GmbH");
 });
});
