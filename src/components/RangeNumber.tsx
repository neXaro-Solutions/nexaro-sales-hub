import { EditableNumberInput } from "./EditableNumberInput";

/** Coarse slider + precise numeric input share a single state, suitable for one-handed field visits. */
export function RangeNumber({ label, value, onChange, min=0, max, step=1, unit="" }: {
  label:string;value:number;onChange:(next:number)=>void;min?:number;max:number;step?:number;unit?:string;
}) {
  const sliderMax=Math.max(max,Math.ceil(value/step)*step || max);
  return <div className="field range-field">
    <span>{label}</span>
    <div className="range-field-values">
      <input type="range" min={min} max={sliderMax} step={step} value={Math.min(sliderMax,Math.max(min,value))}
        aria-label={label+" Schieberegler"} onChange={e=>onChange(Number(e.target.value))}/>
      <EditableNumberInput min={min} step={step} value={value}
        aria-label={label+" manuell eingeben"} inputMode="decimal"
        onChange={e=>onChange(e.target.value===""?0:Number(e.target.value))}/>
      <span aria-hidden="true">{unit}</span>
    </div>
  </div>;
}
