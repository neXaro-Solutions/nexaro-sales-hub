import { useState, type InputHTMLAttributes } from "react";

/** Allows clearing a controlled numeric field without React restoring 0 on every keystroke.
 * Existing non-zero values are selected on focus, so typing replaces them immediately.
 * Merely focusing a field never changes the persisted value.
 */
export function EditableNumberInput({
  value, onChange, onFocus, onBlur, ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "type"> & {
  value: number | string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input
    {...props}
    type="number"
    value={draft ?? value}
    onFocus={e => {
      setDraft(Number(value) === 0 ? "" : String(value));
      if (Number(value) !== 0) e.currentTarget.select();
      onFocus?.(e);
    }}
    onChange={e => {
      setDraft(e.currentTarget.value);
      onChange?.(e);
    }}
    onBlur={e => {
      setDraft(null);
      onBlur?.(e);
    }}
  />;
}
