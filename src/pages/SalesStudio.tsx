import { useEffect, useMemo, useState } from "react";
import { Camera, ArrowRight, ArrowLeft, Save, FileText } from "lucide-react";
import { EditableNumberInput } from "../components/EditableNumberInput";
import { Card, Field, External } from "../components/UI";
import type { PaymentInput } from "../lib/calculations";
import { money, round } from "../lib/calculations";
import type { StatementReview } from "../components/StatementCapture";
import { compareFieldSales, type ExistingProviderInput, type SumupPlan } from "../lib/fieldSalesComparison";
import { hardwareCatalog, catalogCheckedAt, catalogSource, catalogHardwareSource } from "../lib/sumup-sales";
import { useStore } from "../lib/store";
import type { OfferDraft } from "./Offers";
import { hardwareOfferPrice } from "../lib/hardwareOfferPrice";
import { RangeNumber } from "../components/RangeNumber";

const defaultCurrent: ExistingProviderInput = {
  volume: 0, transactions: 0, debitShare: 80, debitRate: 1.95, creditRate: 2.59,
  serviceFee: 0, terminalFee: 0, perTransaction: 0, confirmedTotal: null,
};
const competitorHardware = [
  ["", "Bitte Bestandsgerät auswählen"],
  ["Ingenico Move/5000", "Ingenico Move/5000 · mobil"],
  ["Ingenico Desk/5000", "Ingenico Desk/5000 · stationär"],
  ["Ingenico AXIUM DX8000", "Ingenico AXIUM DX8000 · SmartPOS"],
  ["Verifone V400m", "Verifone V400m · mobil"],
  ["Verifone V200c", "Verifone V200c · stationär"],
  ["Verifone P400", "Verifone P400 · PIN-Pad"],
  ["PAX A920", "PAX A920 · SmartPOS"],
  ["PAX A920 Pro", "PAX A920 Pro · SmartPOS"],
  ["PAX A77", "PAX A77 · mobil"],
  ["Nexgo N86", "Nexgo N86 · SmartPOS"],
  ["Zettle Reader 2", "Zettle Reader 2 · Smartphone-Leser"],
  ["Zettle Terminal", "Zettle Terminal · eigenständig"],
  ["myPOS Go 2", "myPOS Go 2 · mobil"],
  ["myPOS Pro", "myPOS Pro · SmartPOS"],
  ["Worldline Saturn 1000F2", "Worldline Saturn 1000F2 · stationär"],
  ["Telefon / Tap to Pay", "Telefon / Tap to Pay"],
  ["Kein Terminal", "Noch kein Terminal vorhanden"],
  ["Sonstiges", "Sonstiges / unbekanntes Gerät"]
] as const;
const allowedHardware = hardwareCatalog.filter(h=>["tap","lite","solo","terminal","dock","pos"].includes(h.id));
type HardwareId = typeof allowedHardware[number]["id"];
type Wish = "Drucker"|"Ohne Smartphone"|"Kasse"|"Mobil"|"Kosten"|"Auszahlung";
const wishes: {id:Wish;label:string}[] = [
  {id:"Drucker",label:"Papierbelege / integrierter Drucker"},
  {id:"Ohne Smartphone",label:"Ohne Smartphone kassieren"},
  {id:"Kasse",label:"Kassen- und Artikelverwaltung"},
  {id:"Mobil",label:"Mobil und unterwegs kassieren"},
  {id:"Kosten",label:"Monatliche Kosten senken"},
  {id:"Auszahlung",label:"Häufigere Auszahlungen"}
];
const payLabel: Record<string,string> = {
  daily:"Täglich",weekly:"Wöchentlich",fortnightly:"Alle zwei Wochen",monthly:"Einmal im Monat",unknown:"Noch offen"
};
const suggest = (existing:string, needs:Wish[]):HardwareId => {
  if(needs.includes("Kasse")) return "pos";
  if(needs.includes("Drucker") || /a920|dx8000|n86|terminal|mypos pro/i.test(existing)) return "terminal";
  if(/reader|p400|pin-pad/i.test(existing) && !needs.includes("Ohne Smartphone")) return "lite";
  if(/tap to pay|telefon/i.test(existing) && !needs.includes("Ohne Smartphone")) return "tap";
  return "solo";
};
type SavedStudio = {
  current?:ExistingProviderInput; provider?:string; competitorHardware?:string;
  otherHardware?:string; contract?:string; payout?:string; future?:string;
  wishes?:Wish[]; plan?:SumupPlan; hardwareId?:HardwareId; quantity?:number;
  notes?:string; hardwareDiscount?:number;
};
const numeric=(s:string)=>Number(s);
const editable=(value:number,onChange:(v:number)=>void,props:{step?:string;min?:string;max?:string}={})=>
  <EditableNumberInput min={props.min??"0"} max={props.max} step={props.step??".01"}
    value={value} onChange={event=>onChange(numeric(event.target.value))}/>;

