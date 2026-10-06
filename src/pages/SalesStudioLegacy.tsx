import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Camera, ArrowRight, ArrowLeft, Save, FileText } from "lucide-react";
import { EditableNumberInput } from "../components/EditableNumberInput";
import { Card, Field, External } from "../components/UI";
import type { PaymentInput } from "../lib/calculations";
import type { IncomingSumupInquiry } from "../lib/incomingSumupInquiry";
import {feeReadiness,feeReviewSignature} from "../lib/feeReadiness";
import { money, round } from "../lib/calculations";
import type { StatementReview } from "../components/StatementCapture";
import { compareFieldSales, type ExistingProviderInput, type SumupPlan } from "../lib/fieldSalesComparison";
import { hardwareCatalog, catalogCheckedAt, catalogSource, catalogHardwareSource } from "../lib/sumup-sales";
import { useStore } from "../lib/store";
import type { OfferDraft } from "./Offers";
import { hardwareOfferPrice } from "../lib/hardwareOfferPrice";
import { RangeNumber } from "../components/RangeNumber";
import { CardMixBars } from "../components/CardMixBars";
import { SidekickMatrix } from "../components/SidekickMatrix";
import { SumupAdvantage } from "../components/SumupAdvantage";
import { SidekickCampaignPicker } from "../components/SidekickCampaignPicker";
import {customerGoals,recommendSumup,deriveDomesticShare,deriveCampaignPrefill,compareSelectedSumup,selectedPackageName,selectedSumupPaymentPlan,type CustomerGoal} from "../lib/sumup-needs";
import {emptySidekickSelection,sidekickNotes,sidekickOfferLines,sumupSidekickHardware,sumupSidekickFees,normalizeSidekickSelection,withoutFixedTerm,chooseSidekickLicense,type SumupSidekickSelection} from "../lib/sumup-sidekick";

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
type Wish = CustomerGoal;
const wishes=customerGoals;
const payLabel: Record<string,string> = {
  daily:"Täglich",weekly:"Wöchentlich",fortnightly:"Alle zwei Wochen",monthly:"Einmal im Monat",unknown:"Noch offen"
};
const suggest = (existing:string, needs:Wish[]):HardwareId => {
  if(needs.includes("pos")) return "pos";
  if(needs.includes("receipt") || /a920|dx8000|n86|terminal|mypos pro/i.test(existing)) return "terminal";
  if(/reader|p400|pin-pad/i.test(existing) && !needs.includes("standalone")) return "lite";
  if(/tap to pay|telefon/i.test(existing) && !needs.includes("standalone")) return "tap";
  return "solo";
};
type SavedStudio = {
  current?:ExistingProviderInput; provider?:string; competitorHardware?:string;
  otherHardware?:string; contract?:string; payout?:string; future?:string;
  wishes?:Wish[]; plan?:SumupPlan; hardwareId?:HardwareId; quantity?:number;
  notes?:string; hardwareDiscount?:number; cardMixConfirmed?:boolean; feeRatesConfirmed?:boolean; noFixedTerm?:boolean; sidekick?:SumupSidekickSelection;
};
const numeric=(s:string)=>Number(s);
const editable=(value:number,onChange:(v:number)=>void,props:{step?:string;min?:string;max?:string}={})=>
  <EditableNumberInput min={props.min??"0"} max={props.max} step={props.step??".01"}
    value={value} onChange={event=>onChange(numeric(event.target.value))}/>;

