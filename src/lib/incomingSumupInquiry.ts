import type { Customer, Event } from "./types";

export type IncomingSumupInquiry = {
 volume: number | null;
 provider: string;
 submittedAt: string;
 source: "customer" | "event";
};
/** Parse only explicitly supplied values. Never infer competitor fees or card mix from a contact form. */
export function incomingSumupInquiry(customer: Customer, events: Event[]): IncomingSumupInquiry | null {
 const recent = events.filter(e=>e.customer_id===customer.id&&e.kind==="Formularanfrage"&&
  e.description.includes("SumUp Gebührencheck")).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
 const notesMatch = customer.source==="SumUp Gebührencheck" && customer.notes.includes("Angefragter SumUp-Gebührencheck");
 const useEvent = !!recent&&(!notesMatch||recent.created_at>customer.created_at);
 const text = useEvent ? recent.description : notesMatch ? customer.notes : "";
 if(!text)return null;
 const amount=text.match(/Monatlicher Kartenumsatz laut Interessent:\s*([^\n]+)/)?.[1]?.trim()||"";
 const n=Number(amount);
 const volume=/^\d{1,9}(?:\.\d{1,2})?$/.test(amount)&&Number.isFinite(n)&&n>0&&n<=100000000?n:null;
 const raw=text.match(/Bisheriger Zahlungsanbieter:\s*([^\n]+)/)?.[1]?.trim()||"";
 return {
  volume,provider:raw==="nicht angegeben"?"":raw.slice(0,100),
  submittedAt:useEvent?recent.created_at:customer.created_at,
  source:useEvent?"event":"customer"
 };
}
