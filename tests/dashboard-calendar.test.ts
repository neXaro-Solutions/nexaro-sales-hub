import { describe, expect, it } from "vitest";
import { calendarDay, monthDays, nextMonth, entriesOn } from "../src/lib/dashboard-calendar";
import type { Task } from "../src/lib/types";
const event = (id: string, date: string, done=false) => ({
 id, due_at: date, done, title:id,kind:"Termin",customer_id:null,division:null,
 created_at:date,updated_at:date,version:1
}) as Task;
describe("CRM dashboard calendar",()=>{
 it("shows German Monday-first months and correct leap days",()=>{
  const feb=monthDays("2028-02");
  expect(feb).toHaveLength(35);
  expect(feb[0]).toBeNull();
  expect(feb[1]).toBe("2028-02-01");
  expect(feb[29]).toBe("2028-02-29");
 });
 it("navigates December and January across years",()=>{
  expect(nextMonth("2026-12",1)).toBe("2027-01");
  expect(nextMonth("2026-01",-1)).toBe("2025-12");
 });
 it("groups by Berlin time across UTC midnight and excludes completed entries",()=>{
  const all=[event("a","2026-09-23T22:30:00Z"),event("b","2026-09-24T07:00:00Z"),event("c","2026-09-24T08:00:00Z",true)];
  expect(calendarDay(all[0].due_at)).toBe("2026-09-24");
  expect(entriesOn(all,"2026-09-24").map(x=>x.id)).toEqual(["a","b"]);
 });
 it("switches date correctly at the winter UTC boundary",()=>{
  expect(calendarDay("2026-12-01T23:30:00Z")).toBe("2026-12-02");
 });
});
