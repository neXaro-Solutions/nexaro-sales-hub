/** Select existing form text when the user first focuses a field.
 * This preserves current data until the user actually starts typing,
 * and excludes passwords, dates, file inputs, search and read-only fields.
 */
export function installSelectOnFocus(): () => void {
  const handler = (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target.disabled || target.readOnly) return;
    if (target instanceof HTMLInputElement &&
      !["text", "email", "tel", "url", "number"].includes(target.type)) return;
    if (!target.value.trim()) return;
    try { target.select(); } catch { /* unsupported browser input type */ }
  };
  document.addEventListener("focusin", handler);
  return () => document.removeEventListener("focusin", handler);
}
