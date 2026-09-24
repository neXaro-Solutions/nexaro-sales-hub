import type {ExistingProviderInput} from "./fieldSalesComparison";
export type FeeReadiness={missing:string[];ready:boolean};
export function feeReadiness(input:ExistingProviderInput,provider:string,cardMixConfirmed:boolean,feeRatesConfirmed:boolean):FeeReadiness{
 const missing:string[]=[];
 if(!provider.trim())missing.push("Aktuellen Zahlungsanbieter prüfen oder ergänzen");
 if(!Number.isFinite(input.volume)||input.volume<=0)missing.push("Kartenumsatz aus Abrechnung bestätigen");
 if(!cardMixConfirmed)missing.push("Kartenmix prüfen (80/20 ist sonst nur eine Vorgabe)");
 if(input.confirmedTotal===null||!Number.isFinite(input.confirmedTotal)){
  if(!feeRatesConfirmed)missing.push("Gebührensätze prüfen oder geprüfte Gesamtgebühren aus der Abrechnung eintragen");
 }
 return {missing,ready:missing.length===0};
}
export function feeReviewSignature(input:ExistingProviderInput,provider:string,cardMixConfirmed:boolean,feeRatesConfirmed:boolean){
 return JSON.stringify({input,provider:provider.trim(),cardMixConfirmed,feeRatesConfirmed});
}
