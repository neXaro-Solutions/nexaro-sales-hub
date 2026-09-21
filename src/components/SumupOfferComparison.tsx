import { money } from "../lib/calculations";
import { SumupAdvantage } from "./SumupAdvantage";
import {selectedPackageName} from "../lib/sumup-needs";
import {sumupSidekickFees,type SumupSidekickSelection} from "../lib/sumup-sidekick";
import type { ExistingProviderInput, SumupPlan } from "../lib/fieldSalesComparison";

type RecordedComparison = {
  debit:number; credit:number; variableOld:number; fixedOld:number; calculatedOld:number;
  oldTotal:number; sumupDebit:number; sumupCredit:number; sumupBase:number;
  sumupVariable:number; sumupTotal:number; monthlyDifference:number; annualDifference:number;
};
type HardwarePricing = {
  regularUnit:number; percent:number; discountedUnit:number; quantity:number;
  regularTotal:number; discountTotal:number; offerNet:number;
};
type RecordedStudio = {
  current:ExistingProviderInput; provider?:string; competitorHardware?:string;
  otherHardware?:string; contract?:string; payout?:string; future?:string; noFixedTerm?:boolean;
  plan:SumupPlan; comparison:RecordedComparison; checkedAt?:string; source?:string; sidekick?:SumupSidekickSelection;
  sumupHardware?:string; quantity?:number; hardwarePricing?:HardwarePricing;
};
const payoutLabels:Record<string,string> = {
  daily:"Täglich",weekly:"Wöchentlich",fortnightly:"Alle zwei Wochen",
  monthly:"Einmal im Monat",unknown:"Noch nicht erfasst"
};
const percent=(n:number)=>n.toLocaleString("de-DE",{maximumFractionDigits:2})+" %";
function readComparison(snapshot:Record<string,unknown>|undefined):RecordedStudio|null {
  const raw=snapshot?.salesStudio;
  if(!raw||typeof raw!=="object")return null;
  const studio=raw as Partial<RecordedStudio>;
  if(!studio.current||!studio.comparison||(studio.plan!=="standard"&&studio.plan!=="plus"))return null;
  const c=studio.current,a=studio.comparison;
  const required=[c.volume,c.transactions,c.debitShare,c.debitRate,c.creditRate,
    a.oldTotal,a.sumupTotal,a.sumupDebit,a.sumupCredit,a.sumupBase,
    a.monthlyDifference,a.annualDifference,a.variableOld,a.sumupVariable,a.fixedOld,a.debit,a.credit];
  return required.every(v=>typeof v==="number"&&Number.isFinite(v))?studio as RecordedStudio:null;
}
function deviceDetails(name:string) {
  if (/terminal/i.test(name))return "Eigenständiges SmartPOS mit integriertem Belegdrucker; Gerät und Funktionsumfang vor Abschluss prüfen.";
  if (/solo lite/i.test(name))return "Kartenleser mit Smartphone-Kopplung; kein integrierter Belegdrucker.";
  if (/solo/i.test(name))return "Eigenständiger mobiler Kartenleser; Belegdruck abhängig von Zubehör.";
  if (/tap to pay/i.test(name))return "Kontaktlose Zahlungen über ein kompatibles Smartphone; kein separates Terminal erforderlich.";
  if (/kasse/i.test(name))return "Kassenlösung; notwendige Softwarelizenzen und Zubehör gesondert prüfen.";
  return "Funktionsumfang und Zubehör vor Vertragsabschluss prüfen.";
}
/** The fee comparison is informative, not a neXaro invoice line. */
export function SumupOfferComparison({snapshot,compact=false}:{
  snapshot:Record<string,unknown>|undefined;compact?:boolean
}) {
  const studio=readComparison(snapshot);
  if(!studio)return null;
  const {current:c,comparison:a}=studio;
  const plan=studio.sidekick?selectedPackageName(studio.sidekick).title:(studio.plan==="plus"?"Zahlungen Plus":"Umsatzbasiertes Zahlen");
  const licenses=studio.sidekick?selectedPackageName(studio.sidekick).software:[];
  const campaign=studio.sidekick?.campaignIndex!==null&&studio.sidekick?.campaignIndex!==undefined&&studio.sidekick.domesticShare!==null?sumupSidekickFees[studio.sidekick.campaignIndex]:null;
  const previous=studio.provider?.trim()||"Bisheriger Anbieter";
  const device=studio.sumupHardware||"Gerät noch festlegen";
  const hardware=studio.hardwarePricing;
  const rows=[
    ["Monatskosten",money(a.oldTotal),money(a.sumupTotal)],
    ["EC / Debit",percent(c.debitRate),campaign?"Domestic: "+percent(campaign.domestic):percent(a.sumupDebit)],
    ["Kredit / Premium",percent(c.creditRate),campaign?"International / Premium / Corporate: "+percent(campaign.other)+"*":percent(a.sumupCredit)+"*"],
    ["Monatliche Grund-/Terminalgebühren",money(a.fixedOld),money(a.sumupBase)+" Zahlungstarif und gewählte Software"],
    ["Hardware",studio.competitorHardware==="Sonstiges"?(studio.otherHardware||"Sonstiges"):(studio.competitorHardware||"Nicht erfasst"),device],
    ["Vertragsbindung",studio.contract?.trim()||"Noch zu prüfen",studio.noFixedTerm?"Keine Laufzeitbindung gewünscht · Standard 1,39 % / 0 € Monat":"Laufzeit und Kündigung nach gewählter Lizenz prüfen"],
    ["Auszahlung",payoutLabels[studio.payout||"unknown"]||"Noch zu prüfen",studio.sidekick?.payout==="three"?"SumUp Konto: alle 3 Stunden (Sidekick)":studio.sidekick?.payout==="external"?"Externes Konto: laut Sidekick 3–5 Tage":"SumUp Konto: täglich (Sidekick)"],
  ];
  return <section className={"sumup-offer-comparison"+(compact?" sumup-offer-edit":"")}
    aria-label="Bisheriger Anbieter und gewählter SumUp-Tarif im Vergleich">
    <div className="sumup-offer-heading">
      <div><span className="eyebrow">VERGLEICHSANGEBOT</span><h3>Die Unterschiede auf einen Blick</h3></div>
      <span className="sumup-offer-tag">Tarif: {plan}</span>
    </div>
    <div className="sumup-quick-summary">
      <div><span>{previous} / Monat</span><strong>{money(a.oldTotal)}</strong></div>
      <div><span>SumUp {plan} / Monat (inkl. Software)</span><strong>{money(a.sumupTotal)}</strong></div>
    </div>
    <SumupAdvantage monthlyDifference={a.monthlyDifference} annualDifference={a.annualDifference} selection={studio.sidekick} noFixedTerm={studio.noFixedTerm}/>
    <h4 className="sumup-benefits-title">Leistungen & Vorteile gegenübergestellt</h4>
    <div className="sumup-benefits-grid" role="table" aria-label="Vorteile und Leistungen im Vergleich">
      <div className="sumup-benefits-row sumup-benefits-header" role="row">
        <span role="columnheader">Merkmal</span><span role="columnheader">{previous}</span>
        <span role="columnheader">SumUp · {plan}</span>
      </div>
      {rows.map(([label,oldValue,newValue])=>
        <div className="sumup-benefits-row" role="row" key={label}>
          <span role="rowheader">{label}</span><span role="cell">{oldValue}</span>
          <span role="cell">{newValue}</span>
        </div>)}
    </div>
    <div className="sumup-tariff-card">
      <strong>Ausgewählter Tarif: {plan}</strong>
      <span>{campaign?"Unverbindlich simuliert · Domestic: "+percent(campaign.domestic)+" · International / Premium / Corporate: "+percent(campaign.other):"Öffentlich · EC/Debit modelliert: "+percent(a.sumupDebit)+" · Kredit/Premium modelliert: "+percent(a.sumupCredit)}</span>
      {licenses.length>0&&<span>Enthaltene Software: {licenses.join(", ")} · zusätzlich zum Zahlungstarif</span>}
      <span>Monatliche Grundgebühren inkl. Software: {money(a.sumupBase)} / Monat · Kartenumsatz: {money(c.volume)} / Monat</span>
      <span>{campaign?"Sidekick-Modellkondition: Vor Abschluss individuelle Freigabe durch SumUp erforderlich; Domestic-Anteil separat erfasst.":studio.plan==="plus"?
        "0,79 % gelten für berechtigte EWR-Verbraucherkarten; Firmen-/Premium-/Nicht-EWR-Karten einschließlich Amex 1,39 %.":
        "1,39 % für Vor-Ort-Zahlungen im Standardtarif, ohne monatliche Tarifgrundgebühr."}</span>
    </div>
    <div className="sumup-hardware-summary">
      <strong>Vergleichbares SumUp-Gerät: {device}</strong>
      <span>{deviceDetails(device)}</span>
      {hardware&&<span>Regulär {money(hardware.regularTotal)} netto · Rabatt {hardware.percent} % ({money(hardware.discountTotal)}) · Hardware-Angebot {money(hardware.offerNet)} netto</span>}
    </div>
    {studio.future?.trim()&&<p className="sumup-wishes"><strong>Händlerwunsch:</strong> {studio.future}</p>}
    <details className="sumup-offer-details" open={!compact}>
      <summary>Gebührenrechnung & Tarifhinweise {compact?"anzeigen":""}</summary>
      <div className="sumup-offer-scroll"><table className="sumup-offer-table">
        <thead><tr><th>Rechenbasis</th><th>{previous}</th><th>SumUp</th></tr></thead>
        <tbody>
          <tr><th>Debitanteil</th><td>{percent(c.debitShare)} · {money(a.debit)}</td><td>{percent(c.debitShare)}</td></tr>
          <tr><th>Kredit-/Premiumanteil</th><td>{percent(100-c.debitShare)} · {money(a.credit)}</td><td>{percent(100-c.debitShare)}</td></tr>
          <tr><th>Variable Kartenkosten</th><td>{money(a.variableOld)}</td><td>{money(a.sumupVariable)}</td></tr>
          <tr><th>Grund-/Service-/Terminalgebühren</th><td>{money(a.fixedOld)}</td><td>{money(a.sumupBase)}</td></tr>
          {c.confirmedTotal!=null&&<tr><th>Ist-Gesamtgebühr laut Beleg</th><td>{money(c.confirmedTotal)}</td><td>–</td></tr>}
          <tr className="sumup-offer-total"><th>Gesamtkosten / Monat</th><td>{money(a.oldTotal)}</td><td>{money(a.sumupTotal)}</td></tr>
        </tbody>
      </table></div>
      <p className="sumup-offer-fineprint">* Die modellierte 20-%-Gruppe wird im Standardvergleich mit 1,39 % berechnet. Für ausgewählte Sidekick-Gebühren gilt der gesondert erfasste Domestic-/Sonderkartenmix; dieser kann vom Debit-/Kredit-Mix abweichen. Ohne bestätigte Kartengruppen handelt es sich um eine Näherung. Online-Zahlungen können gesonderten Gebühren unterliegen (Sidekick-Modell: 2,50 %). SumUp-Kartenzahlungen mit persönlicher SumUp-Karte können 0 % Transaktionsgebühr haben. Individuelle Sonderkonditionen, steuerliche Behandlung und Auszahlungsweg vor verbindlicher Zusage prüfen.</p>
      <p className="sumup-offer-fineprint">Preisstand der CRM-Referenzdaten: {studio.checkedAt||"vor Versand prüfen"} · <a target="_blank" rel="noopener noreferrer" href="https://www.sumup.com/de-de/preise/">Offizielle SumUp-Gebühren</a> · <a target="_blank" rel="noopener noreferrer" href="https://www.sumup.com/de-de/kartenterminals/">Hardwaredetails</a>.</p>
    </details>
  </section>;
}
