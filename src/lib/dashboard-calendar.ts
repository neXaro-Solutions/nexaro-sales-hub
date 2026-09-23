import { berlinDateTime } from "./appointments";
import type { Task } from "./types";

/** Stable Berlin business dates, independent of the phone's time-zone setting. */
export const calendarDay = (iso: string) => berlinDateTime(iso).slice(0, 10);
export const monthKey = (date: string) => date.slice(0, 7);
export function monthDays(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("Ungültiger Monat.");
  const [year, part] = month.split("-").map(Number);
  const length = new Date(Date.UTC(year, part, 0)).getUTCDate();
  const shift = (new Date(Date.UTC(year, part - 1, 1)).getUTCDay() + 6) % 7;
  return Array.from({ length: Math.ceil((shift + length) / 7) * 7 },
    (_, i) => i < shift || i >= shift + length ? null : month + "-" + String(i - shift + 1).padStart(2, "0"));
}
export function nextMonth(month: string, step: number) {
  const [year, part] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, part - 1 + step, 1));
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}
export function entriesOn(tasks: Task[], day: string) {
  return tasks.filter(t => !t.done && calendarDay(t.due_at) === day)
    .sort((a,b) => a.due_at.localeCompare(b.due_at));
}
