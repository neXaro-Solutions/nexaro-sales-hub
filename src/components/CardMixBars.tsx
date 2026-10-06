import { useEffect, useRef, useState } from "react";
import { RangeNumber } from "./RangeNumber";
import { getMonthlyTransactions, subscribeMonthlyTransactions } from "../lib/monthlyTransactions";

type Props = {
  debitShare:number;debitRate:number;creditRate:number;
  onDebitShare:(value:number)=>void;onDebitRate:(value:number)=>void;onCreditRate:(value:number)=>void;
};
const format=(value:number)=>value.toLocaleString("de-DE",{maximumFractionDigits:2});
const whole=(value:number)=>Math.max(0,Math.round(Number.isFinite(value)?value:0));
/** Transaction-led card mix: visible values are counts; percentage shares stay internal for calculations. */
export function CardMixBars({debitShare,debitRate,creditRate,onDebitShare,onDebitRate,onCreditRate}:Props){
  const [transactions,setTransactions]=useState(()=>getMonthlyTransactions());
  const previousTransactions=useRef(transactions);
  useEffect(()=>{
    const unsubscribe=subscribeMonthlyTransactions((value,source)=>{
      const previous=previousTransactions.current;
      previousTransactions.current=value;
      setTransactions(value);
      if(source==="user"&&previous<=0&&value>0)onDebitShare(90);
    });
    return ()=>{unsubscribe();};
  },[onDebitShare]);

  const debit=Math.max(0,Math.min(100,Number.isFinite(debitShare)?debitShare:90));
  const credit=100-debit;
  const total=whole(transactions);
  const debitTransactions=total?Math.min(total,Math.max(0,Math.round(total*debit/100))):0;
  const creditTransactions=Math.max(0,total-debitTransactions);
  const debitWidth=total?debitTransactions/total*100:90;
  const creditWidth=100-debitWidth;
  const rates=debitRate+creditRate;
  const feeDebitWidth=rates>0?Math.max(0,Math.min(100,debitRate/rates*100)):50;
  const setDebitTransactions=(value:number)=>{
    const next=Math.min(total,Math.max(0,whole(value)));
    onDebitShare(total?next/total*100:90);
  };

  return <div className="mix-bars">
    <div className="mix-section">
      <div className="mix-section-heading"><strong>Kartenmix</strong><span>Verteilung der monatlichen Transaktionen</span></div>

      <div className="notice" role="note">
        <strong>💳 Karten auf einen Blick einordnen</strong>
        <p>Für die Gebühr zählt nicht nur das Logo auf der Karte. Entscheidend sind <b>Kartenprodukt, Karteninhaber und Ausstellungsregion</b>. Eine Visa oder Mastercard kann deshalb in unterschiedliche Gebührenkategorien fallen.</p>
        <div className="nx-card-fee-map">
          <article className="nx-card-fee-card nx-card-fee-low">
            <span className="nx-card-fee-rate">0,79 %</span>
            <strong>Zahlungen Plus · begünstigte Karten</strong>
            <p><b>Vor-Ort-Zahlungen mit im EWR ausgestellten Verbraucherkarten.</b> Das sind Debit- oder Kreditkarten, die auf eine Privatperson ausgestellt sind – nicht auf ein Unternehmen.</p>
            <small>Typisch: private girocard/EC, private Visa Debit, Debit Mastercard oder private Kreditkarte aus Deutschland/EWR – sofern SumUp sie entsprechend klassifiziert.</small>
          </article>
          <article className="nx-card-fee-card nx-card-fee-standard">
            <span className="nx-card-fee-rate">1,39 %</span>
            <strong>Standard / Plus-Sondergruppe</strong>
            <p>Im Standardtarif gilt 1,39 % für Vor-Ort-Zahlungen. Bei Zahlungen Plus gilt 1,39 % weiterhin für <b>Nicht-EWR-, Firmen- und Premiumkarten</b>.</p>
            <small>SumUp nennt ausdrücklich American Express, JCB und Diners Club in dieser Gruppe.</small>
          </article>
          <article className="nx-card-fee-card nx-card-fee-current">
            <span className="nx-card-fee-rate">z. B. 2,59 %</span>
            <strong>Nur Ist-Satz des bisherigen Anbieters</strong>
            <p>Dieser Wert wird nur verwendet, wenn er <b>tatsächlich auf der bestehenden Händlerabrechnung</b> steht.</p>
            <small>2,59 % ist aktuell kein fester SumUp-Premiumkartensatz.</small>
          </article>
        </div>
        <details className="nx-premium-explainer">
          <summary>Was bedeutet „Premiumkarte“?</summary>
          <div>
            <p><b>Premium</b> ist eine Kartenklassifizierung – nicht einfach „jede Kreditkarte“. Ob eine Karte als Premium gilt, hängt vom konkreten Kartenprodukt und der Einstufung durch Kartenorganisation/Issuer bzw. Zahlungsdienstleister ab.</p>
            <p><b>Wichtig:</b> Firmen-/Corporate-Karten und außerhalb des EWR ausgegebene Karten sind eigene Kriterien, landen bei SumUp Zahlungen Plus aber ebenfalls in der 1,39-%-Gruppe. American Express, JCB und Diners Club nennt SumUp ausdrücklich als Beispiele dieser höheren Gebührenkategorie.</p>
            <p className="hint">Gold, Platinum, Infinite o. Ä. nicht allein aufgrund des Namens automatisch zuordnen. Maßgeblich ist die tatsächliche Kartenklassifizierung in Abrechnung bzw. Zahlungsdaten.</p>
          </div>
        </details>
        <p className="hint"><b>Apple Pay / Google Pay:</b> keine eigene Kartenart. Es zählt die dahinter hinterlegte Karte.</p>
      </div>

      {total>0?<>
        <div className="mix-segmented" role="img" aria-label={`EC und Debit ${debitTransactions} Transaktionen; Kredit und Premium ${creditTransactions} Transaktionen`}>
          <div className="mix-segment mix-debit" style={{width:debitWidth+"%"}}>{debitWidth>=15&&<b>{debitTransactions.toLocaleString("de-DE")}</b>}</div>
          <div className="mix-segment mix-credit" style={{width:creditWidth+"%"}}>{creditWidth>=15&&<b>{creditTransactions.toLocaleString("de-DE")}</b>}</div>
        </div>
        <div className="mix-legend"><span><i className="mix-dot mix-orange"/>EC / Debit <b>{debitTransactions.toLocaleString("de-DE")} Transaktionen</b></span>
          <span><i className="mix-dot mix-green"/>Kredit / Premium (Amex) <b>{creditTransactions.toLocaleString("de-DE")} Transaktionen</b></span></div>
        <RangeNumber label="EC-/Debit-Transaktionen anpassen (Premium automatisch)" value={debitTransactions}
          min={0} max={Math.max(1,total)} step={1} onChange={setDebitTransactions}/>
        <p className="hint">Die prozentuale Aufteilung wird daraus automatisch im Hintergrund berechnet und für Gebührenvergleich und Empfehlung verwendet.</p>
      </>:<p className="hint">Bitte zuerst oben die <strong>Transaktionen pro Monat</strong> eintragen. Beim ersten Eintrag wird der Kartenmix automatisch mit 90 % EC/Debit und 10 % Kredit/Premium vorbelegt.</p>}
    </div>

    <div className="mix-section">
      <div className="mix-section-heading"><strong>Gebührensätze</strong><span>Bisheriger Anbieter · jederzeit anpassbar</span></div>
      <div className="notice" role="note">
        <strong>ℹ️ Bestehende Gebühren ≠ SumUp-Gebühren</strong>
        <p>Die beiden Werte unten sind ausschließlich die <b>Ist-Gebühren des bisherigen Anbieters</b>. Wenn eine Händlerabrechnung z. B. 1,39 % und 2,59 % ausweist, rechnen wir exakt mit diesen dokumentierten Werten – unabhängig davon, wie SumUp aktuell bepreist.</p>
        <p className="hint"><b>SumUp aktuell:</b> Standardtarif 1,39 % für Vor-Ort-Zahlungen. Zahlungen Plus: 0,79 % für EWR-Verbraucherkarten; 1,39 % für Nicht-EWR-, Firmen- und Premiumkarten einschließlich American Express, JCB und Diners Club. Karte-nicht-präsent/Online: 2,50 %. Vor Angebot aktuelle SumUp-Konditionen erneut prüfen.</p>
      </div>
      <div className="mix-segmented" role="img" aria-label={`Gebühr EC und Debit ${format(debitRate)} Prozent; Kredit und Premium ${format(creditRate)} Prozent`}>
        <div className="mix-segment mix-debit" style={{width:feeDebitWidth+"%"}}>{feeDebitWidth>=18&&<b>{format(debitRate)} %</b>}</div>
        <div className="mix-segment mix-credit" style={{width:(100-feeDebitWidth)+"%"}}>{100-feeDebitWidth>=18&&<b>{format(creditRate)} %</b>}</div>
      </div>
      <div className="mix-legend"><span><i className="mix-dot mix-orange"/>EC / Debit <b>{format(debitRate)} %</b></span>
        <span><i className="mix-dot mix-green"/>Kredit / Premium <b>{format(creditRate)} %</b></span></div>
      <div className="mix-rate-controls">
        <RangeNumber label="EC-/Debit-Gebühr" value={debitRate} min={0} max={5} step={0.01} unit="%" onChange={onDebitRate}/>
        <RangeNumber label="Kredit-/Premium-Gebühr" value={creditRate} min={0} max={5} step={0.01} unit="%" onChange={onCreditRate}/>
      </div>
    </div>
  </div>;
}
