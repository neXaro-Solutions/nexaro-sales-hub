import { useEffect, useState } from "react";
import { client } from "../lib/client";
import { useStore } from "../lib/store";
import type { Task } from "../lib/types";
import { TaskForm } from "./Forms";

type SmsRow={task_id:string;status:string;request_note:string;enabled:boolean};
export function SmsRequests(){
 const {data,demo}=useStore();
 const [rows,setRows]=useState<SmsRow[]>([]),[edit,setEdit]=useState<Task|null>(null);
 useEffect(()=>{
  if(demo)return;
  let active=true;
  async function fetchRows(){
   const {data:result}=await client.from("nx_sms_appointments").select("task_id,status,request_note,enabled").in("status",["reschedule_requested","confirmed","sent","failed"]);
   if(active)setRows(result||[]);
  }
  void fetchRows();const interval=setInterval(()=>void fetchRows(),30000);
  return()=>{active=false;clearInterval(interval)};
 },[demo]);
 const requests=rows.filter(r=>r.status==="reschedule_requested");
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const todays=data.tasks.filter(t=>t.kind==="Termin"&&new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(t.due_at))===today);
 if(!requests.length&&!todays.length)return null;
 const name=(t:Task)=>data.customers.find(c=>c.id===t.customer_id)?.company||"Ohne Kunden";
 return <section className="card" style={{padding:20,margin:"20px 0",border:"1px solid #d7e7cb",borderRadius:16,background:"#fff"}}>
  <h2>✉️ E-Mail-Terminbestätigungen</h2>
  {requests.length>0&&<p role="status"><strong>{requests.length} Verschiebungsanfrage(n)</strong> – bitte persönlich mit den Kunden vereinbaren.</p>}
  {requests.map(r=>{const t=data.tasks.find(x=>x.id===r.task_id);return t?<div key={r.task_id} style={{padding:12,borderBottom:"1px solid #e1e8db"}}>
    <strong>📅 {name(t)} · {t.title}</strong><p>{r.request_note}</p>
    <button className="secondary" onClick={()=>setEdit(t)}>Termin bearbeiten</button>
   </div>:null})}
  {todays.map(t=>{const r=rows.find(x=>x.task_id===t.id);return <div key={t.id} style={{padding:12,borderBottom:"1px solid #e1e8db"}}>
   <strong>{name(t)}</strong> · {new Date(t.due_at).toLocaleTimeString("de-DE",{timeZone:"Europe/Berlin",hour:"2-digit",minute:"2-digit"})} Uhr
   <p className="hint">{r?.status==="confirmed"?"✓ Bestätigt":r?.status==="reschedule_requested"?"↻ Verschiebung angefragt":r?.status==="sent"?"E-Mail versendet – Antwort offen":r?.status==="failed"?"E-Mail-Versand fehlgeschlagen":r?.enabled?"E-Mail für Vortag 12:00 Uhr vorgemerkt":"E-Mail nicht freigegeben"}</p>
   <button className="secondary" onClick={()=>setEdit(t)}>Termin öffnen</button>
  </div>})}
  {edit&&<TaskForm task={edit} onClose={()=>setEdit(null)}/>}
 </section>;
}
