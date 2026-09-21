import {describe,it,expect} from "vitest";
import {recommendSumup,compareSelectedSumup,selectedPackageName} from "../src/lib/sumup-needs";
import {emptySidekickSelection} from "../src/lib/sumup-sidekick";
import type {ExistingProviderInput} from "../src/lib/fieldSalesComparison";
const input:ExistingProviderInput={volume:6000,transactions:150,debitShare:80,debitRate:.99,creditRate:2.59,serviceFee:0,terminalFee:0,perTransaction:0,confirmedTotal:118.45};
describe("SumUp needs-based package and honest cost comparison",()=>{
 it("distinguishes Kassensystem Plus from Zahlungen Plus",()=>{
  const s={...emptySidekickSelection,licenses:["posplus"]};
  expect(selectedPackageName(s).title).toBe("Kassensystem Plus + Umsatzbasiertes Zahlen");
  const c=compareSelectedSumup(input,s);
  expect(c.sumupTotal).toBeCloseTo(6000*.0139+49,2);
  expect(c.monthlyDifference).toBeCloseTo(118.45-c.sumupTotal,2);
 });
 it("includes both subscriptions exactly once",()=>{
  const s={...emptySidekickSelection,licenses:["posplus","payments"]};
  const c=compareSelectedSumup(input,s);
  expect(selectedPackageName(s).title).toBe("Kassensystem Plus + Zahlungen Plus");
  expect(c.sumupTotal).toBeCloseTo(6000*.8*.0079+6000*.2*.0139+19+49,2);
  expect(c.sumupBase).toBe(68);
 });
 it("does not apply unapproved fee campaigns",()=>{
  const s={...emptySidekickSelection,licenses:["posplus"],campaignIndex:5,domesticShare:90,campaignAuthorized:false};
  expect(compareSelectedSumup(input,s).sumupTotal).toBeCloseTo(6000*.0139+49,2);
  expect(compareSelectedSumup(input,{...s,campaignAuthorized:true}).sumupTotal).toBeCloseTo(6000*.9*.0085+6000*.1*.0199+49,2);
 });
 it("chooses POS and kitchen software from future wishes before recommending a payment plan",()=>{
  const r=recommendSumup(input,["pos","receipt","kitchen"],"Wir benötigen Küchendisplay und Belegdruck","Sonstiges");
  expect(r.licenses).toContain("posplus");
  expect(r.licenses).toContain("kds");
  expect(r.hardwareId).toBe("posprinter");
  expect(r.reasons.some(t=>t.includes("KDS"))).toBe(true);
 });
 it("selects salon software when future explicitly requests it",()=>{
  expect(recommendSumup(input,[],"Beauty Salon mit Terminen","Sonstiges").licenses).toContain("beauty");
 });
});
