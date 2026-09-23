import {sumupSidekickFees,type SumupSidekickSelection} from "../lib/sumup-sidekick";
import type {ExistingProviderInput} from "../lib/fieldSalesComparison";
import {deriveCampaignPrefill,deriveDomesticShare} from "../lib/sumup-needs";
import "../sidekick-matrix.css";

type Props={
 value:SumupSidekickSelection;
 onChange:(value:SumupSidekickSelection)=>void;
 current:ExistingProviderInput;
 noFixedTerm:boolean;
 cardMixConfirmed:boolean;
 feeRatesConfirmed:boolean;
};
export function SidekickCampaignPicker({value,onChange,current,noFixedTerm,cardMixConfirmed,feeRatesConfirmed}:Props){
 const suggestion=deriveCampaignPrefill(current.debitRate,feeRatesConfirmed);
 const mix=deriveDomesticShare({debitShare:current.debitShare,cardMixConfirmed});
 const plusSelected=value.licenses.includes("payments")&&!noFixedTerm;
 const currentIndex=noFixedTerm?0:value.campaignIndex;
 const auto=value.campaignSource==="estimate"&&currentIndex!==null;
 const update=(patch:Partial<SumupSidekickSelection>)=>onChange({...value,...patch,campaignAuthorized:false});
 return <section className="nxside-fees" aria-label="SumUp Konditionen im Vergleichsangebot">
  <h4>Gebührenkondition für den Vergleich</h4>
  {plusSelected&&<div className="nxside-prefill" role="status">
   <strong>✓ Zahlungen Plus · 19 € pro Monat · Domestic 0,79 %</strong>
   <p>0,79 % für berechtigte EWR-Verbraucherkarten bei Zahlung vor Ort; nicht berechtigte Karten, Firmen-/Premiumkarten einschließlich Amex: 1,39 %; Online: 2,50 %.</p>
   <p>Dieser Domestic-Satz gehört automatisch zum gewählten Tarif. Die gesonderten Sidekick-Referenzkonditionen sind dafür nicht auswählbar.</p>
  </div>}
  {!plusSelected&&<p className="hint">{noFixedTerm?
   "Ohne Laufzeitvertrag: Umsatzbasiertes Zahlen ist fest auf 1,39 % und 0 € monatliche Tarifgrundgebühr eingestellt.":
   "Sidekick-Referenzkonditionen für individuelle Angebote. Keine automatische Freigabe; sie gelten nicht zusätzlich zu Zahlungen Plus."}</p>}
  {!noFixedTerm&&!plusSelected&&suggestion&&<p className="nxside-prefill" role="status">Analyse: bisher {current.debitRate.toLocaleString("de-DE",{maximumFractionDigits:2})} % → Vorschlag <strong>{suggestion.rate.toLocaleString("de-DE",{maximumFractionDigits:2})} % Domestic</strong>. {suggestion.explanation}</p>}
  {!noFixedTerm&&!plusSelected&&!suggestion&&<p className="hint" role="status">Keine bestätigten Gebührensätze aus der Bestandsanalyse: Bitte den gewünschten Satz manuell auswählen.</p>}
  {!plusSelected&&  <div className="nxside-fee-grid">{sumupSidekickFees.map((fee,index)=><button
   className={"nxside-fee-card "+(currentIndex===index?"selected":"")}
   key={fee.domestic}
   type="button"
   aria-pressed={currentIndex===index}
   disabled={noFixedTerm}
   onClick={()=>update({campaignIndex:index,campaignSource:"manual"})}>
   <strong>{fee.domestic.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})} % <span>Domestic</span></strong>
   <small>International / Premium / Firmenkarten: {fee.other.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})} %</small>
   <small>Karte nicht anwesend: {fee.online.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})} %</small>
   {currentIndex===index&&<b>{noFixedTerm?"✓ Standard ohne Laufzeit":auto?"✓ Automatisch vorausgewählt":"✓ Manuell ausgewählt"}</b>}
  </button>)}</div>}
  {!noFixedTerm&&!plusSelected&&currentIndex!==null&&<>
   <label className="nxside-field">Domestic-Anteil am Vor-Ort-Umsatz (%)
    <input type="number" min="0" max="100" step="0.1" placeholder="Wert manuell eingeben" value={value.domesticShare??""}
      onChange={e=>update({domesticShare:e.target.value===""?null:Number(e.target.value),domesticShareSource:"manual"})}/>
   </label>
   {value.domesticShareSource==="estimate"&&<p className="hint">⚠️ Näherung aus dem bestätigten EC-/Debit-Kartenmix ({mix?.value??value.domesticShare} %), kein verifizierter Domestic-Anteil. Bitte vor Abschluss prüfen.</p>}
   {value.domesticShare===null&&<p className="hint">Domestic-Anteil fehlt: Bis zur Eingabe bleibt die öffentliche Standardgebühr die Vergleichsbasis. Eine Sidekick-Kondition wird nicht ungeprüft als Ersparnis berechnet.</p>}
   <p className="hint">Gebührenvorauswahl und Gebührenberechnung sind unverbindliche Simulationen. Individuelle Sonderkonditionen müssen für den Händler von SumUp freigegeben werden.</p>
  </>}
 </section>;
}
