export type BusinessCardFields={
 company?:string;contact?:string;email?:string;phone?:string;street?:string;zip?:string;
 city?:string;website?:string;
};
export function readBusinessCardText(raw:string):{fields:BusinessCardFields;warnings:string[]}{
 const lines=raw.split(/\r?\n/).map(line=>line.replace(/\s+/g," ").trim()).filter(Boolean).slice(0,50);
 const fields:BusinessCardFields={};const warnings:string[]=[];
 const emails=[...new Set((raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[]).map(s=>s.toLowerCase()))];
 if(emails.length===1)fields.email=emails[0];
 if(emails.length>1)warnings.push("Mehrere E-Mail-Adressen: Bitte die geschäftliche E-Mail auswählen.");
 const label=(regex:RegExp)=>lines.map(line=>line.match(regex)?.[1]?.trim()).filter((x):x is string=>!!x);
 const company=label(/^(?:unternehmen|firma|firmenname|company|geschäft|händler)\s*[:：]\s*(.+)$/i);
 const contacts=label(/^(?:ansprechpartner(?:in)?|kontaktperson|contact|inhaber(?:in)?|geschäftsführer(?:in)?)\s*[:：]\s*(.+)$/i);
 if(company.length===1)fields.company=company[0];
 if(contacts.length===1)fields.contact=contacts[0];
 const streetLine=lines.find(line=>/^(?:(?:straße|str\.?|street)\s*[:：]\s*)?[\p{L}][\p{L}\p{M}\s.'-]{2,85}\s+\d{1,4}\s*[a-z]?$/iu.test(line));
 if(streetLine)fields.street=streetLine.replace(/^(?:straße|str\.?|street)\s*[:：]\s*/i,"");
 const zipLine=lines.map(line=>line.match(/(?:^|[,\s])(\d{5})\s+([\p{L}\p{M}][\p{L}\p{M}\s.'-]{1,65})$/u)).find(Boolean);
 if(zipLine){fields.zip=zipLine[1];fields.city=zipLine[2].trim();}
 if(!fields.zip){
  const zip=label(/^(?:plz|postcode)\s*[:：]\s*(\d{5})$/i);
  if(zip.length===1)fields.zip=zip[0];
 }
 if(!fields.city){
  const city=label(/^(?:ort|stadt|city)\s*[:：]\s*(.+)$/i);
  if(city.length===1)fields.city=city[0];
 }
 const numbers=lines.filter(line=>/(?:\+\d{1,3}|0\d{2,5})[\d\s/().-]{5,}/.test(line)&&!/(?:iban|ust|steuer|fax|kundennummer|rechnung)/i.test(line));
 const labeled=numbers.filter(line=>/^(?:tel(?:efon)?|mobil|mobile|handy|phone|fon)\s*[:：]/i.test(line));
 const chosen=labeled.length===1?labeled[0]:numbers.length===1?numbers[0]:null;
 if(chosen){
  const hit=chosen.replace(/^(?:tel(?:efon)?|mobil|mobile|handy|phone|fon)\s*[:：]\s*/i,"").match(/(?:\+\d{1,3}|0\d{2,5})[\d\s/().-]{5,}/);
  if(hit)fields.phone=hit[0].trim();
 }
 const websites=[...new Set((raw.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi)||[])
  .filter(x=>!x.includes("@")&&!emails.some(e=>e.endsWith(x))&&!/^\d/.test(x)))];
 const sites=websites.filter(x=>/^(?:https?:\/\/|www\.)/i.test(x));
 if(sites.length===1)fields.website=sites[0];
 if(!fields.company){
  // Only a clear header immediately above a valid street address qualifies.
  const i=lines.indexOf(streetLine||"");
  if(i>0){
   const candidate=lines[i-1];
   if(candidate.length>=3&&candidate.length<=120&&!/[@\d]{4}|https?:|www\./i.test(candidate))fields.company=candidate;
  }
 }
 if(!fields.company)warnings.push("Unternehmen nicht eindeutig erkannt – bitte ergänzen.");
 if(!fields.contact)warnings.push("Ansprechpartner nicht eindeutig erkannt – bitte ergänzen.");
 if(!fields.street||!fields.zip||!fields.city)warnings.push("Adresse nicht vollständig erkannt – bitte prüfen.");
 return {fields,warnings};
}
