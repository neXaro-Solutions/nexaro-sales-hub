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
 const currentIndex=noFixedTerm?0:value.campaignIndex;
 const auto=value.campaignSource==="estimate"&&currentIndex!==null;
 const update=(patch:Partial<SumupSidekickSelection>)=>onChange({...value,...patch,campaignAuthorized:false});
 return <section className="nxside-fees" aria-label="SumUp Konditionen im Vergleichsangebot">
  <h4>Gebührenkondition für den Vergleich</h4>
  <p className="hint">{noFixedTerm?
   "Ohne Laufzeitvertrag: Umsatzbasiertes Zahlen ist fest auf 1,39 % und 0 € monatliche Tarifgrundgebühr eingestellt.":
   "Identischen oder nächst niedrigeren Prozentsatz anhand des bestätigten bisherigen EC-/Debit-Satzes vorauswählen. Die Karten sind unverbindliche Sidekick-Referenzkonditionen, keine automatische Freigabe."}</p>
  {!noFixedTerm&&suggestion&&<p className="nxside-prefill" role="status">Analyse: bisher {current.debitRate.toLocaleString("de-DE",{maximumFractionDigits:2})} % → Vorschlag <strong>{suggestion.rate.toLocaleString("de-DE",{maximumFractionDigits:2})} % Domestic</strong>. {suggestion.explanation}</p>}
  {!noFixedTerm&&!suggestion&&<p className="hint" role="status">Keine bestätigten Gebührensätze aus der Bestandsanalyse: Bitte den gewünschten Satz manuell auswählen.</p>}
  <div className="nxside-fee-grid">{sumupSidekickFees.map((fee,index)=><button
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
  </button>)}</div>
  {!noFixedTerm&&currentIndex!==null&&<>
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
