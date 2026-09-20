import { RangeNumber } from "./RangeNumber";

type Props = {
  debitShare:number;debitRate:number;creditRate:number;
  onDebitShare:(value:number)=>void;onDebitRate:(value:number)=>void;onCreditRate:(value:number)=>void;
};
const format=(value:number)=>value.toLocaleString("de-DE",{maximumFractionDigits:2});
/** A segmented card-mix and fee-rate control: percentages stay editable and in sync. */
export function CardMixBars({debitShare,debitRate,creditRate,onDebitShare,onDebitRate,onCreditRate}:Props){
  const debit=Math.max(0,Math.min(100,Number.isFinite(debitShare)?debitShare:80));
  const credit=100-debit;
  const rates=debitRate+creditRate;
  const debitWidth=rates>0?Math.max(0,Math.min(100,debitRate/rates*100)):50;
  return <div className="mix-bars">
    <div className="mix-section">
      <div className="mix-section-heading"><strong>Kartenmix</strong><span>Verteilung des monatlichen Kartenumsatzes</span></div>
      <div className="mix-segmented" role="img" aria-label={`EC und Debit ${format(debit)} Prozent; Kredit und Premium ${format(credit)} Prozent`}>
        <div className="mix-segment mix-debit" style={{width:debit+"%"}}>{debit>=15&&<b>{format(debit)} %</b>}</div>
        <div className="mix-segment mix-credit" style={{width:credit+"%"}}>{credit>=15&&<b>{format(credit)} %</b>}</div>
      </div>
      <div className="mix-legend"><span><i className="mix-dot mix-orange"/>EC / Debit <b>{format(debit)} %</b></span>
        <span><i className="mix-dot mix-green"/>Kredit / Premium (Amex) <b>{format(credit)} %</b></span></div>
      <RangeNumber label="EC-/Debit-Anteil anpassen (Kreditkartenanteil automatisch)" value={debit}
        min={0} max={100} step={1} unit="%" onChange={onDebitShare}/>
    </div>
    <div className="mix-section">
      <div className="mix-section-heading"><strong>Gebührensätze</strong><span>Bisheriger Anbieter · jederzeit anpassbar</span></div>
      <div className="mix-segmented" role="img" aria-label={`Gebühr EC und Debit ${format(debitRate)} Prozent; Kredit und Premium ${format(creditRate)} Prozent`}>
        <div className="mix-segment mix-debit" style={{width:debitWidth+"%"}}>{debitWidth>=18&&<b>{format(debitRate)} %</b>}</div>
        <div className="mix-segment mix-credit" style={{width:(100-debitWidth)+"%"}}>{100-debitWidth>=18&&<b>{format(creditRate)} %</b>}</div>
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
