import {round} from "./calculations";
import {compareFieldSales,type ExistingProviderInput,type SumupPlan} from "./fieldSalesComparison";
import {sidekickLicenseMonthly,sidekickScenario,normalizeSidekickSelection,sumupSidekickFees,type SumupSidekickSelection} from "./sumup-sidekick";

export type CustomerGoal="receipt"|"standalone"|"pos"|"mobile"|"savings"|"payout"|"scanner"|"cashdrawer"|"kitchen"|"beauty"|"hospitality"|"multiple";
export const customerGoals:{id:CustomerGoal;label:string}[]=[
{id:"receipt",label:"Papierbelege drucken"},{id:"standalone",label:"Ohne Smartphone kassieren"},{id:"pos",label:"Kassen-/Artikelverwaltung"},{id:"mobile",label:"Mobil beim Kunden / am Tisch"},{id:"savings",label:"Gebühren / laufende Kosten senken"},{id:"payout",label:"Schnellere Auszahlung"},{id:"scanner",label:"Artikel per Barcode scannen"},{id:"cashdrawer",label:"Kassenschublade / Bargeld"},{id:"kitchen",label:"Bestellungen in die Küche schicken"},{id:"beauty",label:"Salon / Beauty-Funktionen"},{id:"hospitality",label:"Tischplan / Gastronomie"},{id:"multiple",label:"Mehrere Kassenplätze / Drucker"}
];
export function recommendSumup(input:ExistingProviderInput,goals:CustomerGoal[],future:string,existing:string){
 const words=future.toLocaleLowerCase("de-DE");
 const has=(id:CustomerGoal,rx:RegExp)=>goals.includes(id)||rx.test(words);
 const pos=has("pos",/kasse|kassensystem|artikel|warenwirtschaft/),kitchen=has("kitchen",/küche|kitchen|bestellbon/),
 beauty=has("beauty",/beauty|kosmetik|friseur|salon|terminbuch/),hospitality=has("hospitality",/tischplan|tischverwaltung|restaurant|gastronomi/);
 const scanner=has("scanner",/barcode|scanner/),drawer=has("cashdrawer",/kassenschublade|bargeld/),multi=has("multiple",/mehrere kassen|mehrere drucker|filial/);
 const receipt=has("receipt",/papierbeleg|drucken|drucker|bon/),standalone=has("standalone",/ohne smartphone|ohne handy|eigenständig/);
 const mobile=has("mobile",/mobil|unterwegs|am tisch|außendienst/);
 const requiresPos=pos||kitchen||hospitality||scanner||drawer||multi;
 let hardwareId=requiresPos?(scanner&&drawer?"posbundle":drawer?"posdual":receipt?"posprinter":"pos"):receipt?"terminal":standalone?"solo":mobile&&/telefon|tap to pay/i.test(existing)?"tap":mobile?"lite":"solo";
 const standard=compareFieldSales(input,"standard"),plus=compareFieldSales(input,"plus");
 const paymentPlan:SumupPlan=plus.sumupTotal<standard.sumupTotal?"plus":"standard";
 // Bedarf entscheidet über die eine Plus-Variante, nicht die niedrigste isolierte Kartengebühr.
 const primary=requiresPos?"posplus":beauty?"beauty":paymentPlan==="plus"?"payments":null;
 const licenses:string[]=[...(primary?[primary]:[]),...(kitchen?["kds"]:[])];
 const payout:SumupSidekickSelection["payout"]=has("payout",/schnell|sofort|3 stunden|auszahlung/)?"three":"daily";
 const reasons=[requiresPos?"Kassen-, Artikel- oder Zusatzgeräte-Anforderungen sprechen für Kassensystem Plus.":receipt?"Papierbelege benötigen eine Drucklösung.":mobile?"Mobilität steht im Vordergrund.":"Schlanke Zahlungsannahme ohne zusätzliche Kassensoftware."];
 if(beauty)reasons.push(requiresPos?"Kassensystem Plus hat wegen der ausdrücklich benötigten Kassenfunktionen Vorrang vor Beauty Plus.":"Beauty Plus wegen des angegebenen Salonbedarfs.");
 if(kitchen)reasons.push("KDS zur Anzeige und Verwaltung von Küchenbestellungen.");
 reasons.push(primary==="payments"?"Zahlungen Plus ist ohne speziellen POS-/Beauty-Bedarf bei den eingegebenen Umsätzen rechnerisch günstiger.":primary?"Die ausgewählte Plus-Variante richtet sich nach dem Funktionsbedarf; Zahlungen Plus wird nicht zusätzlich hinzugefügt.":"Umsatzbasiertes Zahlen ohne zusätzliche Plus-Lizenz.");
 if(!goals.length&&!future.trim())reasons.push("Noch keine Zukunftswünsche erfasst; Empfehlung nur vorläufig.");
 return {hardwareId,licenses,paymentPlan,payout,reasons};
}
export type DomesticShareEvidence={debitShare:number;cardMixConfirmed:boolean;eligibleVolume?:number;otherVolume?:number};
export function deriveDomesticShare(evidence:DomesticShareEvidence):{value:number;source:"documented"|"estimate";explanation:string}|null{
 const eligible=evidence.eligibleVolume,other=evidence.otherVolume;
 if(eligible!==undefined&&other!==undefined&&Number.isFinite(eligible)&&Number.isFinite(other)&&eligible>=0&&other>=0&&eligible+other>0){
  return {value:Math.round(eligible/(eligible+other)*1000)/10,source:"documented",explanation:"Aus auf der Abrechnung ausdrücklich getrennt ausgewiesenen geeigneten und sonstigen Kartenzahlungen berechnet."};
 }
 if(evidence.cardMixConfirmed&&Number.isFinite(evidence.debitShare)&&evidence.debitShare>=0&&evidence.debitShare<=100){
  return {value:evidence.debitShare,source:"estimate",explanation:"Orientierungswert aus deinem bestätigten EC-/Debit-Anteil. Debit ist nicht dasselbe wie Domestic; bitte anhand der tatsächlichen Kartenherkunft und Kartentypen kontrollieren."};
 }
 return null;
}
export function deriveCampaignPrefill(debitRate:number,feeRatesConfirmed:boolean):{index:number;rate:number;explanation:string}|null{
 if(!feeRatesConfirmed||!Number.isFinite(debitRate)||debitRate<0||debitRate>100)return null;
 const index=sumupSidekickFees.reduce((best,entry,i)=>Math.abs(entry.domestic-debitRate)<Math.abs(sumupSidekickFees[best].domestic-debitRate)?i:best,0);
 return {index,rate:sumupSidekickFees[index].domestic,explanation:"Der nächstliegende Sidekick-Satz zur bestätigten bisherigen EC-/Debit-Gebühr. Keine automatische Freigabe und keine Gleichsetzung von Debit und Domestic."};
}
export function selectedSumupPaymentPlan(selection:SumupSidekickSelection):SumupPlan{
 return normalizeSidekickSelection(selection).licenses.includes("payments")?"plus":"standard";
}
export function compareSelectedSumup(input:ExistingProviderInput,selection:SumupSidekickSelection){
 const normalized=normalizeSidekickSelection(selection);
 const plan=selectedSumupPaymentPlan(normalized);
 const standard=compareFieldSales(input,plan);
 const recurring=sidekickLicenseMonthly(normalized)-(plan==="plus"?19:0);
 const approved=normalized.campaignAuthorized&&normalized.campaignIndex!==null&&normalized.domesticShare!==null;
 const campaign=approved?sidekickScenario(input.volume,normalized):null;
 const sumupTotal=round(campaign??(standard.sumupTotal+recurring));
 const sumupBase=round(standard.sumupBase+recurring);
 const sumupVariable=round(sumupTotal-sumupBase);
 return {...standard,sumupTotal,sumupBase,sumupVariable,monthlyDifference:round(standard.oldTotal-sumupTotal),
 annualDifference:round(12*(standard.oldTotal-sumupTotal)),
 note:(approved?"Freigegebene individuelle Sidekick-Kondition;":"Öffentliche Zahlungskondition;")+
 " gewählte Lizenzen sind enthalten. Domestic-Anteil und Kredit-/Premium-/Firmenkarten sind nicht gleichbedeutend mit dem bisherigen Debit-/Kredit-Mix. Hardware, Wechselkosten und Vertragsbindung sind separat."};
}
export function selectedPackageName(selection:SumupSidekickSelection){
 const normalized=normalizeSidekickSelection(selection);
 const software=normalized.licenses.filter(x=>x!=="payments").map(id=>({posplus:"Kassensystem Plus",posannual:"Kassensystem Plus jährlich",kds:"SumUp KDS",beauty:"Beauty Plus"} as Record<string,string>)[id]||id);
 return {software, payment:selectedSumupPaymentPlan(normalized)==="plus"?"Zahlungen Plus":"Umsatzbasiertes Zahlen",title:software.length?software.join(" + "):selectedSumupPaymentPlan(normalized)==="plus"?"Zahlungen Plus":"Umsatzbasiertes Zahlen"};
}
