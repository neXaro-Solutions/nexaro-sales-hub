import {describe,expect,it} from "vitest";
import {emptySidekickSelection,type SumupSidekickSelection} from "../src/lib/sumup-sidekick";
import {sumupValueHighlights} from "../src/lib/sumup-value";

function withSelection(partial:Partial<SumupSidekickSelection>):SumupSidekickSelection{
 return {...emptySidekickSelection,...partial};
}
describe("SumUp Vorteil functional-value evidence",()=>{
 it("only lists capabilities of actually selected software and hardware",()=>{
  const selection=withSelection({licenses:["posplus","kds"],hardware:[{id:"posbundle",quantity:1},{id:"kdsdevice",quantity:1}]});
  const labels=sumupValueHighlights(selection);
  expect(labels).toContain("Kassen- und Artikelverwaltung mit Kassensystem Plus");
  expect(labels).toContain("Bestellungen auf dem Küchenmonitor mit SumUp KDS");
  expect(labels).toContain("Artikel per Barcode erfassen");
  expect(labels).toContain("Küchenmonitor als Hardware");
  expect(labels.some(label=>label.includes("Beauty"))).toBe(false);
  expect(labels.some(label=>label.includes("Zahlungen Plus"))).toBe(false);
 });
 it("does not invent capabilities when no hardware or license is selected",()=>{
  expect(sumupValueHighlights(withSelection({payout:"external"}))).toEqual([]);
 });
 it("shows the no-fixed-term value only when chosen",()=>{
  const selection=withSelection({hardware:[{id:"lite",quantity:1}],payout:"external"});
  expect(sumupValueHighlights(selection,false)).not.toContain("Keine gewünschte feste Vertragslaufzeit im Standard-Zahlungsmodell");
  expect(sumupValueHighlights(selection,true)).toContain("Keine gewünschte feste Vertragslaufzeit im Standard-Zahlungsmodell");
 });
 it("does not count zero-quantity hardware as a selected benefit",()=>{
  expect(sumupValueHighlights(withSelection({hardware:[{id:"scanner",quantity:0}],payout:"external"}))).toEqual([]);
 });
});
