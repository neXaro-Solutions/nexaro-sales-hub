import {describe,it,expect} from "vitest";
import {recommendSumup,compareSelectedSumup,selectedPackageName} from "../src/lib/sumup-needs";
import {emptySidekickSelection,chooseSidekickLicense,sidekickLicenseMonthly,sidekickOfferLines,normalizeSidekickSelection} from "../src/lib/sumup-sidekick";
import type {ExistingProviderInput} from "../src/lib/fieldSalesComparison";
const input:ExistingProviderInput={volume:6000,transactions:150,debitShare:80,debitRate:.99,creditRate:2.59,serviceFee:0,terminalFee:0,perTransaction:0,confirmedTotal:118.45};
describe("SumUp needs-based package and honest cost comparison",()=>{
 it("distinguishes Kassensystem Plus from Zahlungen Plus",()=>{
  const s={...emptySidekickSelection,licenses:["posplus"]};
  expect(selectedPackageName(s).title).toBe("Kassensystem Plus");
  const c=compareSelectedSumup(input,s);
  expect(c.sumupTotal).toBeCloseTo(6000*.0139+49,2);
  expect(c.monthlyDifference).toBeCloseTo(118.45-c.sumupTotal,2);
 });
 it("never combines Kassensystem Plus and Zahlungen Plus",()=>{
  const invalid={...emptySidekickSelection,licenses:["posplus","payments"]};
  expect(()=>sidekickLicenseMonthly(invalid)).toThrow(/eine Plus-Variante/);
  expect(()=>sidekickOfferLines(invalid)).toThrow(/eine Plus-Variante/);
  const normalized=normalizeSidekickSelection(invalid);
  expect(normalized.licenses).toEqual(["posplus"]);
  expect(selectedPackageName(invalid).title).toBe("Kassensystem Plus");
  expect(compareSelectedSumup(input,invalid).sumupTotal).toBeCloseTo(6000*.0139+49,2);
  const changed=chooseSidekickLicense(normalized,"payments");
  expect(changed.licenses).toEqual(["payments"]);
  expect(selectedPackageName(changed).title).toBe("Zahlungen Plus");
  expect(compareSelectedSumup(input,changed).sumupTotal).toBeCloseTo(6000*.8*.0079+6000*.2*.0139+19,2);
 });
 it("monthly and annual Kassensystem Plus replace one another",()=>{
  const initial={...emptySidekickSelection,licenses:["posplus","kds"]};
  const chosen=chooseSidekickLicense(initial,"posannual");
  expect(chosen.licenses).toEqual(["kds","posannual"]);
  expect(sidekickLicenseMonthly(chosen)).toBe(64);
 });
 it("does not apply unapproved fee campaigns",()=>{
  const s={...emptySidekickSelection,licenses:["posplus"],campaignIndex:5,domesticShare:90,campaignAuthorized:false};
  expect(compareSelectedSumup(input,s).sumupTotal).toBeCloseTo(6000*.0139+49,2);
  expect(compareSelectedSumup(input,{...s,campaignAuthorized:true}).sumupTotal).toBeCloseTo(6000*.9*.0085+6000*.1*.0199+49,2);
 });
 it("chooses POS and kitchen software from future wishes before recommending a payment plan",()=>{
  const r=recommendSumup(input,["pos","receipt","kitchen"],"Wir benötigen Küchendisplay und Belegdruck","Sonstiges");
  expect(r.licenses).toContain("posplus");
  expect(r.licenses).not.toContain("payments");
  expect(r.licenses).toContain("kds");
  expect(r.hardwareId).toBe("posprinter");
  expect(r.reasons.some(t=>t.includes("KDS"))).toBe(true);
 });
 it("selects salon software when future explicitly requests it",()=>{
  const r=recommendSumup(input,[],"Beauty Salon mit Terminen","Sonstiges");
  expect(r.licenses).toContain("beauty");
  expect(r.licenses).not.toContain("payments");
 });
});
