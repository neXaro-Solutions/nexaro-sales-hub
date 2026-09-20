import { money } from "../lib/calculations";
import type { ExistingProviderInput, SumupPlan } from "../lib/fieldSalesComparison";

type RecordedComparison = {
  debit: number; credit: number; variableOld: number; fixedOld: number;
  calculatedOld: number; oldTotal: number; sumupDebit: number; sumupCredit: number;
  sumupBase: number; sumupVariable: number; sumupTotal: number;
  monthlyDifference: number; annualDifference: number;
};
type RecordedStudio = {
  current: ExistingProviderInput; provider?: string; competitorHardware?: string;
  otherHardware?: string; contract?: string; payout?: string; future?: string;
  plan: SumupPlan; comparison: RecordedComparison; checkedAt?: string; source?: string;
  sumupHardware?: string; quantity?: number;
};
const payoutLabels: Record<string,string> = {
  daily:"Täglich",weekly:"Wöchentlich",fortnightly:"Alle zwei Wochen",
  monthly:"Einmal im Monat",unknown:"Nicht angegeben"
};
const euroPercent = (n:number) => n.toLocaleString("de-DE",{maximumFractionDigits:2})+" %";

function readComparison(snapshot: Record<string,unknown> | undefined): RecordedStudio | null {
  const studio=snapshot?.salesStudio;
  if(!studio || typeof studio!=="object") return null;
  const data=studio as Partial<RecordedStudio>;
  if(!data.current || !data.comparison || (data.plan!=="plus"&&data.plan!=="standard"))
    return null;
  const c=data.comparison, i=data.current;
  const amounts=[c.debit,c.credit,c.variableOld,c.fixedOld,c.calculatedOld,c.oldTotal,
    c.sumupDebit,c.sumupCredit,c.sumupBase,c.sumupVariable,c.sumupTotal,
    c.monthlyDifference,c.annualDifference,i.volume,i.debitShare,i.debitRate,
    i.creditRate,i.serviceFee,i.terminalFee,i.perTransaction,i.transactions];
  return amounts.every(x=>typeof x==="number"&&Number.isFinite(x))
    ?data as RecordedStudio:null;
}

/** Payment-provider fees are a comparison, NOT neXaro invoiced sales lines. */
export function SumupOfferComparison({snapshot,compact=false}:{
  snapshot:Record<string,unknown>|undefined;compact?:boolean
}) {
  const studio=readComparison(snapshot);
  if(!studio) return null;
  const {current:c,comparison:a}=studio;
  const otherShare=100-c.debitShare;
  return <section className={"sumup-offer-comparison"+(compact?" sumup-offer-edit":"")}
    aria-label="Vergleich der Gebühren des Bestandsanbieters und der offiziellen SumUp-Tarife">
    <div className="sumup-offer-heading">
      <div><span className="eyebrow">KARTENZAHLUNGEN · KOSTENVERGLEICH</span>
      <h3>Bisheriger Anbieter / SumUp</h3></div>
      <span className="sumup-offer-tag">Monatliche Modellrechnung</span>
    </div>
    <p className="sumup-offer-intro">Verglichen werden {money(c.volume)} Kartenumsatz monatlich bei {c.transactions} Transaktionen.
      Die Zahlungskosten sind <strong>keine neXaro-Rechnungspositionen</strong>; die Hardware wird separat angeboten.</p>
    <div className="sumup-offer-scroll">
      <table className="sumup-offer-table">
        <thead><tr><th scope="col">Vergleich</th>
          <th scope="col">{studio.provider?.trim()||"Bisheriger Anbieter"}</th>
          <th scope="col">SumUp · {studio.plan==="plus"?"Zahlungen Plus":"Umsatzbasiertes Zahlen"}</th></tr></thead>
        <tbody>
          <tr><th scope="row">Debit / EC-Anteil</th><td>{euroPercent(c.debitShare)} · {money(a.debit)}</td><td>{euroPercent(c.debitShare)} · {money(a.debit)}</td></tr>
          <tr><th scope="row">Gebühr Debit / EC</th><td>{euroPercent(c.debitRate)}</td><td>{euroPercent(a.sumupDebit)}*</td></tr>
          <tr><th scope="row">Kredit-/Premiumanteil</th><td>{euroPercent(otherShare)} · {money(a.credit)}</td><td>{euroPercent(otherShare)} · {money(a.credit)}</td></tr>
          <tr><th scope="row">Gebühr Kredit / Premium</th><td>{euroPercent(c.creditRate)}</td><td>{euroPercent(a.sumupCredit)}**</td></tr>
          <tr><th scope="row">Variable Kartenkosten / Monat</th><td>{money(a.variableOld)}</td><td>{money(a.sumupVariable)}</td></tr>
          <tr><th scope="row">Grundgebühr / Service / Terminal / Transaktionen</th>
            <td>{money(a.fixedOld)} insgesamt</td><td>{money(a.sumupBase)} Tarifgrundgebühr</td></tr>
          {c.confirmedTotal!==null&&<tr><th scope="row">Geprüfte Ist-Gesamtgebühr laut Abrechnung</th>
            <td>{money(c.confirmedTotal)}</td><td>–</td></tr>}
          <tr className="sumup-offer-total"><th scope="row">Gesamtkosten / Monat</th>
            <td>{money(a.oldTotal)}</td><td>{money(a.sumupTotal)}</td></tr>
        </tbody>
      </table>
    </div>
    <div className="sumup-offer-difference">
      <span>Differenz bisher – SumUp</span><strong>{money(a.monthlyDifference)} / Monat</strong>
      <span>{money(a.annualDifference)} / Jahr (12 × Monatsdifferenz)</span>
    </div>
    <p className="sumup-offer-fineprint">* Offizieller SumUp-Tarif: Umsatzbasiertes Zahlen 1,39 % vor Ort, keine monatliche Grundgebühr; Zahlungen Plus 0,79 % für berechtigte EWR-Verbraucherkarten vor Ort, 19 € pro Monat bei monatlicher Abrechnung. ** Für Firmen-, Premium- und Nicht-EWR-Karten einschließlich Amex gelten 1,39 %. Die 20-%-Gruppe wird hier vorsichtig vollständig zu 1,39 % modelliert; enthaltene berechtigte Verbraucherkreditkarten können bei Zahlungen Plus zu 0,79 % abgerechnet werden. Online-Zahlungen (2,50 %), Rückerstattungen und individuelle Sonderkonditionen sind nicht Teil dieser Vor-Ort-Modellrechnung. Kartenmix und Gebühren vor Abschluss prüfen.</p>
    <p className="sumup-offer-fineprint">Berechnungsgrundlage: {studio.checkedAt||"Preisstand vor Versand prüfen"} · Offizielle SumUp-Preise: <a
      href="https://www.sumup.com/de-de/kartenterminals/" target="_blank" rel="noopener noreferrer">
      sumup.com/de-de/kartenterminals/</a>. Etwaige bestehende Vertragsbindung, Wechselkosten und Hardwareeinmalkosten sind nicht in der Monatsdifferenz enthalten.</p>
  </section>;
}
