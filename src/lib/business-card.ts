export type BusinessCardFields = {
 company?:string; contact?:string; jobTitle?:string; email?:string;
 phone?:string; mobile?:string; street?:string; zip?:string; city?:string; website?:string;
};
export type BusinessCardRead = {fields:BusinessCardFields; warnings:string[]; evidence:Partial<Record<keyof BusinessCardFields,string>>};
const tidy=(s:string)=>s.replace(/^[\s:;|·–-]+|[\s:;|·–-]+$/g,"").replace(/\s+/g," ").trim();
const folded=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
const role=/\b(?:außendienst|aussendienst|vertrieb|sales|marketing|geschäftsführung|geschaeftsfuehrung|geschäftsführer|geschaeftsfuehrer|inhaber|customer\s+success|management|beratung|consultant|account\s+manager)\b/i;
const slogan=/\b(?:ideen|bewegen|märkte|maerkte|lösungen\s+für|loesungen\s+fuer|starke\s+zukunft|menschen|erfolg|einfach|sicher|zahlungen)\b/i;
const fieldLine=/^(?:telefon|tel\.?|fon|phone|mobil|mobile|handy|fax|e-?mail|mail|web|website|www|http|straße|str\.?|plz|postcode|ort|stadt|city|company|unternehmen|firma|ansprechpartner|contact)\s*[:：\s]/i;
const companyWords=/(?:solutions?|gmbh|ug|gbr|kg|ohg|studio|agentur|café|cafe|restaurant|services?|handel|shop|store|beratung|consulting|gastronomie|bäckerei|baeckerei)/i;
const isAddress=(s:string)=>/^[\p{L}\p{M}][\p{L}\p{M}\s.'-]{2,85}\s+\d{1,4}\s*[a-z]?$/iu.test(s);
const isPerson=(s:string)=>{
 const words=s.split(/\s+/);
 return words.length>=2&&words.length<=4&&!companyWords.test(s)&&!role.test(s)&&!slogan.test(s)&&
  words.every(w=>/^[\p{Lu}][\p{L}\p{M}'-]+$/u.test(w))&&
  !/\d|@|www\.|https?:/i.test(s);
};
const onlyDigits=(s:string)=>s.replace(/\D/g,"");
function extractNumber(s:string):string|undefined{
 const raw=s.replace(/^(?:telefon|tel\.?|fon|phone|mobil|mobile|handy|fax)\s*[:：-]?\s*/i,"");
 const match=raw.match(/(?:\+\s*\d{1,3}|0\d{2,5})(?:[\s/().-]*\d){6,15}/);
 if(!match)return undefined;
 const n=tidy(match[0]).replace(/[\s\-./()]+$/,"");
 const length=onlyDigits(n).length;
 return length>=8&&length<=17?n:undefined;
}
export function readBusinessCardText(raw:string):BusinessCardRead{
 // Dedupe repeated lines: the card OCR may scan the full image and its header separately.
 const lines=[...new Set(raw.split(/\r?\n/).map(tidy).filter(Boolean))].slice(0,90);
 const fields:BusinessCardFields={},warnings:string[]=[],evidence:BusinessCardRead["evidence"]={};
 const put=(key:keyof BusinessCardFields,val:string|undefined,source:string)=>{
  const value=val&&tidy(val);
  if(value){fields[key]=value;evidence[key]=source;}
 };
 const labelled=(rx:RegExp)=>lines.map(line=>({line,value:line.match(rx)?.[1]})).filter((x):x is {line:string;value:string}=>!!x.value);
 const companies=labelled(/^(?:unternehmen|firma|firmenname|company|geschäft|händler)\s*[:：]\s*(.+)$/i);
 if(companies.length===1)put("company",companies[0].value,companies[0].line);
 const persons=labelled(/^(?:ansprechpartner(?:in)?|kontaktperson|contact|inhaber(?:in)?|geschäftsführer(?:in)?)\s*[:：]\s*(.+)$/i);
 if(persons.length===1)put("contact",persons[0].value,persons[0].line);
 const emails=[...new Set([...raw.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)].map(m=>m[0].toLowerCase()))];
 if(emails.length===1)put("email",emails[0],lines.find(line=>line.toLowerCase().includes(emails[0]))||emails[0]);
 if(emails.length>1)warnings.push("Mehrere E-Mail-Adressen erkannt – geschäftliche Adresse bitte auswählen.");
 const street=lines.find(isAddress);
 if(street)put("street",street,street);
 const zipRow=lines.map(line=>({line,match:line.match(/(?:^|[,\s])(\d{5})\s+([\p{L}\p{M}][\p{L}\p{M}\s.'-]{1,65})$/u)})).find(x=>x.match);
 if(zipRow?.match){put("zip",zipRow.match[1],zipRow.line);put("city",zipRow.match[2],zipRow.line);}
 if(!fields.zip){const z=labelled(/^(?:plz|postcode)\s*[:：]\s*(\d{5})$/i);if(z.length===1)put("zip",z[0].value,z[0].line);}
 if(!fields.city){const city=labelled(/^(?:ort|stadt|city)\s*[:：]\s*(.+)$/i);if(city.length===1)put("city",city[0].value,city[0].line);}
 // Recognize two numbers independently. An unlabeled number is not guessed to be mobile.
 const phoneRx=/^(?:telefon|tel\.?|fon|phone)\s*[:：-]?\s*(.*)$/i;
 const mobileRx=/^(?:mobil|mobile|handy)\s*[:：-]?\s*(.*)$/i;
 for(let i=0;i<lines.length;i++){
  const line=lines[i], tel=line.match(phoneRx),mob=line.match(mobileRx);
  const next=lines[i+1]||"";
  if(tel&&!fields.phone)put("phone",extractNumber(tel[1]||next),tel[1]?line:line+" → "+next);
  if(mob&&!fields.mobile)put("mobile",extractNumber(mob[1]||next),mob[1]?line:line+" → "+next);
 }
 if(!fields.phone){
  const lone=lines.filter(l=>!/(?:fax|iban|ust[-\s]?id|steuer|rechnung)/i.test(l))
   .map(l=>({line:l,val:extractNumber(l)})).filter(x=>!!x.val);
  if(lone.length===1)put("phone",lone[0].val,lone[0].line);
 }
 const siteRows=lines.filter(line=>/^(?:web(?:seite|site)?|homepage)\s*[:：]/i.test(line));
 const urls=[...new Set([...raw.matchAll(/(?:https?:\/\/|www\.)[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi)].map(m=>m[0]))]
  .filter(s=>!emails.some(e=>e.endsWith(s)));
 if(urls.length===1)put("website",urls[0],siteRows[0]||urls[0]);
 // Job titles are NOT company names. The line before the address is typically
 // the person's role. Prefer a company-specific headline above the person's name.
 const roleRows=lines.filter(l=>role.test(l)&&!/^.+@/.test(l)&&l.length<=90);
 if(roleRows.length===1)put("jobTitle",roleRows[0],roleRows[0]);
 if(!fields.contact){
  const streetIndex=street?lines.indexOf(street):lines.length;
  const nameCandidates=lines.slice(0,Math.min(streetIndex,24)).filter(l=>isPerson(l)&&!fieldLine.test(l));
  if(nameCandidates.length===1)put("contact",nameCandidates[0],nameCandidates[0]);
  else if(nameCandidates.length>1){
   const beforeRole=nameCandidates.filter(n=>roleRows.some(roleLine=>lines.indexOf(n)<lines.indexOf(roleLine)));
   if(beforeRole.length===1)put("contact",beforeRole[0],beforeRole[0]);
  }
 }
 if(!fields.company){
  const contactIndex=fields.contact?lines.findIndex(l=>l===fields.contact):lines.length;
  const upper=lines.slice(0,Math.min(Math.max(contactIndex,0),20));
  const candidates=upper.filter(l=>!role.test(l)&&!slogan.test(l)&&!fieldLine.test(l)&&!isAddress(l)&&
    !/\d{4,}|@|www\.|https?:/i.test(l)&&l.length>=3&&l.length<=90&&!isPerson(l));
  const emailStem=fields.email?.split("@")[1]?.split(".")[0]||"";
  const siteStem=fields.website?.replace(/^https?:\/\//i,"").replace(/^www\./i,"").split(".")[0]||"";
  const stems=[emailStem,siteStem].map(folded).filter(x=>x.length>=5);
  let candidate=candidates.find(l=>stems.some(stem=>stem.includes(folded(l))||folded(l).includes(stem)));
  if(!candidate)candidate=candidates.find(l=>companyWords.test(l));
  if(!candidate&&candidates.length===1)candidate=candidates[0];
  if(candidate)put("company",candidate,candidate);
  // A logo may be returned as two adjacent OCR lines, e.g. "neXaro" / "Solutions".
  if(!candidate)for(let i=0;i<upper.length-1;i++){
   const joined=upper[i]+" "+upper[i+1];
   if(!role.test(joined)&&!slogan.test(joined)&&!fieldLine.test(joined)&&
      companyWords.test(joined)&&stems.some(stem=>stem.includes(folded(joined)))){
    put("company",joined,upper[i]+" → "+upper[i+1]);break;
   }
  }
 }
 // Only correct a single duplicated OCR character in the logo when an independently
 // recognized email or website domain corroborates the brand spelling.
 if(fields.company){
  const rawName=fields.company;
  const first=rawName.split(/\s+/)[0];
  const domain=(fields.website||fields.email?.split("@")[1]||"")
   .replace(/^https?:\/\//i,"").replace(/^www\./i,"").split(".")[0].split("-")[0];
  const token=folded(first),reference=folded(domain);
  if(reference.length>=5&&token.length===reference.length+1){
   const fixes=[...first].map((_,i)=>first.slice(0,i)+first.slice(i+1))
    .filter(part=>folded(part)===reference)
    .sort((a,b)=>Number(/[a-z]$/.test(b))-Number(/[a-z]$/.test(a)));
   if(fixes.length){
    fields.company=fixes[0]+rawName.slice(first.length);
    warnings.push("Firmenlogo anhand der unabhängig erkannten Web-/E-Mail-Domain auf einen möglichen OCR-Buchstabenfehler korrigiert. Schreibweise bitte überprüfen.");
   }
  }
 }
 // Last-resort business letterhead: never promote a position or a person's name.
 if(!fields.company&&street){
  const i=lines.indexOf(street);
  const candidate=lines[i-1]||"";
  if(candidate.length>=3&&!role.test(candidate)&&!isPerson(candidate)&&!fieldLine.test(candidate)&&
    !slogan.test(candidate)&&!/\d{4,}|@|www\./i.test(candidate))
   put("company",candidate,candidate);
 }
 if(!fields.company)warnings.push("Unternehmen nicht sicher erkannt – bitte Firmenlogo oder Firmennamen prüfen. Berufsbezeichnungen werden nicht als Unternehmen übernommen.");
 if(!fields.contact)warnings.push("Ansprechpartner nicht sicher erkannt – bitte ergänzen.");
 if(!fields.phone&&!fields.mobile)warnings.push("Keine eindeutige Telefonnummer erkannt.");
 if(!fields.street||!fields.zip||!fields.city)warnings.push("Adresse nicht vollständig erkannt – bitte prüfen.");
 return {fields,warnings,evidence};
}