export function SalesStudio({customerId,inquiry,photoInput,photoAvailable,photoReview,onCapture,onOffer,step,setStep}:{
  inquiry:IncomingSumupInquiry|null;
  customerId:string;photoInput:PaymentInput;photoAvailable:boolean;photoReview:StatementReview|null;
  onCapture:()=>void;onOffer:(draft:OfferDraft)=>void;
  step:1|2|3;setStep:(step:1|2|3)=>void;
}) {
  const {data,save}=useStore();
  const studioTop=useRef<HTMLDivElement>(null);
  const previousStep=useRef(step);
  useLayoutEffect(()=>{
    if(previousStep.current===2&&step===3){
      studioTop.current?.scrollIntoView({block:"start",behavior:"auto"});
      // iOS in-app browsers can restore the former scroll offset after the React render.
      const frame=requestAnimationFrame(()=>studioTop.current?.scrollIntoView({block:"start",behavior:"auto"}));
      previousStep.current=step;
      return ()=>cancelAnimationFrame(frame);
    }
    previousStep.current=step;
  },[step]);
  const opportunity=data.opportunities.find(o=>o.customer_id===customerId&&o.division==="sumup");
  const saved=(opportunity?.details.salesStudio||{}) as SavedStudio;
  const [current,setCurrent]=useState<ExistingProviderInput>(()=>({...defaultCurrent,...(inquiry?.volume!==null&&inquiry?.volume!==undefined?{volume:inquiry.volume}:{}),...saved.current}));
  const [provider,setProvider]=useState(saved.provider||inquiry?.provider||"");
  const [hardware,setHardware]=useState(saved.competitorHardware||"");
  const [otherHardware,setOtherHardware]=useState(saved.otherHardware||"");
  const [contract,setContract]=useState(saved.contract||"");
  const [noFixedTerm,setNoFixedTerm]=useState(saved.noFixedTerm??false);
  const [payout,setPayout]=useState(saved.payout||"unknown");
  const [future,setFuture]=useState(saved.future||"");
  const [needs,setNeeds]=useState<Wish[]>(()=>((saved.wishes||[]) as string[]).map(w=>({"Drucker":"receipt","Ohne Smartphone":"standalone","Kasse":"pos","Mobil":"mobile","Kosten":"savings","Auszahlung":"payout"} as Record<string,string>)[w]||w).filter(w=>customerGoals.some(g=>g.id===w)) as Wish[]);
  const [hardwareId,setHardwareId]=useState<HardwareId| "">(saved.hardwareId||"");
  const [quantity,setQuantity]=useState(saved.quantity||1);
  const [hardwareDiscount,setHardwareDiscount]=useState(saved.hardwareDiscount??0);
  const [notes,setNotes]=useState(saved.notes||"");
  const [sidekick,setSidekick]=useState<SumupSidekickSelection>(()=>normalizeSidekickSelection({...saved.sidekick||{...emptySidekickSelection,licenses:saved.plan==="plus"?["payments"]:[]},...(saved.noFixedTerm?{licenses:[]}:{}),campaignAuthorized:false}));
  const [cardMixConfirmed,setCardMixConfirmed]=useState(saved.cardMixConfirmed??false);
  const [feeRatesConfirmed,setFeeRatesConfirmed]=useState(saved.feeRatesConfirmed??false);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");
  const [readReview,setReadReview]=useState("");
  const [reviewedSignature,setReviewedSignature]=useState("");
  const update=<K extends keyof ExistingProviderInput>(key:K,value:ExistingProviderInput[K])=>
    setCurrent(old=>({...old,[key]:value}));
  useEffect(()=>{
    if(!photoAvailable||!photoReview)return;
    setReviewedSignature("");
    const recognized=new Set(photoReview.recognizedFields||[]);
    const detail=photoReview.details||{};
    const hasVolume=recognized.has("volume"),hasOnline=recognized.has("onlineVolume");
    setCurrent(old=>({
      ...old,
      ...(hasVolume||hasOnline?{volume:round((hasVolume?photoInput.volume:0)+(hasOnline?photoInput.onlineVolume:0))}:{}),
      ...(recognized.has("transactions")?{transactions:photoInput.transactions}:{}),
      ...(recognized.has("currentTotal")?{confirmedTotal:photoInput.currentTotal??null}:{}),
      ...(detail.debitShare!==undefined?{debitShare:detail.debitShare}:{}),
      ...(detail.debitRate!==undefined?{debitRate:detail.debitRate}:{}),
      ...(detail.creditRate!==undefined?{creditRate:detail.creditRate}:{}),
      ...(detail.serviceFee!==undefined?{serviceFee:detail.serviceFee}:{}),
      ...(detail.terminalFee!==undefined?{terminalFee:detail.terminalFee}:{}),
      ...(detail.perTransaction!==undefined?{perTransaction:detail.perTransaction}:{})
    }));
    if(detail.provider)setProvider(detail.provider);
    // Photo values stay unverified until the salesperson checks the source.
    if(detail.debitShare!==undefined)setCardMixConfirmed(false);
    if(detail.debitRate!==undefined||detail.creditRate!==undefined)setFeeRatesConfirmed(false);
    const labels:Record<string,string>={
      volume:"Kartenumsatz",onlineVolume:"Online-Umsatz",transactions:"Transaktionen",
      currentTotal:"Gesamtgebühren",provider:"Zahlungsanbieter",merchant:"Firmenname",
      debitShare:"EC-/Debit-Anteil",debitRate:"EC-/Debit-Gebühr",
      creditRate:"Kreditkartengebühr",serviceFee:"Servicegebühr",
      terminalFee:"Hardwaregebühr",perTransaction:"Gebühr je Transaktion",
      eligibleVolume:"geeignete Karten (€)",otherVolume:"andere Karten (€)"
    };
    const fields=(photoReview.recognizedFields||[]).map(x=>labels[x]||x);
    setReadReview(fields.length
      ?"Automatisch aus dem Foto übernommen (NOCH NICHT GEPRÜFT): "+fields.join(", ")+". Bitte jeden Wert mit der Abrechnung kontrollieren."
      :"Keine eindeutigen Werte erkannt. Bitte das Foto besser zuschneiden oder die Angaben manuell erfassen.");
  },[photoReview?.confirmedAt,photoAvailable]);
  const readiness=feeReadiness(current,provider,cardMixConfirmed,feeRatesConfirmed);
  const reviewSignature=feeReviewSignature(current,provider,cardMixConfirmed,feeRatesConfirmed);
  const finalized=readiness.ready&&reviewedSignature===reviewSignature;
  const suggestedFee=deriveCampaignPrefill(current.debitRate,feeRatesConfirmed);
  const suggestedMix=deriveDomesticShare({debitShare:current.debitShare,cardMixConfirmed});
  const effectiveSidekick=noFixedTerm?withoutFixedTerm(sidekick):normalizeSidekickSelection({...sidekick,
    ...(sidekick.campaignSource==="manual"?{}:{campaignIndex:suggestedFee?.index??null,campaignSource:suggestedFee?"estimate":undefined}),
    ...(sidekick.domesticShareSource==="manual"?{}:{domesticShare:suggestedMix?.value??null,domesticShareSource:suggestedMix?.source})
  });
  const selectedPlan=selectedSumupPaymentPlan(effectiveSidekick);
  const packageName=selectedPackageName(effectiveSidekick);
  const advisor=useMemo(()=>{try{return recommendSumup(current,needs,future,hardware+" "+otherHardware)}catch{return null;}},[current,needs,future,hardware,otherHardware]);
  function applyRecommendation(){
    if(!finalized){setNotice("Bitte fehlende Belegwerte prüfen und den Ist-Bestand ausdrücklich freigeben.");return;}
    if(!advisor){setNotice("Bitte zuerst gültige Gebühren und Umsätze erfassen.");return;}
    setSidekick(old=>{const next=normalizeSidekickSelection({...old,licenses:noFixedTerm?[]:advisor.licenses,hardware:[{id:advisor.hardwareId,quantity:1}],payout:advisor.payout});return noFixedTerm?withoutFixedTerm(next):next;});
    if(allowedHardware.some(h=>h.id===advisor.hardwareId))setHardwareId(advisor.hardwareId as HardwareId);
    setStep(3);
  }
  const suggestedHardware=suggest(hardware+" "+otherHardware,needs);
  const selectedHardware=allowedHardware.find(h=>h.id===(hardwareId||suggestedHardware)) || allowedHardware.find(h=>h.id==="solo")!;
  const estimate=useMemo(()=>{
    try{return {data:compareSelectedSumup(current,effectiveSidekick),error:""};}
    catch(e){return {data:null,error:e instanceof Error?e.message:"Ungültige Eingabe"};}
  },[current,effectiveSidekick]);
  const standard=useMemo(()=>{
    try{return compareFieldSales(current,"standard");}catch{return null;}
  },[current]);
  const plus=useMemo(()=>{
    try{return compareFieldSales(current,"plus");}catch{return null;}
  },[current]);
  const hardwarePrice=hardwareOfferPrice(selectedHardware.price??0,hardwareDiscount,Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=100?quantity:1);
  const good=!!(finalized&&estimate.data&&current.volume>0&&selectedHardware.price!==null&&
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
      noFixedTerm?"Zukunftswunsch: Keine Laufzeitbindung; 1,39 % vor Ort, 0 € monatliche Tarifgrundgebühr; keine Plus-Variante.":"",
      "Bisheriger Auszahlungsturnus: "+(payLabel[payout]||payout),
      "Zukunftswunsch: "+(future||needs.join(", ")||"noch offen"),
      "Gewünschte SumUp-Hardware: "+selectedHardware.name+" · "+quantity+" × "+money(selectedHardware.price||0)+" netto regulär · "+hardwareDiscount+" % gewährter Rabatt · Angebot "+money(hardwarePrice.offerNet)+" netto.",
      "SumUp Vorteil: "+money(a.monthlyDifference)+" / Monat bzw. "+money(a.annualDifference)+" / Jahr. "+(a.monthlyDifference<0?"Rechnerisch höhere SumUp-Kosten; die ausgewählten Funktionen separat nach Kundenbedarf bewerten.":"Unverbindliche Modellrechnung ohne eventuelle Wechselkosten."),
      "Preisstand "+catalogCheckedAt+" · Offizielle Konditionen: "+catalogSource,
      notes
    ].filter(Boolean).join("\n");
  };
  async function persist(){
    if(!customerId){setNotice("Bitte zuerst einen Kunden auswählen.");return;}
    setSaving(true);setNotice("");
    try{
      const savedData={current,provider,competitorHardware:hardware,otherHardware,contract,payout,
        future,wishes:needs,noFixedTerm,plan:selectedPlan,hardwareId:selectedHardware.id,quantity,hardwareDiscount,notes,cardMixConfirmed,feeRatesConfirmed,sidekick:normalizeSidekickSelection(effectiveSidekick)};
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
    if(!good||!estimate.data){setNotice("Angebot gesperrt: Ist-Bestand vollständig prüfen und freigeben.");return;}
    const offerSelection=normalizeSidekickSelection(effectiveSidekick);
    onOffer({
      division:"sumup",...(customerId?{customer_id:customerId}:{}),
      lines:(offerSelection.hardware.length||offerSelection.licenses.length)?sidekickOfferLines(offerSelection):[{name:"SumUp "+selectedHardware.name+" · Hardware"+(hardwareDiscount?" · "+hardwareDiscount+" % Nachlass":""),quantity,
        price:hardwarePrice.discountedUnit,vat:19}],
      notes:offerNotes()+"\n"+sidekickNotes(offerSelection),
      snapshot:{salesStudio:{current,provider,competitorHardware:hardware,otherHardware,
        contract,payout,future,wishes:needs,noFixedTerm,cardMixConfirmed,feeRatesConfirmed,plan:selectedPlan,
        sumupHardware:offerSelection.hardware.length?offerSelection.hardware.map(x=>x.quantity+" × "+(sumupSidekickHardware.find(p=>p.id===x.id)?.name||x.id)).join(", "):selectedHardware.name,quantity,hardwareDiscount,hardwarePricing:sidekick.hardware.length?undefined:hardwarePrice,
        comparison:estimate.data,sidekick:offerSelection,checkedAt:catalogCheckedAt,
        source:catalogSource,hardwareSource:catalogHardwareSource}}
    });
  }
  return <div ref={studioTop} className="sales-studio field-studio" style={{scrollMarginTop:16}}>
    <div className="section-intro"><div>
      <span className="eyebrow">NE X A R O · VERTRIEB VOR ORT</span>
      <h2>SumUp Vertriebsstudio</h2>
      <p>Foto importieren → Ist-Bestand aufnehmen → passendes Vergleichsangebot erstellen.</p>
    </div><External href={catalogSource}>SumUp-Preise prüfen</External></div>
    <div className="field-progress" role="navigation" aria-label="Vertriebsstudio Schritte">
      {([1,2,3] as const).map(n=><button key={n} className={step===n?"active":""}
        onClick={()=>{if(n===3&&!finalized){setStep(2);setNotice("Bitte den Ist-Bestand unten prüfen und freigeben.");return;}setStep(n)}} aria-current={step===n?"step":undefined}>
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
        {inquiry&&<p className="notice" role="status">📨 Angaben aus der Kundenanfrage vorausgefüllt, soweit noch keine Vertriebsstudio-Werte gespeichert waren. Umsatz und Anbieter sind Selbstauskünfte. EC-/Debit-Anteil (80/20-Vorgabe) sowie Gebühren sind Annahmen, keine aus dem Formular ermittelten Fakten. Bitte vor dem Gebührenvergleich prüfen.</p>}
        {readReview&&<p role="status" className="notice">{readReview}</p>}
        {photoReview&&<div className="nx-fee-readiness-intro">
          <span className="badge positive">FOTO EINGELESEN · PRÜFUNG ERFORDERLICH</span>
          <strong>Erkannte Werte sind Vorschläge, keine geprüften Gebühren.</strong>
          <p>Prüfe Umsatz, Anbieter, Kartenanteile und Gebühren unten mit der eingereichten Abrechnung. Nicht erkannte Felder bleiben offen; vorhandene Schätzwerte gelten nicht als Belegwerte.</p>
        </div>}
        <button type="button" className="secondary" onClick={onCapture}><Camera size={17}/> Abrechnung erneut fotografieren / hochladen</button>
        {photoReview?.details?.merchant&&<p className="notice"><strong>Erkannter Händler / Firmenname:</strong> {photoReview.details.merchant}. Bitte mit der zentralen Kundenakte abgleichen; diese wird nicht ohne Bestätigung überschrieben.</p>}
        {photoReview&&<details className="photo-recognition-evidence"><summary>Fotoauslesung und erkannte Textstellen überprüfen</summary>
          <p className="hint">Die Erkennung ist ein Vorschlag und keine Prüfung der Abrechnung. Nicht eindeutig erkennbare Werte bleiben unverändert und müssen ergänzt werden.</p>
          {photoReview.confidence!==null&&<p className="hint">Durchschnittliche OCR-Zeichensicherheit: {Math.round(photoReview.confidence)} % (keine inhaltliche Genauigkeitsgarantie).</p>}
          {Object.entries(photoReview.evidence||{}).map(([name,line])=><p className="hint" key={name}><strong>{name}:</strong> {line}</p>)}
          {(photoReview.warnings||[]).map((warning,i)=><p key={i} className="hint">⚠ {warning}</p>)}
          {photoReview.ocrText&&<details><summary>Erkannten Originaltext anzeigen (Diagnose)</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:340,overflow:"auto",fontSize:12}}>{photoReview.ocrText}</pre><p className="hint">Nur zur Kontrolle auf deinem Gerät; kein automatisches Speichern des vollständigen Belegtexts in der Kundenakte.</p></details>}
        </details>}
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
        <CardMixBars debitShare={current.debitShare}
          debitRate={current.debitRate} creditRate={current.creditRate}
          onDebitShare={v=>{update("debitShare",v);setCardMixConfirmed(true);}}
          onDebitRate={v=>{update("debitRate",v);setFeeRatesConfirmed(true);}}
          onCreditRate={v=>{update("creditRate",v);setFeeRatesConfirmed(true);}} />
        {photoReview&&<p className="hint" role="status">{photoReview.details?.debitRate!==undefined?`EC-/Debit-Gebühr aus dem Foto: ${photoReview.details.debitRate.toLocaleString("de-DE")} %`:"⚠ EC-/Debit-Gebühr aus dem Foto nicht eindeutig erkannt – der sichtbare Wert kann noch die bisherige Vorgabe sein."} · {photoReview.details?.creditRate!==undefined?`Kreditkartengebühr aus dem Foto: ${photoReview.details.creditRate.toLocaleString("de-DE")} %`:"⚠ Kreditkartengebühr nicht eindeutig erkannt – bitte manuell prüfen."} {photoReview.details?.debitShare!==undefined?`· Kartenanteil Debit: ${photoReview.details.debitShare.toLocaleString("de-DE")} %`:"· Kartenanteil nicht sicher erkannt."}</p>}
        <label className="checkbox-field"><input type="checkbox" checked={cardMixConfirmed} onChange={e=>setCardMixConfirmed(e.target.checked)}/> Kartenmix wurde anhand der Bestandsanalyse überprüft (auch bei unveränderter 80/20-Vorgabe)</label>
        <p className="hint">Nur ein bestätigter Kartenmix wird als Näherung für die Domestic-Vorauswahl verwendet. EC/Debit und Domestic sind unterschiedliche Kategorien.</p>
        <label className="checkbox-field"><input type="checkbox" checked={feeRatesConfirmed} onChange={e=>setFeeRatesConfirmed(e.target.checked)}/> Gebührensätze des Bestandsanbieters wurden anhand der Abrechnung geprüft (auch wenn die vorgeschlagenen Werte unverändert sind)</label>
        <p className="hint">Nur ein bestätigter EC-/Debit-Gebührensatz führt zu einer unverbindlichen Vorauswahl der nächstliegenden Sidekick-Kondition.</p>
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
        <label className="checkbox-field"><input type="checkbox" checked={noFixedTerm} onChange={e=>{const checked=e.target.checked;setNoFixedTerm(checked);if(checked)setSidekick(old=>withoutFixedTerm(old));}}/> Kein Laufzeitvertrag gewünscht</label>
        {noFixedTerm&&<p className="notice" role="status">Automatische Vorgabe für das Vergleichsangebot: Umsatzbasiertes Zahlen · 1,39 % pro Vor-Ort-Kartenzahlung · 0,00 € monatliche Tarifgrundgebühr. Plus-Lizenzen sind in diesem Modus deaktiviert.</p>}
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
        <section className="nx-fee-readiness" aria-label="Prüfung vor dem Vergleich">
          <h3>✅ Prüfung vor dem SumUp-Vergleich</h3>
          {readiness.missing.length?<>
            <p>Diese Angaben sind noch offen. Ohne sie wird kein Vergleichsangebot aus den angenommenen Ist-Gebühren erstellt.</p>
            <ul>{readiness.missing.map(item=><li key={item}>⚠ {item}</li>)}</ul>
          </>:<p className="nx-fee-ready">Alle Pflichtangaben für die Vergleichsvorbereitung sind erfasst. Stimmen die Werte mit der Abrechnung überein?</p>}
          <label className="checkbox-field">
            <input type="checkbox" checked={finalized}
              disabled={!readiness.ready}
              onChange={e=>setReviewedSignature(e.target.checked?reviewSignature:"")}/>
            Ich habe Anbieter, Kartenumsatz, Kartenmix und Ist-Gebühren mit der Abrechnung abgeglichen; nicht bestätigte Werte sind keine belegten Ist-Konditionen.
          </label>
          <p className="hint">Änderungen an den überprüften Werten heben die Freigabe automatisch auf. Eine gespeicherte Kundenakte ersetzt diese Prüfung nicht.</p>
        </section>
        {estimate.error&&<p className="error" role="alert">{estimate.error}</p>}
        <div className="button-row field-actions">
          <button className="secondary" onClick={()=>setStep(1)}><ArrowLeft size={15}/> Foto</button>
          <button className="secondary" disabled={saving||!customerId} onClick={()=>void persist()}>
            <Save size={15}/>{saving?"Speichern …":"Bestand speichern"}
          </button>
          <button className="primary" disabled={!finalized||!estimate.data||current.volume<=0} onClick={applyRecommendation}>
            Wünsche auswerten & Angebot konfigurieren <ArrowRight size={17}/>
          </button>
        </div>
        {notice&&<p role="status" className="notice">{notice}</p>}
      </Card>
    </>}
    {step===3&&finalized&&<>
      {advisor&&<Card title="Deine bedarfsbasierte SumUp-Konfiguration" eyebrow="ZUKUNFTSWÜNSCHE · NACHVOLLZIEHBARE EMPFEHLUNG"><p><strong>{packageName.title}</strong></p><p className="hint">{advisor.reasons.join(" ")}</p><p className="hint">{noFixedTerm?"Die Vorgabe ohne Laufzeitbindung hat Vorrang vor kostenpflichtigen Plus-Abos. Umsatzbasiertes Zahlen bleibt ausgewählt.":"Eine Plus-Variante wird durch den erfassten Bedarf bestimmt. Der Wechsel in der Matrix ersetzt die bisherige Plus-Auswahl; KDS ist eine passende Zusatzoption."}</p><button className="secondary" type="button" onClick={applyRecommendation}>Vorschlag erneut übernehmen</button></Card>}
      <SidekickMatrix value={effectiveSidekick} noFixedTerm={noFixedTerm} onChange={next=>setSidekick(normalizeSidekickSelection(noFixedTerm?{...next,licenses:[],campaignIndex:null,campaignAuthorized:false}:next))}/>
      <Card title="03 · Vergleichsangebot" eyebrow="IST-ANBIETER GEGEN SUMUP · MONATLICHE KOSTEN">
        <SidekickCampaignPicker value={effectiveSidekick} onChange={next=>setSidekick(normalizeSidekickSelection(noFixedTerm?withoutFixedTerm(next):next))} current={current} noFixedTerm={noFixedTerm} cardMixConfirmed={cardMixConfirmed} feeRatesConfirmed={feeRatesConfirmed}/>
        {!estimate.data?<p className="error" role="alert">{estimate.error}</p>:<>
          <div className="field-compare">
            <section><span className="eyebrow">BISHER</span><h3>{provider||"Aktueller Anbieter"}</h3>
              <strong>{money(estimate.data.oldTotal)}</strong><small>Gebühren / Monat</small>
              <p>{hardware==="Sonstiges"?otherHardware||"Sonstiges":hardware||"Bestandsgerät noch offen"}</p>
              <p>EC/Debit {current.debitShare}% · {current.debitRate}%<br/>Kredit/Premium {round(100-current.debitShare)}% · {current.creditRate}%</p>
              <p>Auszahlung: {payLabel[payout]}</p>
            </section>
            <section className="field-compare-new"><span className="eyebrow">ANGEBOT SUMUP</span><h3>{packageName.title}</h3>
              <strong>{money(estimate.data.sumupTotal)}</strong><small>Zahlungen und gewählte Software / Monat</small>
              <p>{selectedPlan==="plus"?"Zahlungen Plus: 0,79 % berechtigte EWR-Verbraucherkarten (Domestic) · 1,39 % andere Karten · 19 € pro Monat":effectiveSidekick.campaignIndex!==null&&effectiveSidekick.domesticShare!==null?"Sidekick-Simulation: "+sumupSidekickFees[effectiveSidekick.campaignIndex].domestic+" % Domestic · "+sumupSidekickFees[effectiveSidekick.campaignIndex].other+" % andere Karten (Freigabe prüfen)":"Öffentlich modelliert: Debit "+estimate.data.sumupDebit+"% · Kredit/Premium "+estimate.data.sumupCredit+"%"}</p>
              <p>Zahlungstarif: {packageName.payment} · Software: {packageName.software.join(", ")||"keine"}</p><p>Tarif und Software zusammen: {money(estimate.data.sumupBase)} / Monat</p>
              <p>Regulärer Hardwarepreis separat</p>
            </section>
          </div>
          <SumupAdvantage monthlyDifference={estimate.data.monthlyDifference} annualDifference={estimate.data.annualDifference} selection={effectiveSidekick} noFixedTerm={noFixedTerm}/>
          <p className="hint">{estimate.data.note} Bestehende Vertragsbindung und etwaige Wechselkosten sind nicht eingerechnet.</p>
        </>}
      </Card>
      <Card title="Passende SumUp-Variante & Hardware" eyebrow="BEDARF → ANALYSE → PRODUKTAUSWAHL → ANGEBOT">
        <div className="form-grid">
          <Field label="Gewählte Plus-Variante / Standard">
            <select disabled={noFixedTerm} value={effectiveSidekick.licenses.find(id=>["posplus","posannual","payments","beauty"].includes(id))||"standard"} onChange={e=>setSidekick(old=>e.target.value==="standard"?normalizeSidekickSelection({...old,licenses:old.licenses.filter(id=>!["posplus","posannual","payments","beauty"].includes(id))}):chooseSidekickLicense({...old,licenses:old.licenses.filter(id=>!["posplus","posannual","payments","beauty"].includes(id))},e.target.value))}>
              <option value="standard">Umsatzbasiertes Zahlen · 1,39 % · 0,00 € / Monat</option>
              <option value="payments">Zahlungen Plus · 19 € monatlich</option>
              <option value="posplus">Kassensystem Plus · 49 € monatlich</option>
              <option value="posannual">Kassensystem Plus jährlich · 588 € jährlich</option>
              <option value="beauty">Beauty Plus · 99 € monatlich</option>
            </select>
          </Field>
          {sidekick.hardware.length===0&&<>          <Field label="Passende SumUp-Hardware">
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
          <Field label="Hardware-Angebotspreis · netto"><strong className="field-computed">{money(hardwarePrice.offerNet)}</strong></Field></>}
        </div>
        {sidekick.hardware.length===0?<p className="hint">Ohne Geräteauswahl in der Matrix gilt der reguläre Hardwarevorschlag. Individueller Nachlass bis 25 %.</p>:<p className="hint">Die verbindliche Geräteauswahl und der Hardware-Rabatt befinden sich oben in der Sidekick-Matrix. Hier werden keine zusätzlichen Geräte berechnet.</p>}
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
