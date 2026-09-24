import {useEffect,useState} from "react";
import {client} from "../lib/client";
import {useStore} from "../lib/store";

export type InboundStatement={receipt_id:string;customer_id:string;storage_path:string;original_name:string;mime:string;size_bytes:number;uploaded_at:string;reviewed_at:string|null};
export function useInboundStatements(customerId:string,demo=false){
 const [items,setItems]=useState<InboundStatement[]>([]);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;setItems([]);setError("");
  if(!customerId||demo)return()=>{active=false};
  void client.from("nx_inbound_statements").select("*").eq("customer_id",customerId)
   .order("uploaded_at",{ascending:false}).limit(25)
   .then(({data,error})=>{
    if(!active)return;
    if(error)setError("Abrechnungsstatus derzeit nicht erreichbar. Bitte neu laden.");
    else setItems((data||[]) as InboundStatement[]);
   });
  return()=>{active=false};
 },[customerId,demo]);
 return {items,error};
}
export function InboundStatementPanel({customerId,demo,onOpenSumup}:{
 customerId:string;demo:boolean;onOpenSumup?:(customerId:string)=>void;
}){
 const {items,error}=useInboundStatements(customerId,demo);
 const {downloadDocument}=useStore();
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function open(path:string,mime:string){
  setBusy(true);setNotice("");
  try{
   const blob=await downloadDocument(customerId,path);
   const url=URL.createObjectURL(blob);
   const tab=window.open(url,"_blank","noopener,noreferrer");
   if(!tab){
    const a=document.createElement("a");a.href=url;a.download=path.split("/").pop()||"Abrechnung";
    a.click();
   }
   setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch{setNotice("Datei konnte nicht geöffnet werden. Bitte Verbindung prüfen.")}
  finally{setBusy(false)}
 }
 return <section className="nx-inbound-statement-card" aria-label="Optionale Händlerabrechnung">
  <h3>📄 Angebotsvorbereitung · Händlerabrechnung</h3>
  {items.length?<>
   <span className="nx-statement-status">✓ Abrechnung vorhanden · {items.length} Datei{items.length!==1?"en":""}</span>
   <p>Privat gespeichert. Beträge, Gebühren und Kartentypen vor einer Angebotserstellung prüfen.</p>
   {items.map(file=><div key={file.receipt_id} className="nx-statement-file">
    <strong>{file.original_name}</strong>
    <small>{new Date(file.uploaded_at).toLocaleString("de-DE",{timeZone:"Europe/Berlin"})} · {(file.size_bytes/1048576).toFixed(1)} MB</small>
    <button type="button" className="secondary" disabled={busy} onClick={()=>void open(file.storage_path,file.mime)}>Abrechnung geschützt öffnen</button>
   </div>)}
   {onOpenSumup&&<button className="primary" type="button" onClick={()=>onOpenSumup(customerId)}>Im SumUp-Vertriebsstudio auswerten →</button>}
  </>:<p className="hint">Noch keine Abrechnung aus dem öffentlichen Formular eingegangen. Eine Beratungsanfrage benötigt keine Abrechnung; ein konkreter Ist-Gebührenvergleich wird erst nach Prüfung eines Belegs vorbereitet.</p>}
  {(error||notice)&&<p className="hint" role="status">{error||notice}</p>}
 </section>;
}
