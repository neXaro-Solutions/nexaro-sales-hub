import {describe,it,expect} from "vitest";
import {recommendSumup,compareSelectedSumup,selectedPackageName,deriveDomesticShare,deriveCampaignPrefill} from "../src/lib/sumup-needs";
import {emptySidekickSelection,chooseSidekickLicense,sidekickLicenseMonthly,sidekickOfferLines,normalizeSidekickSelection,withoutFixedTerm} from "../src/lib/sumup-sidekick";
import type {ExistingProviderInput} from "../src/lib/fieldSalesComparison";
const input:ExistingProviderInput={volume:6000,transactions:150,debitShare:80,debitRate:.99,creditRate:2.59,serviceFee:0,terminalFee:0,perTransaction:0,confirmedTotal:118.45};
describe("SumUp needs-based package and honest cost comparison",()=>{
 it("does not suggest a fee campaign from untouched default existing-provider rates",()=>{
  expect(deriveCampaignPrefill(1.95,false)).toBeNull();
 });
 it("suggests the nearest available campaign, without authorizing it",()=>{
  expect(deriveCampaignPrefill(.99,true)).toMatchObject({index:3,rate:1.05});
  expect(deriveCampaignPrefill(1.25,true)).toMatchObject({index:1,rate:1.29});
 });
 it("does not suggest a campaign for invalid confirmed input",()=>{
  expect(deriveCampaignPrefill(NaN,true)).toBeNull();
 });
 it("leaves Domestic empty when only the unconfirmed 80/20 default exists",()=>{
  expect(deriveDomesticShare({debitShare:80,cardMixConfirmed:false})).toBeNull();
 });
 it("suggests an editable, clearly labelled proxy when 80/20 was confirmed",()=>{
  expect(deriveDomesticShare({debitShare:80,cardMixConfirmed:true})).toMatchObject({value:80,source:"estimate"});
 });
 it("prefers explicitly documented eligible vs other card groups over the Debit proxy",()=>{
  expect(deriveDomesticShare({debitShare:80,cardMixConfirmed:true,eligibleVolume:3000,otherVolume:1000})).toMatchObject({value:75,source:"documented"});
 });
 it("rejects invalid or incomplete evidence",()=>{
  expect(deriveDomesticShare({debitShare:80,cardMixConfirmed:false,eligibleVolume:3000})).toBeNull();
  expect(deriveDomesticShare({debitShare:101,cardMixConfirmed:true})).toBeNull();
 });
 it("distinguishes Kassensystem Plus from Zahlungen Plus",()=>{
  const s={...emptySidekickSelection,licenses:["posplus"]};
  expect(selectedPackageName(s).title).toBe("Kassensystem Plus");
  const c=compareSelectedSumup(input,s);
  expect(c.sumupTotal).toBeCloseTo(6000*.0139+49,2);
  expect(c.monthlyDifference).toBeCloseTo(118.45-c.sumupTotal,2);
 });
 it("no fixed-term removes Plus and KDS, campaign fee and monthly base, even for a previously saved package",()=>{
   const previous={...emptySidekickSelection,licenses:["posplus","kds"],campaignIndex:5,campaignAuthorized:true,domesticShare:100,hardware:[{id:"terminal",quantity:1}]};
   const selected=withoutFixedTerm(previous);
   expect(selected.licenses).toEqual([]);
   expect(selected.hardware).toEqual([{id:"terminal",quantity:1}]);
   expect(selected.campaignIndex).toBeNull();
   expect(selected.campaignAuthorized).toBe(false);
   const costs=compareSelectedSumup(input,selected);
   expect(costs.sumupBase).toBe(0);
   expect(costs.sumupDebit).toBe(1.39);
   expect(costs.sumupCredit).toBe(1.39);
   expect(costs.sumupTotal).toBeCloseTo(6000*.0139,2);
   expect(selectedPackageName(selected).title).toBe("Umsatzbasiertes Zahlen");
   expect(sidekickOfferLines(selected).every(line=>line.name.includes("Hardware"))).toBe(true);
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
