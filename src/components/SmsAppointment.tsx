import { useEffect, useState } from "react";
import { client } from "../lib/client";
import type { Task } from "../lib/types";

type SmsState = {task_id:string;enabled:boolean;status:string;sent_at:string|null;request_note:string;failure_reason:string|null;confirmed_at:string|null};
const names:Record<string,string>={planned:"SMS geplant",sending:"SMS wird versendet",sent:"SMS versendet · Rückmeldung offen",confirmed:"Termin bestätigt",reschedule_requested:"Verschiebung angefragt",failed:"SMS-Fehler"};
export function SmsAppointment({task,demo}:{task:Task;demo:boolean}){
 const [row,setRow]=useState<SmsState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[ready,setReady]=useState(false);
 useEffect(()=>{
  let active=true;
  async function load(){
   if(demo){setReady(true);return}
   const result=await client.from("nx_sms_appointments").select("task_id,enabled,status,sent_at,request_note,failure_reason,confirmed_at").eq("task_id",task.id).maybeSingle();
   if(!active)return;
   if(result.error)setError("SMS-Status konnte nicht geladen werden.");else setRow(result.data);
   setReady(true);
  }
  void load();const timer=setInterval(()=>void load(),60000);
  return()=>{active=false;clearInterval(timer)};
 },[task.id,demo]);
 async function toggle(enabled:boolean){
  setBusy(true);setError("");
  if(demo){setRow(x=>({...x,task_id:task.id,enabled,status:x?.status||"planned",sent_at:null,request_note:"",failure_reason:null,confirmed_at:null}));setBusy(false);return}
  const result=await client.from("nx_sms_appointments").upsert({task_id:task.id,enabled},{onConflict:"task_id"}).select("task_id,enabled,status,sent_at,request_note,failure_reason,confirmed_at").single();
  if(result.error)setError("SMS-Freigabe konnte nicht gespeichert werden.");else setRow(result.data);
  setBusy(false);
 }
 return <section className="nx-sms-panel" aria-label="SMS-Terminbestätigung" style={{border:"1px solid #d9e4d6",borderRadius:14,padding:16,marginTop:16,background:"#f8fbf6"}}>
  <strong>📲 SMS-Terminbestätigung · 07:30 Uhr</strong>
  <p className="hint">Am Termintag, nur für Termine mit Kunde und gültiger Mobilnummer. Auch frühe Termine werden ausschließlich um 07:30 Uhr berücksichtigt; bereits vergangene Termine erhalten keine SMS.</p>
  <label style={{display:"flex",gap:10,alignItems:"flex-start",margin:"12px 0"}}>
   <input type="checkbox" checked={!!row?.enabled} disabled={!ready||busy} onChange={e=>void toggle(e.target.checked)} style={{width:19,height:19,flexShrink:0}}/>
   <span>Kunde hat Termin-SMS ausdrücklich zugestimmt. Automatische Bestätigung für diesen Termin aktivieren.</span>
  </label>
  <p role="status"><strong>Status: {!row?.enabled?"Nicht für SMS freigegeben":names[row?.status||"planned"]||"Noch nicht eingerichtet"}</strong></p>
  {row?.request_note&&row.status==="reschedule_requested"&&<p className="notice">📅 {row.request_note}<br/>Bitte mit dem Kunden abstimmen und anschließend den Termin im CRM bearbeiten. Der ursprüngliche Termin wird nicht automatisch überschrieben.</p>}
  {row?.failure_reason&&row.status==="failed"&&<p className="error" role="alert">{row.failure_reason}</p>}
  {row?.sent_at&&<small>Versand an Twilio: {new Date(row.sent_at).toLocaleString("de-DE",{timeZone:"Europe/Berlin"})}</small>}
  {error&&<p className="error" role="alert">{error}</p>}
  <p className="hint">Twilio-Zugang und Versand müssen einmalig serverseitig eingerichtet werden. Das Aktivieren hier löst keinen sofortigen Versand aus.</p>
 </section>;
}
