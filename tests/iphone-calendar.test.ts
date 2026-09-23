import { describe, expect, it } from "vitest";
import { calendarEvent } from "../src/lib/iphone-calendar";
import type { Customer, Task } from "../src/lib/types";

const task: Task = {
  id: "a0ab-3949", version: 3,
  created_at: "2026-09-23T10:00:00Z",
  updated_at: "2026-09-23T10:15:00Z",
  title: "SumUp Besuch; Beratung",
  kind: "Termin",
  customer_id: "client-1",
  division: "sumup",
  notes: "POS, Kiosk\nGespräch über Tarif",
  due_at: "2026-12-01T09:00:00Z",
  done: false,
};
const customer = {
  id: "client-1", company: "Café Müller", contact: "Max Mustermann",
  phone: "0171 123456", email: "max@cafe.example",
  street: "Kirchstraße 1A", zip: "15757", city: "Halbe",
} as Customer;
const unfolded = (s:string) => s.replace(/\r\n /g,"");

describe("iPhone calendar .ics export", () => {
 it("carries stable appointment UID, UTC dates, location and alarm", () => {
  const s=unfolded(calendarEvent(task,customer,90));
  expect(s).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
  expect(s).toContain("UID:a0ab-3949@crm.nexaro-solutions.de");
  expect(s).toContain("SEQUENCE:2");
  expect(s).toContain("DTSTART:20261201T090000Z");
  expect(s).toContain("DTEND:20261201T103000Z");
  expect(s).toContain("TRIGGER:-PT30M");
  expect(s).toContain("LOCATION:Kirchstraße 1A\\, 15757 Halbe");
  expect(s).toContain("SUMMARY:SumUp Besuch\\; Beratung · Café Müller");
  expect(s).toContain("Kunde: Café Müller\\nKontakt: Max Mustermann");
  expect(s).toContain("POS\\, Kiosk\\nGespräch über Tarif");
  expect(s).not.toMatch(/(?<!\r)\n/);
 });
 it("does not require a customer", () => {
  const s=calendarEvent({...task,customer_id:null},undefined,60);
  expect(s).not.toContain("LOCATION:");
  expect(s).toContain("DTEND:20261201T100000Z");
 });
 it("validates invalid appointment and duration", () => {
  expect(() => calendarEvent({...task,due_at:"invalid"})).toThrow();
  expect(() => calendarEvent(task,customer,0)).toThrow();
 });
 it("folds unicode ICS lines by bytes", () => {
  const long=calendarEvent({...task,title:"Ä".repeat(100)});
  for (const line of long.trimEnd().split("\r\n"))
   expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
 });
});
