import {money} from "../lib/calculations";
import {sumupValueHighlights} from "../lib/sumup-value";
import type {SumupSidekickSelection} from "../lib/sumup-sidekick";

export function SumupAdvantage({monthlyDifference,annualDifference,selection,noFixedTerm=false}:{
 monthlyDifference:number;annualDifference:number;selection?:SumupSidekickSelection;noFixedTerm?:boolean;
}){
 const negative=monthlyDifference<-.005,positive=monthlyDifference>.005;
 const highlights=negative?sumupValueHighlights(selection,noFixedTerm):[];
 return <div className={"sumup-advantage "+(negative?"sumup-advantage-negative":positive?"sumup-advantage-positive":"sumup-advantage-even")}>
  <span className="sumup-advantage-label">SumUp Vorteil</span>
  <strong className="sumup-advantage-value">{money(monthlyDifference)} <span>/ Monat</span></strong>
  <small>{positive?"Rechnerische monatliche Ersparnis":negative?"Rechnerischer monatlicher Mehraufwand – keine Ersparnis":"Rechnerisch gleiche Monatskosten"} · auf 12 Monate: {money(annualDifference)}. Ohne einmalige Hardware- und Wechselkosten.</small>
  {negative&&<div className="sumup-advantage-value-panel">
   <b>✨ Mehrwert der gewählten SumUp-Lösung</b>
   {highlights.length?<ul>{highlights.map(label=><li key={label}>{label}</li>)}</ul>:
    <p>Gewünschte zusätzliche Funktionen und konkrete Hardware zuerst auswählen, damit hier nachvollziehbare Leistungen hervorgehoben werden können.</p>}
   <small>Funktionsumfang der ausgewählten Produkte – kein Nachweis, dass diese Leistungen beim bisherigen Anbieter fehlen. Der Kostenunterschied bleibt bestehen.</small>
  </div>}
 </div>;
}
