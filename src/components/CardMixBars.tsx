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
        <strong>ℹ️ Welche Karte gehört wohin?</strong>
        <p><b>EC / Debit</b> umfasst typischerweise girocard sowie Debitkarten, z. B. Visa Debit oder Debit Mastercard. <b>Kredit / Premium</b> umfasst je nach Abrechnung klassische Kreditkarten sowie häufig Firmen-, internationale und Premiumkarten wie American Express. Entscheidend ist immer die tatsächliche Kartenklassifizierung auf der Händlerabrechnung – nicht nur das Visa- oder Mastercard-Logo.</p>
        <p className="hint"><b>Wichtig:</b> Apple Pay und Google Pay sind keine eigene Kartenart. Für die Gebühr zählt die dahinter hinterlegte Karte. Eine Visa kann z. B. Debit oder Kredit, privat oder geschäftlich und im EWR oder außerhalb des EWR ausgegeben sein.</p>
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
        <strong>💳 So liest du die Gebühren richtig</strong>
        <p>Die beiden Werte unten sind die <b>Ist-Gebühren des bisherigen Anbieters</b>. Beispiel: Stehen auf der Abrechnung 1,39 % für Debit und 2,59 % für Kredit/Premium, werden die jeweiligen Transaktionen genau mit diesen dokumentierten Sätzen gerechnet. 2,59 % ist dabei <b>kein allgemeiner SumUp-Satz</b>.</p>
        <p className="hint"><b>SumUp aktuell:</b> Im umsatzbasierten Tarif kosten Vor-Ort-Kartenzahlungen grundsätzlich 1,39 %. Bei Zahlungen Plus gelten 0,79 % für vor Ort akzeptierte Verbraucherkarten aus dem EWR und 1,39 % für Nicht-EWR-, Firmen- und Premiumkarten, einschließlich American Express. Online-/Karte-nicht-präsent-Zahlungen werden separat mit 2,50 % behandelt. Vor einem verbindlichen Angebot immer die aktuelle SumUp-Preisseite prüfen.</p>
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