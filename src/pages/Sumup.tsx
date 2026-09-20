import { useState } from "react";
import { StatementCapture, type StatementReview } from "../components/StatementCapture";
import { Field, DivisionBadge } from "../components/UI";
import { useStore } from "../lib/store";
import type { PaymentInput } from "../lib/calculations";
import { SalesStudio } from "./SalesStudio";
import { OfferForm, type OfferDraft } from "./Offers";

const emptyStatement: PaymentInput = {
  volume: 0, onlineVolume: 0, transactions: 0, eligibleShare: 80,
  freeShare: 0, currentRate: 0, currentFixed: 0,
  currentPerTransaction: 0, hardware: 0, targetVolume: 0,
};
export function Sumup() {
  const { data } = useStore();
  const [customer,setCustomer] = useState("");
  const [capture,setCapture] = useState(false);
  const [photoInput,setPhotoInput] = useState<PaymentInput>(emptyStatement);
  const [photoReview,setPhotoReview] = useState<StatementReview|null>(null);
  const [draft,setDraft] = useState<OfferDraft|null>(null);
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
        }}>
          <option value="">Ohne Kundenakte beraten · zum Speichern Kunde auswählen</option>
          {[...data.customers].sort((a,b)=>a.company.localeCompare(b.company,"de"))
            .map(c=><option key={c.id} value={c.id}>{c.company}</option>)}
        </select>
      </Field>
    </div>
    <SalesStudio key={customer||"ohne-kunde"} customerId={customer}
      photoInput={photoInput} photoReview={photoReview}
      photoAvailable={!!photoReview} onCapture={()=>setCapture(true)}
      onOffer={setDraft}/>
    {capture&&<StatementCapture onClose={()=>setCapture(false)}
      onApply={(values,review)=>{
        setPhotoInput(old=>({...old,...values}));
        setPhotoReview(review);
        setCapture(false);
      }}/>}
    {draft&&<OfferForm draft={draft} onClose={()=>setDraft(null)}/>}
  </>;
}
