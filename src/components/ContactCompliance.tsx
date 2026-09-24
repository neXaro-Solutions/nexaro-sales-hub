import { useEffect, useState } from "react";
import { client } from "../lib/client";
import type { Customer } from "../lib/types";

type Permission = {
 customer_id:string;request_contact:boolean;request_source:string;request_at:string|null;
 marketing_email:boolean;marketing_verified_at:string|null;marketing_evidence:string;
};
type Blocked={email:string;reason:string;recorded_at:string};
const human=(s:string|null)=>s?new Date(s).toLocaleString("de-DE",{timeZone:"Europe/Berlin"}):"–";
export function CustomerContactPermission({customer,demo}:{customer:Customer;demo:boolean}){
 const [row,setRow]=useState<Permission|null>(null),[blocked,setBlocked]=useState(false);
 const [reason,setReason]=useState("Widerspruch gegen Direktwerbung");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function load(){
  if(demo)return;
  const email=customer.email.trim().toLowerCase();
  const [perm,suppressed]=await Promise.all([
   client.from("nx_contact_permissions").select("*").eq("customer_id",customer.id).maybeSingle(),
   email?client.from("nx_marketing_suppressions").select("email").eq("email",email).maybeSingle():Promise.resolve({data:null,error:null})
  ]);
  if(perm.error||suppressed.error)throw Error("Kontaktfreigabe derzeit nicht verfügbar.");
  setRow(perm.data as Permission|null);
  setBlocked(!!suppressed.data);
 }
 useEffect(()=>{let active=true;(async()=>{try{if(active)await load()}catch(e){if(active)setMessage((e as Error).message)}})();return()=>{active=false}},[customer.id,customer.email,demo]);
 async function suppress(){
  if(!customer.email.trim()||demo||busy)return;
  setBusy(true);setMessage("");
  try{
   const {error}=await client.from("nx_marketing_suppressions").insert({email:customer.email.trim().toLowerCase(),reason:reason.trim()||"Widerspruch"});
   if(error&&error.code!=="23505")throw Error("Werbesperre konnte nicht gespeichert werden.");
   await load();setMessage("Werbesperre für diese E-Mail-Adresse gespeichert.");
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="detail-block" aria-label="Kontaktfreigabe und Werbesperre">
  <h3>🛡️ Kontaktfreigabe</h3>
  <p className="hint">Eine Terminerinnerung oder konkrete Gebührencheck-Anfrage ist keine allgemeine Werbeeinwilligung. Öffentliche Kontaktdaten begründen keine automatische E-Mail-Freigabe.</p>
  <p><strong>Anfragebezogene Kontaktaufnahme:</strong> {row?.request_contact?"Dokumentiert":"Nicht dokumentiert"}</p>
  {row?.request_contact&&<p className="hint">{row.request_source} · {human(row.request_at)}</p>}
  <p><strong>Werbe-E-Mail:</strong> {blocked?"Gesperrt":row?.marketing_email&&row.marketing_verified_at?"Nachweis hinterlegt":"Nicht freigegeben"}</p>
  <p><strong>Widerspruch:</strong> {blocked?"Erfasst":"Keine Sperre für diese Adresse gespeichert"}</p>
  {customer.email&&!blocked&&!demo&&<>
   <label>Grund für die Werbesperre<input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <button className="secondary" disabled={busy} onClick={()=>void suppress()}>Werbesperre eintragen</button>
  </>}
  {message&&<p className={message.includes("konnte")?"error":"notice"} role="status">{message}</p>}
 </section>;
}
export function MarketingSuppressions({demo}:{demo:boolean}){
 const [rows,setRows]=useState<Blocked[]>([]);
 const [email,setEmail]=useState(""),[reason,setReason]=useState("Widerspruch gegen Direktwerbung");
 const [status,setStatus]=useState(""),[busy,setBusy]=useState(false);
 async function refresh(){
  if(demo)return;
  const {data,error}=await client.from("nx_marketing_suppressions").select("email,reason,recorded_at").order("recorded_at",{ascending:false}).limit(500);
  if(error)throw Error("Werbesperrliste konnte nicht geladen werden.");
  setRows((data||[]) as Blocked[]);
 }
 useEffect(()=>{void refresh().catch(e=>setStatus((e as Error).message))},[demo]);
 async function block(){
  if(demo||busy)return;
  const target=email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)){setStatus("Bitte eine gültige E-Mail-Adresse eingeben.");return}
  setBusy(true);setStatus("");
  try{
   const {error}=await client.from("nx_marketing_suppressions").insert({email:target,reason:reason.trim()||"Widerspruch"});
   if(error&&error.code!=="23505")throw Error("Werbesperre konnte nicht angelegt werden.");
   setEmail("");await refresh();setStatus("Werbesperre dokumentiert.");
  }catch(e){setStatus((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="card" style={{padding:20}} aria-label="Zentrale Werbesperrliste">
  <h2>🛡️ HUNTER AUTO · Werbesperrliste</h2>
  <p>Kontaktwidersprüche zentral speichern. Bereits dokumentierte Marketing-Freigaben zu dieser Adresse werden serverseitig entzogen. Die Sperre ist unabhängig von einer einzelnen Kundenakte.</p>
  <div className="form-grid">
   <label>E-Mail-Adresse<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@unternehmen.de" disabled={demo||busy}/></label>
   <label>Grund<input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} disabled={demo||busy}/></label>
  </div>
  <button className="primary" disabled={demo||busy||!email.trim()} onClick={()=>void block()}>Werbesperre speichern</button>
  {status&&<p role="status" className="hint">{status}</p>}
  <p className="hint">{rows.length} gesperrte Adressen geladen. Aufhebung ist absichtlich nicht per Schnellklick möglich.</p>
  {rows.slice(0,20).map(r=><p key={r.email}><strong>{r.email}</strong><small style={{display:"block"}}>{r.reason} · {human(r.recorded_at)}</small></p>)}
  <p className="hint">Aktuell existiert kein automatischer Werbeversand im HUNTER. Die bestehende, separat zugestimmte Terminbestätigung wird hier nicht verändert.</p>
 </section>;
}