export function SalesStudio({customerId,photoInput,photoAvailable,photoReview,onCapture,onOffer,step,setStep}:{
  customerId:string;photoInput:PaymentInput;photoAvailable:boolean;photoReview:StatementReview|null;
  onCapture:()=>void;onOffer:(draft:OfferDraft)=>void;
  step:1|2|3;setStep:(step:1|2|3)=>void;
}) {
  const {data,save}=useStore();
  const opportunity=data.opportunities.find(o=>o.customer_id===customerId&&o.division==="sumup");
  const saved=(opportunity?.details.salesStudio||{}) as SavedStudio;
  const [current,setCurrent]=useState<ExistingProviderInput>(()=>({...defaultCurrent,...saved.current}));
  const [provider,setProvider]=useState(saved.provider||"");
  const [hardware,setHardware]=useState(saved.competitorHardware||"");
  const [otherHardware,setOtherHardware]=useState(saved.otherHardware||"");
  const [contract,setContract]=useState(saved.contract||"");
  const [payout,setPayout]=useState(saved.payout||"unknown");
  const [future,setFuture]=useState(saved.future||"");
  const [needs,setNeeds]=useState<Wish[]>(saved.wishes||[]);
  const [plan,setPlan]=useState<SumupPlan| "">(saved.plan||"");
  const [hardwareId,setHardwareId]=useState<HardwareId| "">(saved.hardwareId||"");
  const [quantity,setQuantity]=useState(saved.quantity||1);
  const [hardwareDiscount,setHardwareDiscount]=useState(saved.hardwareDiscount??0);
  const [notes,setNotes]=useState(saved.notes||"");
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [readReview,setReadReview]=useState("");
  const update=<K extends keyof ExistingProviderInput>(key:K,value:ExistingProviderInput[K])=>
    setCurrent(old=>({...old,[key]:value}));
  useEffect(()=>{
    if(!photoAvailable||!photoReview)return;
    const recognized=new Set(photoReview.recognizedFields||[]);
    const hasVolume=recognized.has("volume"),hasOnline=recognized.has("onlineVolume");
    setCurrent(old=>({
      ...old,
      ...(hasVolume||hasOnline ? {volume:round(
        (hasVolume?photoInput.volume:0)+(hasOnline?photoInput.onlineVolume:0)
      )} : {}),
      ...(recognized.has("transactions") ? {transactions:photoInput.transactions} : {}),
      ...(recognized.has("currentTotal") ? {confirmedTotal:photoInput.currentTotal??null} : {})
    }));
    const labels:Record<string,string>={
      volume:"Kartenumsatz",onlineVolume:"Online-Umsatz",
      transactions:"Transaktionen",currentTotal:"Gesamtgebühren"
    };
    const fields=(photoReview.recognizedFields||[]).map(x=>labels[x]||x);
    setReadReview(fields.length
      ? "Automatisch aus dem Foto übernommen (noch nicht geprüft): "+fields.join(", ")+". Bitte alle Angaben kontrollieren und fehlende Werte ergänzen."
      : "Aus dem Foto konnten keine eindeutigen Werte zugeordnet werden. Bitte Ist-Bestand manuell erfassen.");
  },[photoReview?.confirmedAt,photoAvailable]);
  const selectedPlan:SumupPlan=plan||(
    current.volume>0&&(()=>{
      try{return compareFieldSales(current,"plus").sumupTotal<compareFieldSales(current,"standard").sumupTotal;}catch{return false;}
    })()?"plus":"standard");
  const suggestedHardware=suggest(hardware+" "+otherHardware,needs);
  const selectedHardware=allowedHardware.find(h=>h.id===(hardwareId||suggestedHardware)) || allowedHardware.find(h=>h.id==="solo")!;
  const estimate=useMemo(()=>{
    try{return {data:compareFieldSales(current,selectedPlan),error:""};}
    catch(e){return {data:null,error:e instanceof Error?e.message:"Ungültige Eingabe"};}
  },[current,selectedPlan]);
  const standard=useMemo(()=>{
    try{return compareFieldSales(current,"standard");}catch{return null;}
  },[current]);
  const plus=useMemo(()=>{
    try{return compareFieldSales(current,"plus");}catch{return null;}
  },[current]);
  const hardwarePrice=hardwareOfferPrice(selectedHardware.price??0,hardwareDiscount,Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=100?quantity:1);
  const good=!!(estimate.data&&current.volume>0&&selectedHardware.price!==null&&
    Number.isSafeInteger(quantity)&&quantity>0&&quantity<=100);
  const offerNotes=()=>{
    if(!estimate.data)return "";
    const a=estimate.data;
    return [
      "Zahlungskonditionen und direkte Monats-/Jahreskostenvergleichstabelle siehe Angebotsabschnitt „Bisheriger Anbieter / SumUp“.",
      "Bestandsgerät: "+(hardware==="Sonstiges"?otherHardware||"Sonstiges":hardware||"nicht angegeben"),
      "Servicegebühr: "+money(current.serviceFee)+" / Monat · Terminalgebühr: "+money(current.terminalFee)+" / Monat · Entgelt pro Transaktion: "+money(current.perTransaction),
      current.confirmedTotal!==null?"Für den Ist-Vergleich wurden die geprüften Gesamtgebühren von "+money(current.confirmedTotal)+" / Monat verwendet.":"Für den Ist-Vergleich wurden die Gebühren aus den angegebenen Sätzen, Grundgebühren und Transaktionsentgelten berechnet.",
      "Vertragslaufzeit / Kündigung: "+(contract||"noch nicht erfasst"),
      "Bisheriger Auszahlungsturnus: "+(payLabel[payout]||payout),
      "Zukunftswunsch: "+(future||needs.join(", ")||"noch offen"),
      "Gewünschte SumUp-Hardware: "+selectedHardware.name+" · "+quantity+" × "+money(selectedHardware.price||0)+" netto regulär · "+hardwareDiscount+" % gewährter Rabatt · Angebot "+money(hardwarePrice.offerNet)+" netto.",
      "Differenz: "+money(a.monthlyDifference)+" / Monat bzw. "+money(a.annualDifference)+" / Jahr. Das ist eine unverbindliche Modellrechnung ohne eventuelle Wechselkosten.",
      "Preisstand "+catalogCheckedAt+" · Offizielle Konditionen: "+catalogSource,
      notes
    ].filter(Boolean).join("\n");
  };
  async function persist(){
    if(!customerId){setNotice("Bitte zuerst einen Kunden auswählen.");return;}
    setSaving(true);setNotice("");
    try{
      const savedData={current,provider,competitorHardware:hardware,otherHardware,contract,payout,
        future,wishes:needs,plan:selectedPlan,hardwareId:selectedHardware.id,quantity,hardwareDiscount,notes};
      await save("opportunities",{
        ...opportunity,customer_id:customerId,division:"sumup",stage:opportunity?.stage||"Neu",
        potential:current.volume,
        details:{...(opportunity?.details||{}),salesStudio:savedData}
      });
      setNotice("Vertriebsstudio in der zentralen Kundenakte gespeichert.");
    }catch(e){setNotice("Speichern fehlgeschlagen: "+(e instanceof Error?e.message:"Unbekannter Fehler"));}
    finally{setSaving(false);}
  }
  function createOffer(){
    if(!good||!estimate.data)return;
    onOffer({
      division:"sumup",...(customerId?{customer_id:customerId}:{}),
      lines:[{name:"SumUp "+selectedHardware.name+" · Hardware"+(hardwareDiscount?" · "+hardwareDiscount+" % Nachlass":""),quantity,
        price:hardwarePrice.discountedUnit,vat:19}],
      notes:offerNotes(),
      snapshot:{salesStudio:{current,provider,competitorHardware:hardware,otherHardware,
        contract,payout,future,wishes:needs,plan:selectedPlan,
        sumupHardware:selectedHardware.name,quantity,hardwareDiscount,hardwarePricing:hardwarePrice,
        comparison:estimate.data,checkedAt:catalogCheckedAt,
        source:catalogSource,hardwareSource:catalogHardwareSource}}
    });
  }
  return <div className="sales-studio field-studio">
    <div className="section-intro"><div>
      <span className="eyebrow">NE X A R O · VERTRIEB VOR ORT</span>
      <h2>SumUp Vertriebsstudio</h2>
      <p>Foto importieren → Ist-Bestand aufnehmen → passendes Vergleichsangebot erstellen.</p>
    </div><External href={catalogSource}>SumUp-Preise prüfen</External></div>
    <div className="field-progress" role="navigation" aria-label="Vertriebsstudio Schritte">
      {([1,2,3] as const).map(n=><button key={n} className={step===n?"active":""}
        onClick={()=>setStep(n)} aria-current={step===n?"step":undefined}>
        <b>{n}</b><span>{n===1?"Foto-Import":n===2?"Ist-Bestand":"Vergleichsangebot"}</span>
      </button>)}
    </div>
    {step===1&&<Card title="01 · Foto-Import" eyebrow="HÄNDLERABRECHNUNG">
      <button className="primary field-cta" type="button" onClick={onCapture}>
        <Camera size={19}/> Foto aufnehmen / hochladen
      </button>
    </Card>}
    {step===2&&<>
      <Card title="02 · Händler & Umsatz" eyebrow="IST-BESTAND · AKTUELLER ANBIETER">
        {readReview&&<p role="status" className="notice">{readReview}</p>}
        <div className="form-grid">
          <Field label="Aktueller Anbieter"><input value={provider} onChange={e=>setProvider(e.target.value)}
            placeholder="z. B. VR Payment, TeleCash, Worldline …"/></Field>
          <RangeNumber label="Monatlicher Kartenumsatz" value={current.volume} onChange={v=>update("volume",v)} max={100000} step={100} unit="€" />
          <RangeNumber label="Transaktionen pro Monat" value={current.transactions} onChange={v=>update("transactions",v)} max={5000} step={1} />
          <Field label="Bestands-Hardware">
            <select value={hardware} onChange={e=>setHardware(e.target.value)}>
              {competitorHardware.map(([id,label])=><option key={id} value={id}>{label}</option>)}
            </select>
          </Field>
          {hardware==="Sonstiges"&&<Field label="Gerät / Modell manuell ergänzen"><input value={otherHardware}
            onChange={e=>setOtherHardware(e.target.value)} placeholder="Hersteller und Modell"/></Field>}
        </div>
      </Card>
      <Card title="03 · Kartenmix & Gebühren" eyebrow="ANTEILE UND KARTENSÄTZE">
        <p className="hint">Das sind angenommene <strong>Gebührensätze des aktuellen Anbieters</strong>, keine SumUp-Sätze. Bei einer echten Händlerabrechnung die Werte korrigieren.</p>
        <div className="form-grid field-fees-grid">
          <RangeNumber label="EC / Debit – Umsatzanteil" value={current.debitShare} onChange={v=>update("debitShare",v)} max={100} unit="%" />
          <Field label="Kredit- & Premiumkarten inkl. Amex – Anteil (%)"><strong className="field-computed">{round(100-current.debitShare)} %</strong></Field>
          <RangeNumber label="EC / Debit – Faktor" value={current.debitRate} onChange={v=>update("debitRate",v)} max={5} step={0.01} unit="%" />
          <RangeNumber label="Kredit / Premium – Faktor" value={current.creditRate} onChange={v=>update("creditRate",v)} max={5} step={0.01} unit="%" />
        </div>
      </Card>
      <Card title="04 · Laufende Kosten" eyebrow="FESTE UND VARIABLE ENTGELTE">
        <div className="form-grid field-fees-grid">
          <RangeNumber label="Servicegebühr / Monat" value={current.serviceFee} onChange={v=>update("serviceFee",v)} max={200} step={0.5} unit="€" />
          <RangeNumber label="Terminalgebühr / Monat" value={current.terminalFee} onChange={v=>update("terminalFee",v)} max={200} step={0.5} unit="€" />
          <RangeNumber label="Gebühr je Transaktion" value={current.perTransaction} onChange={v=>update("perTransaction",v)} max={2} step={0.01} unit="€" />
        </div>
        {estimate.data&&<div className="mini-stats">
          <div><span>EC/Debit-Umsatz</span><b>{money(estimate.data.debit)}</b></div>
          <div><span>Kredit-/Premium-Umsatz</span><b>{money(estimate.data.credit)}</b></div>
          <div><span>Rechnerische Ist-Gesamtgebühren</span><b>{money(estimate.data.calculatedOld)} / Monat</b></div>
        </div>}
        <Field label="Gesamtgebühren laut Abrechnung / Monat (€) – optional">
          <EditableNumberInput min="0" step=".01" value={current.confirmedTotal??""}
            placeholder="Leer = automatisch berechnen"
            onChange={e=>update("confirmedTotal",e.target.value===""?null:numeric(e.target.value))}/>
        </Field>
        <p className="hint">Ein hier eingegebener geprüfter Gesamtbetrag ersetzt die berechneten Ist-Gebühren – er wird nicht zusätzlich aufgeschlagen.</p>
      </Card>
      <Card title="05 · Vertrag & Wünsche" eyebrow="ENTSCHEIDUNGSKRITERIEN DES HÄNDLERS">
        <div className="form-grid">
          <Field label="Vertragslaufzeit / Kündigungsfrist">
            <input value={contract} onChange={e=>setContract(e.target.value)}
              placeholder="z. B. 24 Monate, 3 Monate Kündigungsfrist"/>
          </Field>
          <Field label="Aktueller Auszahlungsturnus">
            <select value={payout} onChange={e=>setPayout(e.target.value)}>
              <option value="unknown">Bitte auswählen</option>
              <option value="daily">Täglich</option><option value="weekly">Wöchentlich</option>
              <option value="fortnightly">Alle zwei Wochen</option><option value="monthly">Einmal im Monat</option>
            </select>
          </Field>
        </div>
        <Field label="Was wäre der Wunsch für die Zukunft?">
          <textarea rows={3} maxLength={2500} value={future} onChange={e=>setFuture(e.target.value)}
            placeholder="z. B. günstigere Gebühren, schnelle Auszahlung, weniger Geräte, Papierbelege …"/>
        </Field>
        <div className="field-wishes">
          {wishes.map(w=><label key={w.id} className="checkbox-field">
            <input type="checkbox" checked={needs.includes(w.id)} onChange={e=>
              setNeeds(old=>e.target.checked?[...old,w.id]:old.filter(v=>v!==w.id))}/>
            {w.label}</label>)}
        </div>
        {estimate.error&&<p className="error" role="alert">{estimate.error}</p>}
        <div className="button-row field-actions">
          <button className="secondary" onClick={()=>setStep(1)}><ArrowLeft size={15}/> Foto</button>
          <button className="secondary" disabled={saving||!customerId} onClick={()=>void persist()}>
            <Save size={15}/>{saving?"Speichern …":"Bestand speichern"}
          </button>
          <button className="primary" disabled={!estimate.data||current.volume<=0} onClick={()=>setStep(3)}>
            Vergleichsangebot erstellen <ArrowRight size={17}/>
          </button>
        </div>
        {notice&&<p role="status" className="notice">{notice}</p>}
      </Card>
    </>}
    {step===3&&<>
      <Card title="03 · Vergleichsangebot" eyebrow="IST-ANBIETER GEGEN SUMUP · MONATLICHE KOSTEN">
        {!estimate.data?<p className="error" role="alert">{estimate.error}</p>:<>
          <div className="field-compare">
            <section><span className="eyebrow">BISHER</span><h3>{provider||"Aktueller Anbieter"}</h3>
              <strong>{money(estimate.data.oldTotal)}</strong><small>Gebühren / Monat</small>
              <p>{hardware==="Sonstiges"?otherHardware||"Sonstiges":hardware||"Bestandsgerät noch offen"}</p>
              <p>EC/Debit {current.debitShare}% · {current.debitRate}%<br/>Kredit/Premium {round(100-current.debitShare)}% · {current.creditRate}%</p>
              <p>Auszahlung: {payLabel[payout]}</p>
            </section>
            <section className="field-compare-new"><span className="eyebrow">ANGEBOT SUMUP</span><h3>{selectedPlan==="plus"?"Zahlungen Plus":"Umsatzbasiertes Zahlen"}</h3>
              <strong>{money(estimate.data.sumupTotal)}</strong><small>Modellgebühren / Monat</small>
              <p>Debit {estimate.data.sumupDebit}% · Kredit/Premium modellhaft {estimate.data.sumupCredit}%</p>
              <p>Grundgebühr: {money(estimate.data.sumupBase)} / Monat</p>
              <p>Regulärer Hardwarepreis separat</p>
            </section>
          </div>
          <div className="field-difference"><span>Rechnerische Differenz bisher – SumUp / Monat</span>
            <strong>{money(estimate.data.monthlyDifference)}</strong>
            <small>Hochgerechnet auf 12 Monate: {money(estimate.data.annualDifference)} · negative Werte = höhere SumUp-Kosten</small>
          </div>
          <p className="hint">{estimate.data.note} Bestehende Vertragsbindung und etwaige Wechselkosten sind nicht eingerechnet.</p>
        </>}
      </Card>
      <Card title="Tarif & vergleichbare SumUp-Hardware" eyebrow="VORSCHLAG · MANUELL ÄNDERBAR">
        <div className="form-grid">
          <Field label="SumUp-Tarif">
            <select value={selectedPlan} onChange={e=>setPlan(e.target.value as SumupPlan)}>
              <option value="standard">Umsatzbasiertes Zahlen · keine Grundgebühr</option>
              <option value="plus">Zahlungen Plus · 19 € monatlich (Modell)</option>
            </select>
          </Field>
          <Field label="Passende SumUp-Hardware">
            <select value={selectedHardware.id} onChange={e=>setHardwareId(e.target.value as HardwareId)}>
              {allowedHardware.map(h=><option key={h.id} value={h.id}>{h.name} · {h.price===null?"Preis prüfen":money(h.price)+" netto"}</option>)}
            </select>
          </Field>
          <Field label="Stückzahl SumUp-Geräte">{editable(quantity,setQuantity,{step:"1",min:"1",max:"100"})}</Field>
          <Field label="Regulärer Hardwarepreis · netto">
            <strong className="field-computed">{money(hardwarePrice.regularTotal)}</strong>
          </Field>
          <Field label={"Gewährter Hardware-Rabatt · "+hardwareDiscount+" %"}>
            <input aria-label="Hardware-Rabatt Prozent" type="range" min="0" max="25" step="1"
              value={hardwareDiscount} onChange={e=>setHardwareDiscount(Number(e.target.value))}/>
          </Field>
          <Field label="Hardware-Nachlass · netto"><strong className="field-computed">{money(hardwarePrice.discountTotal)}</strong></Field>
          <Field label="Hardware-Angebotspreis · netto"><strong className="field-computed">{money(hardwarePrice.offerNet)}</strong></Field>
        </div>
        <p className="hint">Regulärer Hardwarepreis als Basis; dein individuell gewährter Nachlass beträgt standardmäßig 0 % und ist bis 25 % einstellbar. Monatliche Zahlgebühren bleiben separat.</p>
        {standard&&plus&&<div className="mini-stats">
          <div><span>SumUp Standard / Monat</span><b>{money(standard.sumupTotal)}</b></div>
          <div><span>SumUp Zahlungen Plus / Monat</span><b>{money(plus.sumupTotal)}</b></div>
        </div>}
        <External href={catalogHardwareSource}>Hardwarepreise offiziell prüfen</External>
        <Field label="Weitere Gesprächsnotizen / Vereinbarung">
          <textarea rows={3} maxLength={3000} value={notes} onChange={e=>setNotes(e.target.value)}
            placeholder="Vereinbarte nächsten Schritte …"/>
        </Field>
        <div className="button-row field-actions">
          <button className="secondary" onClick={()=>setStep(2)}><ArrowLeft size={15}/> Ist-Bestand ändern</button>
          <button className="secondary" disabled={!customerId||saving} onClick={()=>void persist()}><Save size={15}/> Speichern</button>
          <button className="primary" disabled={!good} onClick={createOffer}>
            <FileText size={17}/> Vergleichsangebot übernehmen
          </button>
        </div>
        {!customerId&&<p className="notice">Auch ohne Kundenakte: Vergleichsangebot öffnen und als Entwurf mit automatischer Nummer speichern. Kunden später zuordnen.</p>}
        {notice&&<p role="status" className="notice">{notice}</p>}
      </Card>
    </>}
    <p className="hint">SumUp-Referenzdaten: {catalogCheckedAt}. Tatsächliche Kartenarten, Auszahlungswege, Preise und Konditionen vor dem verbindlichen Angebot prüfen.</p>
  </div>;
}
