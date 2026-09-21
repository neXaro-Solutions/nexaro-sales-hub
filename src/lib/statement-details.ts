import { extractStatement, recognizedStatementValues } from "./statement";

export type StatementDetails = {
 provider?:string;merchant?:string;debitShare?:number;debitRate?:number;creditRate?:number;
 serviceFee?:number;terminalFee?:number;perTransaction?:number;
 eligibleVolume?:number;otherVolume?:number;
};
export type StatementAnalysis = {
 values:ReturnType<typeof recognizedStatementValues>;
 details:StatementDetails; evidence:Record<string,string>; warnings:string[];
};
const moneyToken=String.raw`-?(?:\d{1,3}(?:[. ]\d{3})+|\d+)(?:[,．]\d{1,2})?`;
const parseMoney=(s:string)=>{
 const cleaned=s.replace(/\s/g,"").replace(/[€EUR]/gi,"").replace(/．/g,",");
 if(!/^-?\d[\d.,]*$/.test(cleaned))return null;
 const decimal=cleaned.lastIndexOf(",");
 const numeric=decimal>=0?cleaned.replace(/\./g,"").replace(",","."):cleaned.replace(/\.(?=\d{3}(?:\.|$))/g,"");
 const n=Number(numeric);return Number.isFinite(n)?n:null;
};
const findPercent=(line:string)=>{
 const found=[...line.matchAll(/(?<![\d.,])([0-9]{1,2}(?:[.,][0-9]{1,3})?)\s*%/g)].map(m=>Number(m[1].replace(",",".")));
 return found.filter(n=>Number.isFinite(n)&&n<=100);
};
const findMoney=(line:string)=>{
 const found=[...line.matchAll(new RegExp(moneyToken+"\\s*(?:€|EUR)?","gi"))].map(m=>m[0]);
 return found.map(parseMoney).filter((n):n is number=>n!==null&&n>=0&&n<=1e9);
};
const stripAmounts=(s:string)=>s.replace(/\b(?:\d+[,.])?\d+\s*(?:%|€|EUR)\b/gi,"").trim();
const cleanLabel=(s:string)=>stripAmounts(s).replace(/^[\s:;#–-]+|[\s:;#–-]+$/g,"").trim();
const providerNames=[
 ["Payone",/\bpay\s*one\b|\bpayone\b/i],
 ["VR Payment",/\bvr[ -]?payment\b/i],
 ["Worldline",/\bworldline\b/i],
 ["TeleCash",/\btelecash\b/i],
 ["Nexi",/\bnexi\b/i],
 ["Unzer",/\bunzer\b/i],
 ["Concardis",/\bconcardis\b/i],
 ["SumUp",/\bsum\s*up\b/i],
 ["Zettle",/\bzettle\b/i],
 ["myPOS",/\bmypos\b/i],
 ["Stripe",/\bstripe\b/i],
 ["Adyen",/\badyen\b/i],
 ["Testpay",/\btest\s*pay\b/i]
] as const;
const definite=(values:{value:number;line:string}[])=>{
 const unique=[...new Set(values.map(v=>v.value))];
 return unique.length===1?{value:unique[0],line:values.find(v=>v.value===unique[0])!.line}:null;
};
/** Extract explicitly labelled fields only. This is not a promise that OCR text is correct. */
export function analyzeStatementText(raw:string):StatementAnalysis{
 const lines=raw.split(/\r?\n/).map(v=>v.replace(/\s+/g," ").trim()).filter(Boolean);
 const details:StatementDetails={},evidence:Record<string,string>={},warnings:string[]=[];
 const values=recognizedStatementValues(raw);
 const prov=providerNames.filter(([,pattern])=>lines.slice(0,25).some(line=>pattern.test(line)));
 const explicit=lines.filter(line=>/^(?:zahlungs(?:dienst)?anbieter|payment provider|anbieter|abrechnung\s+von|acquirer)\s*[:：]/i.test(line));
 const named=explicit.map(line=>cleanLabel(line.replace(/^[^:：]+[:：]/,""))).filter(Boolean);
 if(prov.length===1){details.provider=prov[0][0];evidence.provider=explicit[0]||"Anbietername in Abrechnung: "+prov[0][0];}
 else if(prov.length>1)warnings.push("Mehrere Zahlungsanbieter im Text – Anbieter bitte auswählen.");
 else if(named.length===1&&named[0].length<=90){details.provider=named[0];evidence.provider=explicit[0];}
 const merchant=lines.filter(line=>/^(?:händler(?:name)?|kunde(?:nname)?|merchant(?: name)?|firma|firmenname|unternehmen|geschäft|shop)\s*[:：]/i.test(line));
 if(merchant.length===1){const n=cleanLabel(merchant[0].replace(/^[^:：]+[:：]/,""));if(n.length>=2&&n.length<=100){details.merchant=n;evidence.merchant=merchant[0];}}
 const collectors:Record<string,{value:number;line:string}[]>={};
 const add=(field:keyof StatementDetails,value:number,line:string)=>{
  (collectors[field]??=[]).push({value,line});
 };
 for(let i=0;i<lines.length;i++){
  const line=lines[i],next=lines[i+1]||"";
  const normalized=line.toLocaleLowerCase("de-DE");
  const shares= findPercent(line);
  const amounts=findMoney(line);
  const labelAmount=(rx:RegExp)=>{
   const m=rx.exec(line);
   if(!m)return null;
   const after=line.slice(m.index+m[0].length);
   const a=findMoney(after).filter(x=>x!==0||/0[,\. ]?00/.test(after));
   return a.length===1?a[0]:null;
  };
  if(/(?:ec|girocard|debit)(?:\s*[-/]\s*(?:karte|card|umsatz|anteil))?\s*(?:[-/]\s*(?:ec|debit))?\s*(?:anteil|kartenmix|umsatzanteil)?/i.test(line)&&
     !/kredit|credit|premium|corporate|international/i.test(line)){
   if(/(?:anteil|kartenmix)/i.test(line)||/^(?:ec\\s*\\/\\s*debit|ec|debit|girocard)\\s+\\d/i.test(line))if(shares.length===1&&!/(?:gebühr|entgelt|satz|rate|msc|disagio|fee)/i.test(line))add("debitShare",shares[0],line);
   if(/(?:gebühr|entgelt|satz|rate|msc|disagio|fee)/i.test(line)&&shares.length===1)add("debitRate",shares[0],line);
  }
  if(/(?:kredit(?:karte)?|credit(?: card)?|premium|corporate)/i.test(line)&&!/debit/i.test(line)){
   if(/(?:gebühr|entgelt|satz|rate|msc|disagio|fee)/i.test(line)&&shares.length===1)add("creditRate",shares[0],line);
  }
  if(/(?:service[- ]?gebühr|servicepauschale|monatliche\s+service|grundgebühr|monatliche\s+grundgebühr)/i.test(line)&&
     !/transaktions|karten|%/.test(normalized)&&amounts.length===1)add("serviceFee",amounts[0],line);
  if(/(?:terminal|hardware|gerät)[- ]?(?:miete|gebühr|preis|pauschale)|monatliche\s+(?:hardware|terminal)/i.test(line)&&
     !/einmalig|kaufpreis|einrichtung/i.test(line)&&amounts.length===1)add("terminalFee",amounts[0],line);
  if(/(?:pro\s+transaktion|je\s+transaktion|transaktions[- ]?(?:stückpreis|fixbetrag|entgelt)|fee\s+per\s+transaction)/i.test(line)&&
     !/%/.test(line)&&amounts.length===1)add("perTransaction",amounts[0],line);
  if(/(?:inländisch|domestic|geeignet(?:e|en))\s*(?:karten|debit|credit)?\s*(?:umsatz|volumen|betrag)?/i.test(line)&&
     !/%|gebühr|satz|rate|fee/i.test(line)&&amounts.length===1)add("eligibleVolume",amounts[0],line);
  if(/(?:sonstige|andere|nicht\s+geeignete)\s*karten\s*(?:umsatz|volumen|betrag)?/i.test(line)&&
     !/%|gebühr|satz|rate|fee/i.test(line)&&amounts.length===1)add("otherVolume",amounts[0],line);
  // Support an OCR table with a label on one line and its value immediately below.
  const solo=findPercent(next);
  if(/^(?:ec\s*\/\s*debit|ec|debit|girocard)\s*(?:gebühr|entgelt|satz|rate)$/i.test(line)&&solo.length===1)add("debitRate",solo[0],line+" → "+next);
  if(/^(?:kredit|kreditkarte|credit|premium)\s*(?:gebühr|entgelt|satz|rate)$/i.test(line)&&solo.length===1)add("creditRate",solo[0],line+" → "+next);
  if(/^(?:ec\s*\/\s*debit|ec|debit|girocard)\s*(?:anteil|kartenmix)$/i.test(line)&&solo.length===1)add("debitShare",solo[0],line+" → "+next);
  // Explicit fee percentages on lines like "EC / Debit 80 % · 0,99 %" and corresponding credit.
  if(/ec|debit|girocard/i.test(line)&&!/(?:kredit|credit)/i.test(line)&&shares.length===2){
   add("debitShare",shares[0],line);add("debitRate",shares[1],line);
  }
  if(/kredit|credit|premium/i.test(line)&&!/(?:debit)/i.test(line)&&shares.length===2){
   add("creditRate",shares[1],line);
  }
 }
 for(const key of Object.keys(collectors) as (keyof StatementDetails)[]){
  const candidate=definite(collectors[key]);
  if(candidate){(details as Record<string,number|string>)[key]=candidate.value;evidence[key]=candidate.line;}
  else if(collectors[key].length)warnings.push("Mehrdeutige Angaben zu "+key+" – bitte manuell prüfen.");
 }
 const recognized=extractStatement(raw);
 for(const [key,cands] of Object.entries(recognized)){
  if(cands.length===1)evidence[key]=cands[0].evidence;
  else if(cands.length>1)warnings.push("Mehrere mögliche Werte für "+key+" – bitte prüfen.");
 }
 return {values,details,evidence,warnings};
}
