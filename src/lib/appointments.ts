export function berlinDateTime(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((v) => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function appointmentTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw Error("Gültigen Termin eingeben.");
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
  if (year < 1900 || year > 2100)
    throw Error("Terminjahr muss zwischen 1900 und 2100 liegen.");
  const utc = Date.UTC(year, month - 1, day, hour, minute);
  const candidates = [60, 120]
    .map((offset) => new Date(utc - offset * 60000).toISOString())
    .filter((iso) => berlinDateTime(iso) === value);
  if (candidates.length !== 1)
    throw Error(
      "Diese deutsche Ortszeit ist wegen Zeitumstellung ungültig oder doppeldeutig. Bitte eine andere Uhrzeit wählen.",
    );
  return candidates[0];
}
export const appointmentLabel = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
