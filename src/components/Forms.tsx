import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, CalendarPlus } from "lucide-react";
import { recognizeStatement } from "../lib/ocr";
import { readBusinessCardText } from "../lib/business-card";
import { GeoCustomerCapture,type GeoCustomerDraft } from "./GeoCustomerCapture";
import { useStore } from "../lib/store";
import { Modal, AsyncForm, Field, value } from "./UI";
import { today } from "../lib/calculations";
import type { Customer, Task, Division } from "../lib/types";
import { appointmentTime, berlinDateTime, appointmentLabel } from "../lib/appointments";
import { exportCalendarEvent } from "../lib/iphone-calendar";
export function CustomerForm({
  customer,onClose,
}: {
  customer?: Customer;
  division?: Division;
  onClose: () => void;
}) {
  const {data,save,refresh}=useStore();
  const [fields,setFields]=useState({
    company:customer?.company||"",contact:customer?.contact||"",
    email:customer?.email||"",phone:customer?.phone||"",website:customer?.website||"",
    street:customer?.street||"",zip:customer?.zip||"",
    city:customer?.city||"",industry:customer?.industry||"",
    mobile:customer?.notes?.match(/^Mobil \(Visitenkarte\):\s*(.+)$/m)?.[1]||"",
    jobTitle:customer?.notes?.match(/^Position \(Visitenkarte\):\s*(.+)$/m)?.[1]||"",
    notes:customer?.notes||""
  });
  const [geo,setGeo]=useState<GeoCustomerDraft|null>(null);
  const [geoWarning,setGeoWarning]=useState("");
  const [cardBusy,setCardBusy]=useState(false);
  const [cardProgress,setCardProgress]=useState(0);
  const [cardError,setCardError]=useState("");
  const [cardWarning,setCardWarning]=useState<string[]>([]);
  const [cardFields,setCardFields]=useState<string[]>([]);
  const [cardImported,setCardImported]=useState(false);
  const [cardRawText,setCardRawText]=useState("");
  const [cardEvidence,setCardEvidence]=useState<Record<string,string>>({});
  const [cardConfidence,setCardConfidence]=useState<number|null>(null);
  const photoFilled=useRef<Record<string,string>>({});
  const abortRef=useRef<AbortController|null>(null);
  useEffect(()=>()=>abortRef.current?.abort(),[]);
  const update=(key:keyof typeof fields,next:string)=>{
    delete photoFilled.current[key];
    if(["company","street","zip","city"].includes(key)&&geo)setGeo(null);
    setFields(old=>({...old,[key]:next}));
  };
  function useGeoLocation(candidate:GeoCustomerDraft){
    if(customer)return;
    setGeo(candidate);
    setFields(old=>({
      ...old,company:candidate.company,street:candidate.street||old.street,
      zip:candidate.zip||old.zip,city:candidate.city||old.city,
      phone:candidate.phone||old.phone,email:candidate.email||old.email,
      industry:candidate.industry||old.industry,website:candidate.website||old.website,
      notes:[old.notes,candidate.website&&!old.notes.includes(candidate.website)?"Webseite laut öffentlichem Standortdatensatz: "+candidate.website:"",
        "Herkunft der Standortdaten: "+candidate.provenance].filter(Boolean).join("\n")
    }));
    const dupe=data.customers.find(x=>x.company.trim().toLowerCase()===candidate.company.trim().toLowerCase()&&
     (!candidate.street||x.street.trim().toLowerCase()===candidate.street.trim().toLowerCase())&&
     (!candidate.city||x.city.trim().toLowerCase()===candidate.city.trim().toLowerCase()));
    setGeoWarning(dupe?"Achtung: Dieser Betrieb existiert möglicherweise bereits in der zentralen Kundenakte. Vor dem Speichern auf Duplikate prüfen: "+dupe.company:"");
  }
  async function importBusinessCard(file:File|undefined){
    if(!file)return;
    abortRef.current?.abort();
    const ctrl=new AbortController();abortRef.current=ctrl;
    setCardError("");setCardWarning([]);setCardFields([]);setCardProgress(0);setCardBusy(true);
    setCardRawText("");setCardEvidence({});setCardConfidence(null);
    try{
      const result=await recognizeStatement(file,ctrl.signal,setCardProgress,"business-card");
      if(ctrl.signal.aborted)return;
      const parsed=readBusinessCardText(result.text);
      setCardRawText(result.text);
      setCardEvidence(parsed.evidence);
      setCardConfidence(result.confidence);
      const items=Object.entries(parsed.fields).filter(([,val])=>!!val);
      setFields(old=>{
        const next={...old};
        for(const [key,val] of items){
          const k=key as keyof typeof next;
          // Import never silently replaces an existing customer detail.
          if(!next[k].trim()||next[k]===photoFilled.current[k]){
            next[k]=val!;
            photoFilled.current[k]=val!;
          }
        }

        return next;
      });
      setCardWarning(parsed.warnings);
      setCardFields(items.map(([key])=>({company:"Unternehmen",contact:"Ansprechpartner",jobTitle:"Position",email:"E-Mail",website:"Website",phone:"Telefon",mobile:"Mobil",street:"Straße",zip:"PLZ",city:"Ort"} as Record<string,string>)[key]||key));
      setCardImported(items.length>0);
      if(!items.length)setCardError("Keine eindeutigen Visitenkartenangaben erkannt. Bitte ein scharfes, gerade aufgenommenes Foto verwenden oder Daten manuell ergänzen.");
    }catch(e){if(!ctrl.signal.aborted)setCardError((e as Error).message);}
    finally{if(abortRef.current===ctrl)setCardBusy(false);}
  }
  return (
    <Modal title={customer?"Kundenakte bearbeiten":"Neuen Kunden zentral erfassen"} onClose={onClose}>
      <p className="hint">Eine gemeinsame Kundenakte für SumUp und Vape. Eine Bereichsauswahl ist nicht erforderlich.</p>
      {!customer&&<GeoCustomerCapture onSelect={useGeoLocation}/>}
      {geo&&<p className="notice" role="status">📍 <strong>{geo.company}</strong> aus öffentlichen Standortdaten übernommen. GPS-Koordinaten gehören zum ausgewählten Geschäft, nicht zu deinem eigenen Standort. Bitte Namen und Adresse kontrollieren.</p>}
      {geoWarning&&<p className="error" role="alert">{geoWarning}</p>}
      <section className="business-card-import" aria-label="Visitenkarte auslesen">
        <h3>Visitenkarte fotografieren oder importieren</h3>
        <p className="hint">Im Browser auf Desktop und Mobilgerät verfügbar. Erkennbare Angaben werden in die Felder eingetragen, bestehende Kundendaten nicht überschrieben. Bitte vor dem Speichern prüfen.</p>
        <div className="form-grid">
          <Field label="Visitenkarte aus Dateien / Galerie auswählen">
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={cardBusy}
              onChange={e=>{void importBusinessCard(e.target.files?.[0]);e.target.value="";}}/>
          </Field>
          <Field label="Visitenkarte mit Kamera fotografieren">
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={cardBusy}
              onChange={e=>{void importBusinessCard(e.target.files?.[0]);e.target.value="";}}/>
          </Field>
        </div>
        {cardBusy&&<p className="notice" role="status"><Camera size={16}/> Texterkennung läuft … {cardProgress}%</p>}
        {cardFields.length>0&&<p className="notice" role="status"><ImageUp size={16}/> Erkannt und in freie Felder übertragen: {cardFields.join(", ")}. Bitte auf Richtigkeit prüfen.</p>}
        {cardWarning.map((message,i)=><p className="hint" key={i}>⚠ {message}</p>)}
        {cardRawText&&<details className="photo-recognition-evidence"><summary>Erkannte Angaben und OCR-Originaltext kontrollieren</summary>
          <p className="hint">Die OCR-Zeichensicherheit von {cardConfidence===null?"unbekannt":Math.round(cardConfidence)+" %"} ist keine Garantie für korrekte Firmennamen. Bitte alle Felder prüfen.</p>
          {Object.entries(cardEvidence).map(([field,line])=><p className="hint" key={field}><strong>{field}:</strong> {line}</p>)}
          <details><summary>Erkannten Originaltext anzeigen</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:340,overflow:"auto",fontSize:12}}>{cardRawText}</pre></details>
        </details>}
        {cardError&&<p className="error" role="alert">{cardError}</p>}
      </section>
      <AsyncForm onSubmit={async f=>{
        await save("customers",{
          ...customer,
          company:value(f,"company"),contact:value(f,"contact"),
          email:value(f,"email"),phone:value(f,"phone"),website:value(f,"website"),
          street:value(f,"street"),zip:value(f,"zip"),
          city:value(f,"city"),industry:value(f,"industry"),
          source:customer?.source||geo?.source||(cardImported?"Visitenkarte (OCR)":"Manuell"),
          notes:[value(f,"notes").replace(/^Mobil \(Visitenkarte\):.*(?:\r?\n|$)/gm,"").replace(/^Position \(Visitenkarte\):.*(?:\r?\n|$)/gm,"").trim(),
            value(f,"mobile")?"Mobil (Visitenkarte): "+value(f,"mobile"):"",
            value(f,"jobTitle")?"Position (Visitenkarte): "+value(f,"jobTitle"):""].filter(Boolean).join("\n"),
          lat:customer?.lat??geo?.lat??null,lng:customer?.lng??geo?.lng??null,
          ...(!customer?{interests:["sumup","vape"] as Division[]}:{})
        });
        await refresh();onClose();
      }}>
        <div className="form-grid">
          {([
            ["company","Unternehmen *","text",200,true],
            ["contact","Ansprechpartner","text",160,false],
            ["jobTitle","Position / Tätigkeit","text",160,false],
            ["email","E-Mail","email",254,false],
            ["website","Website","text",300,false],
            ["phone","Telefon","tel",40,false],
            ["mobile","Mobilnummer","tel",40,false],
            ["street","Straße / Hausnummer","text",200,false],
            ["zip","PLZ","text",12,false],
            ["city","Ort *","text",120,true],
            ["industry","Branche","text",100,false]
          ] as const).map(([key,label,type,maxLength,required])=>
            <Field label={label} key={key}><input name={key} type={type}
              value={fields[key]} required={required} maxLength={maxLength}
              onChange={e=>update(key,e.target.value)}/></Field>
          )}
        </div>
        <Field label="Notizen"><textarea name="notes" maxLength={5000} value={fields.notes}
          onChange={e=>update("notes",e.target.value)}/></Field>
      </AsyncForm>
    </Modal>
  );
}
export function TaskForm({
  task,
  customerId,
  division,
  onClose,
}: {
  task?: Task;
  customerId?: string;
  division?: Division;
  onClose: () => void;
}) {
  const { data, save } = useStore();
  const [saved, setSaved] = useState<Task | null>(null);
  const [calendarMessage, setCalendarMessage] = useState("");
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const relatedCustomer = data.customers.find(c => c.id === saved?.customer_id);
  async function addToCalendar() {
    if (!saved || calendarBusy) return;
    setCalendarBusy(true);
    try {
      const result = await exportCalendarEvent(saved, relatedCustomer, minutes);
      setCalendarMessage(result === "shared"
        ? "Kalenderdatei geteilt. Bitte auf dem iPhone den Termin im gewünschten Kalender bestätigen."
        : result === "downloaded"
        ? "Kalenderdatei bereitgestellt. Auf dem iPhone bei Bedarf über Dateien oder Mail öffnen und den Termin hinzufügen."
        : "Kalenderübernahme abgebrochen – der CRM-Termin bleibt gespeichert.");
    } catch(e) {
      setCalendarMessage(e instanceof Error ? e.message : "Kalenderdatei konnte nicht bereitgestellt werden.");
    } finally { setCalendarBusy(false); }
  }
  return (
    <Modal
      title={task ? (task.kind === "Termin" ? "Termin bearbeiten" : "Aufgabe bearbeiten") : "Nächsten Schritt planen"}
      onClose={onClose}
    >
      {saved ? (
        <div className="calendar-transfer">
          <p className="notice" role="status">Termin im neXaro CRM gespeichert: <strong>{saved.title}</strong> · {appointmentLabel(saved.due_at)}</p>
          <p>Jetzt kannst du den Eintrag inklusive Kunde, Adresse, Telefonnummer und Notizen in deinen iPhone-Kalender übernehmen. Die Übernahme erfolgt erst nach deiner Bestätigung am iPhone.</p>
          <Field label="Kalenderdauer">
            <select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
              <option value={15}>15 Minuten</option>
              <option value={30}>30 Minuten</option>
              <option value={60}>60 Minuten</option>
              <option value={90}>90 Minuten</option>
              <option value={120}>2 Stunden</option>
            </select>
          </Field>
          <div className="button-row">
            <button className="primary" type="button" disabled={calendarBusy}
              onClick={() => void addToCalendar()}>
              <CalendarPlus size={17}/> {calendarBusy ? "Kalender wird vorbereitet …" : "Zum iPhone-Kalender"}
            </button>
            <button className="secondary" type="button" onClick={onClose}>Fertig</button>
          </div>
          {calendarMessage && <p role="status" className="hint">{calendarMessage}</p>}
          <p className="hint">Dies ist eine manuelle Kalenderübernahme, keine laufende Zwei-Wege-Synchronisierung. Änderungen im CRM werden nicht automatisch im iPhone-Kalender aktualisiert.</p>
        </div>
      ) : (
      <AsyncForm
        label={task ? "Änderungen speichern" : "Speichern"}
        onSubmit={async (f) => {
          const row = await save("tasks", {
            ...task,
            title: value(f, "title"),
            customer_id: value(f, "customer_id") || null,
            division: (value(f, "division") || null) as Division | null,
            due_at: appointmentTime(value(f, "due_at")),
            kind: value(f, "kind") as Task["kind"],
            notes: value(f, "notes"),
            done: task?.done ?? false,
          });
          // Editing returns directly to the calendar without an unnecessary import prompt.
          if (row.kind === "Termin" && !task) setSaved(row);
          else onClose();
        }}
      >
        <Field label="Art des Eintrags">
          <select name="kind" defaultValue={task?.kind || "Wiedervorlage"}>
            <option>Wiedervorlage</option>
            <option>Termin</option>
            <option>Aufgabe</option>
          </select>
        </Field>
        <Field label="Was steht an? *">
          <input
            name="title"
            required
            maxLength={240}
            defaultValue={task?.title}
            placeholder="Zum Beispiel: Ansprechpartner zurückrufen"
          />
        </Field>
        <div className="form-grid">
          <Field label="Kunde">
            <select
              name="customer_id"
              defaultValue={task?.customer_id || customerId || ""}
            >
              <option value="">Ohne Kundenbezug</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bereich">
            <select
              name="division"
              defaultValue={task?.division || division || ""}
            >
              <option value="">Zentral</option>
              <option value="sumup">SumUp</option>
              <option value="vape">Vape</option>
            </select>
          </Field>
          <Field label="Fällig am * (deutsche Ortszeit)">
            <input
              name="due_at"
              type="datetime-local"
              required
              defaultValue={
                task ? berlinDateTime(task.due_at) : today() + "T10:00"
              }
            />
          </Field>
        </div>
        <Field label="Termin- / Aufgabenhinweise">
          <textarea
            name="notes"
            maxLength={3000}
            defaultValue={task?.notes || ""}
          />
        </Field>
      </AsyncForm>
      )}
    </Modal>
  );
}
