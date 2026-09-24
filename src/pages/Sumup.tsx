import { useEffect, useRef, useState } from "react";
import { StatementCapture, type StatementReview } from "../components/StatementCapture";
import { Field, DivisionBadge } from "../components/UI";
import { useStore } from "../lib/store";
import type { PaymentInput } from "../lib/calculations";
import { SalesStudio } from "./SalesStudio";
import { OfferForm, type OfferDraft } from "./Offers";
import { DocumentPreview } from "../components/BusinessDocuments";
import type { Offer } from "../lib/types";
import { useInboundStatements } from "../components/InboundStatementPanel";
import { recognizeStatement } from "../lib/ocr";
import { analyzeStatementText } from "../lib/statement-details";

const emptyStatement: PaymentInput = {
  volume: 0, onlineVolume: 0, transactions: 0, eligibleShare: 80,
  freeShare: 0, currentRate: 0, currentFixed: 0,
  currentPerTransaction: 0, hardware: 0, targetVolume: 0,
};
export function Sumup({initialCustomerId=""}:{initialCustomerId?:string}) {
  const { data,downloadDocument,demo } = useStore();
  const [customer,setCustomer] = useState(initialCustomerId);
  const [step,setStep] = useState<1|2|3>(1);
  const [capture,setCapture] = useState(false);
  const [initialFile,setInitialFile]=useState<File|null>(null);
  const [loadingStatement,setLoadingStatement]=useState(false);
  const [statementProgress,setStatementProgress]=useState(0);
  const statementJob=useRef<AbortController|null>(null);
  const jumpToReview=useRef(false);
  useEffect(()=>()=>statementJob.current?.abort(),[]);
  useEffect(()=>{
    if(step!==2||!jumpToReview.current)return;
    jumpToReview.current=false;
    const frame=requestAnimationFrame(()=>document.getElementById("nx-sumup-studio")?.scrollIntoView({block:"start",behavior:"smooth"}));
    return()=>cancelAnimationFrame(frame);
  },[step]);
  const [statementNotice,setStatementNotice]=useState("");
  const [photoInput,setPhotoInput] = useState<PaymentInput>(emptyStatement);
  const [photoReview,setPhotoReview] = useState<StatementReview|null>(null);
  const [draft,setDraft] = useState<OfferDraft|null>(null);
  const [preview,setPreview] = useState<Offer|null>(null);
  const chosen=data.customers.find(c=>c.id===customer);
  const {items:incomingStatements,error:statementError}=useInboundStatements(customer,demo);
  async function inspectStatement(path:string,name:string,mime:string){
    statementJob.current?.abort();
    const job=new AbortController();
    statementJob.current=job;
    setLoadingStatement(true);setStatementProgress(0);setStatementNotice("");
    try{
      const blob=await downloadDocument(customer,path);
      if(job.signal.aborted)return;
      // The document has already been saved privately. Open the data-review step
      // immediately; OCR is an enhancement, not a second compulsory upload.
      setPhotoReview(null);
      setPhotoInput(emptyStatement);
      jumpToReview.current=true;
      setStep(2);
      if(mime==="application/pdf"){
        setStatementNotice("PDF-Abrechnung liegt geschützt in der Kundenakte. Bitte dort öffnen und die Ist-Werte hier manuell ergänzen. Die automatische Fotoerkennung unterstützt JPG, PNG und WebP.");
        return;
      }
      setStatementNotice("Gespeicherte Abrechnung wird automatisch eingelesen. Bitte warten …");
      const file=new File([blob],name,{type:mime});
      const recognized=await recognizeStatement(file,job.signal,value=>{
        if(!job.signal.aborted)setStatementProgress(value);
      },"statement");
      if(job.signal.aborted)return;
      const parsed=analyzeStatementText(recognized.text);
      const details=parsed.details;
      setPhotoInput({...emptyStatement,...parsed.values});
      setPhotoReview({
        confirmedAt:new Date().toISOString(),months:1,source:"photo",
        confidence:recognized.confidence,verified:false,
        recognizedFields:[...Object.keys(parsed.values),...Object.keys(details)],
        details,evidence:parsed.evidence,warnings:parsed.warnings,
        ocrText:recognized.text,eligibleVolume:details.eligibleVolume,
        otherVolume:details.otherVolume
      });
      setStatementNotice("Abrechnung eingelesen. Bitte die Werte in Schritt 2 anhand des Belegs prüfen.");
    }catch(e){
      if(!job.signal.aborted){
        setStep(2);
        setStatementNotice("Schritt 2 ist geöffnet. Die automatische Erkennung war nicht erfolgreich: "+(e instanceof Error?e.message:"Unbekannter Fehler")+". Du kannst die Werte manuell eintragen oder die gespeicherte Abrechnung später erneut einlesen – ohne sie hochzuladen.");
      }
    }finally{
      if(statementJob.current===job){
        statementJob.current=null;
        setLoadingStatement(false);
      }
    }
  }
  return <>
    <div className="section-intro">
      <div><DivisionBadge division="sumup"/><h1>SumUp Vertrieb</h1>
        <p>Ein klarer Ablauf für das Händlergespräch – ohne zusätzliche Analyse-Ansicht.</p></div>
    </div>
    <div className="card">
      <Field label="Kundenakte für das Vertriebsstudio">
        <select value={customer} onChange={event=>{
          statementJob.current?.abort();setLoadingStatement(false);setStatementNotice("");
          setCustomer(event.target.value);
          setPhotoInput(emptyStatement);
          setPhotoReview(null);
          setStep(1);setInitialFile(null);
        }}>
          <option value="">Ohne Kundenakte beraten · zum Speichern Kunde auswählen</option>
          {[...data.customers].sort((a,b)=>a.company.localeCompare(b.company,"de"))
            .map(c=><option key={c.id} value={c.id}>{c.company}</option>)}
        </select>
      </Field>
    </div>
    {chosen&&<div className="card" style={{padding:18,marginBottom:15,border:"1px solid #d0e5b0",background:"#fbfff5"}}>
      <strong>📄 Abrechnungen aus der Kundenanfrage</strong>
      {incomingStatements.length?<>
        <p className="hint">Die Datei wurde vom Interessenten freiwillig eingereicht. In die vorhandene Belegauswertung laden und erkannte Beträge vor dem Angebot prüfen.</p>
        {incomingStatements.map(file=><button key={file.receipt_id} type="button" className="primary"
          disabled={loadingStatement} onClick={()=>void inspectStatement(file.storage_path,file.original_name,file.mime)}>
          {loadingStatement?"Abrechnung wird geladen …":file.mime==="application/pdf"?"PDF-Abrechnung prüfen · "+file.original_name:"Abrechnung einlesen · "+file.original_name}
        </button>)}
      </>:<p className="hint">Keine Abrechnung aus dem Anfrageformular vorhanden. Für einen belastbaren Ist-Gebührenvergleich bitte eine Händlerabrechnung beim Kunden anfordern oder im Studio selbst fotografieren.</p>}
      {loadingStatement&&<p role="status" className="notice">Texterkennung läuft {statementProgress?statementProgress+" %":"…"} · Schritt 2 ist bereits geöffnet.</p>}
      {(statementNotice||statementError)&&<p role="status" className="hint">{statementNotice||statementError}</p>}
      {step===2&&<button type="button" className="secondary" onClick={()=>document.getElementById("nx-sumup-studio")?.scrollIntoView({block:"start",behavior:"smooth"})}>Zu Schritt 2 · Ist-Bestand ↓</button>}
    </div>}
    <div id="nx-sumup-studio" style={{scrollMarginTop:16}}><SalesStudio key={customer||"ohne-kunde"} customerId={customer} inquiry={null}
      step={step} setStep={setStep}
      photoInput={photoInput} photoReview={photoReview}
      photoAvailable={!!photoReview} onCapture={()=>{setInitialFile(null);setCapture(true)}}
      onOffer={setDraft}/></div>
    {capture&&<StatementCapture autoApply initialFile={initialFile} onClose={()=>{setCapture(false);setInitialFile(null)}}
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
