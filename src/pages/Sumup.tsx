import { useState } from "react";
import { StatementCapture, type StatementReview } from "../components/StatementCapture";
import { Field, DivisionBadge } from "../components/UI";
import { useStore } from "../lib/store";
import type { PaymentInput } from "../lib/calculations";
import { SalesStudio } from "./SalesStudio";
import { OfferForm, type OfferDraft } from "./Offers";
import { DocumentPreview } from "../components/BusinessDocuments";
import type { Offer } from "../lib/types";
import { incomingSumupInquiry } from "../lib/incomingSumupInquiry";

const emptyStatement: PaymentInput = {
  volume: 0, onlineVolume: 0, transactions: 0, eligibleShare: 80,
  freeShare: 0, currentRate: 0, currentFixed: 0,
  currentPerTransaction: 0, hardware: 0, targetVolume: 0,
};
export function Sumup({initialCustomerId=""}:{initialCustomerId?:string}) {
  const { data } = useStore();
  const [customer,setCustomer] = useState(initialCustomerId);
  const [step,setStep] = useState<1|2|3>(initialCustomerId?2:1);
  const [capture,setCapture] = useState(false);
  const [photoInput,setPhotoInput] = useState<PaymentInput>(emptyStatement);
  const [photoReview,setPhotoReview] = useState<StatementReview|null>(null);
  const [draft,setDraft] = useState<OfferDraft|null>(null);
  const [preview,setPreview] = useState<Offer|null>(null);
  const chosen=data.customers.find(c=>c.id===customer);
  const incoming=chosen?incomingSumupInquiry(chosen,data.events):null;
  return <>
    <div className="section-intro">
      <div><DivisionBadge division="sumup"/><h1>SumUp Vertrieb</h1>
        <p>Ein klarer Ablauf für das Händlergespräch – ohne zusätzliche Analyse-Ansicht.</p></div>
    </div>
    <div className="card">
      <Field label="Kundenakte für das Vertriebsstudio">
        <select value={customer} onChange={event=>{
          setCustomer(event.target.value);
          setPhotoInput(emptyStatement);
          setPhotoReview(null);
          setStep(1);
        }}>
          <option value="">Ohne Kundenakte beraten · zum Speichern Kunde auswählen</option>
          {[...data.customers].sort((a,b)=>a.company.localeCompare(b.company,"de"))
            .map(c=><option key={c.id} value={c.id}>{c.company}</option>)}
        </select>
      </Field>
    </div>
    {incoming&&<div className="card" style={{padding:18,border:"1px solid #efc09a",background:"#fffaf4",marginBottom:15}}><strong>📨 SumUp-Gebührencheck aus dem Anfrageformular</strong><p className="hint">Kundenakte ausgewählt. Gemeldeter Kartenumsatz und bisheriger Anbieter werden ins Vertriebsstudio übernommen, soweit dort keine bereits gespeicherten Werte vorliegen. Kartenmix und Ist-Gebühren bleiben ungeprüft und müssen erfragt oder anhand einer Abrechnung bestätigt werden.</p><p><b>Kartenumsatz:</b> {incoming.volume!==null?incoming.volume.toLocaleString("de-DE",{style:"currency",currency:"EUR"})+" monatlich":"Nicht angegeben"} · <b>Anbieter:</b> {incoming.provider||"Nicht angegeben"}</p><button className="secondary" type="button" onClick={()=>setStep(2)}>Angaben im Ist-Bestand prüfen</button></div>}
    <SalesStudio key={customer||"ohne-kunde"} customerId={customer} inquiry={incoming}
      step={step} setStep={setStep}
      photoInput={photoInput} photoReview={photoReview}
      photoAvailable={!!photoReview} onCapture={()=>setCapture(true)}
      onOffer={setDraft}/>
    {capture&&<StatementCapture autoApply onClose={()=>setCapture(false)}
      onApply={(values,review)=>{
        setPhotoInput({...emptyStatement,...values});
        setPhotoReview(review);
        setStep(2);
        setCapture(false);
      }}/>}
    {draft&&<OfferForm draft={draft} onClose={()=>setDraft(null)} onSaved={saved=>setPreview(saved)}/>}
    {preview&&<DocumentPreview document={preview} onClose={()=>setPreview(null)}/>}
  </>;
}
