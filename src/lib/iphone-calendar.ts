import type { Customer, Task } from "./types";
import { address } from "./calculations";

/** Private, on-device iCalendar transfer. Nothing is sent to an external calendar service. */
const escapeIcs = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\r\n?|\n/g, "\\n")
    .replace(/;/g, "\\;").replace(/,/g, "\\,");
const utc = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const folded = (line: string) => {
  const chunks: string[] = [];
  let current = "", bytes = 0;
  const encoder = new TextEncoder();
  for (const char of line) {
    const length = encoder.encode(char).length;
    if (bytes + length > 73 && current) {
      chunks.push(current);
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += length;
  }
  chunks.push(current);
  return chunks.join("\r\n");
};
export function calendarEvent(task: Task, customer?: Customer, minutes = 60) {
  const start = new Date(task.due_at);
  if (!Number.isFinite(start.valueOf()) || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440)
    throw Error("Für den Kalender ist eine gültige Terminzeit erforderlich.");
  const end = new Date(start.valueOf() + minutes * 60000);
  const where = customer ? address(customer) : "";
  const notes = [
    customer ? "Kunde: " + customer.company : "",
    customer?.contact ? "Kontakt: " + customer.contact : "",
    customer?.phone ? "Telefon: " + customer.phone : "",
    customer?.email ? "E-Mail: " + customer.email : "",
    task.division ? "Bereich: " + (task.division === "sumup" ? "SumUp" : "Vape") : "",
    task.notes || "",
    "CRM-Termin-ID: " + task.id,
  ].filter(Boolean).join("\n");
  const uid = task.id.replace(/[^a-zA-Z0-9-]/g, "") + "@crm.nexaro-solutions.de";
  const fields = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//neXaro Solutions//Sales Hub//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:" + uid,
    "SEQUENCE:" + Math.max(0, (task.version || 1) - 1),
    "DTSTAMP:" + utc(new Date(task.updated_at || task.created_at || task.due_at)),
    "DTSTART:" + utc(start),
    "DTEND:" + utc(end),
    "SUMMARY:" + escapeIcs(task.title + (customer ? " · " + customer.company : "")),
    ...(where ? ["LOCATION:" + escapeIcs(where)] : []),
    "DESCRIPTION:" + escapeIcs(notes),
    "STATUS:CONFIRMED",
    "CLASS:PRIVATE",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:neXaro Termin",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return fields.map(folded).join("\r\n") + "\r\n";
}

export async function exportCalendarEvent(task: Task, customer?: Customer, minutes = 60) {
  const content = calendarEvent(task, customer, minutes);
  const filename = "neXaro-Termin-" + task.id.replace(/[^a-zA-Z0-9-]/g, "") + ".ics";
  const file = new File([content], filename, { type: "text/calendar;charset=utf-8" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: task.title });
      return "shared";
    } catch (error) {
      if ((error as Error).name === "AbortError") return "cancelled";
      // A device may support a share sheet but reject .ics: offer a file instead.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.type = "text/calendar";
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    // Do not invalidate the Blob before mobile Safari has started downloading.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return "downloaded";
}
