import { describe, expect, it } from "vitest";
import { appointmentTime, berlinDateTime } from "../src/lib/appointments";
import {
  checkDocumentPath,
  documentFolder,
  validateDocument,
  safeDocumentName,
  DOCUMENT_LIMIT,
} from "../src/lib/documents";
import {
  compareOffers,
  emptyMix,
  type ComparisonInput,
} from "../src/lib/sumup-sales";
describe("German appointment times", () => {
  it("uses German summer/winter time independently of the device timezone", () => {
    expect(appointmentTime("2026-09-20T14:30")).toBe(
      "2026-09-20T12:30:00.000Z",
    );
    expect(appointmentTime("2026-12-20T14:30")).toBe(
      "2026-12-20T13:30:00.000Z",
    );
    expect(berlinDateTime("2026-09-20T12:30:00Z")).toBe("2026-09-20T14:30");
  });
  it("rejects nonexistent, ambiguous or invalid dates", () => {
    for (const value of [
      "2026-03-29T02:30",
      "2026-10-25T02:30",
      "2026-02-31T10:00",
      "2026-13-01T10:00",
      "2026-09-20T99:00",
      "",
      "not a date",
    ])
      expect(() => appointmentTime(value)).toThrow();
  });
});
describe("Private documents", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  it("keeps paths inside the selected customer", () => {
    expect(documentFolder(id)).toBe(id);
    expect(checkDocumentPath(id, id + "/note.txt")).toBe(id + "/note.txt");
    for (const path of [
      "../note.txt",
      id + "/../other.txt",
      id + "/folder/name.txt",
      "other/note.txt",
    ])
      expect(() => checkDocumentPath(id, path)).toThrow();
    expect(() => documentFolder("demo-c1")).toThrow();
    expect(documentFolder("demo-c1", true)).toBe("demo-c1");
  });
  it("sanitizes unsafe filename characters", () => {
    expect(safeDocumentName("Notiz/Termin?.txt")).toBe("Notiz_Termin_.txt");
    expect(() => safeDocumentName(".hidden")).toThrow();
  });
  it("accepts supported documents and checks signatures", async () => {
    await expect(
      validateDocument(
        new File(["Kontaktvermerk"], "kontakt.txt", { type: "text/plain" }),
      ),
    ).resolves.toMatchObject({ mime: "text/plain" });
    await expect(
      validateDocument(
        new File(["%PDF-1.7\n"], "akte.pdf", { type: "application/pdf" }),
      ),
    ).resolves.toMatchObject({ name: "akte.pdf" });
    await expect(
      validateDocument(
        new File(["<script>"], "akte.pdf", { type: "application/pdf" }),
      ),
    ).rejects.toThrow("Dateiinhalt");
  });
  it("rejects executable types, type mismatch and oversized/empty files", async () => {
    for (const f of [
      new File(["x"], "x.html", { type: "text/html" }),
      new File(["x"], "x.txt", { type: "application/pdf" }),
      new File([], "x.txt"),
      new File([new Uint8Array(DOCUMENT_LIMIT + 1)], "x.txt"),
    ])
      await expect(validateDocument(f)).rejects.toThrow();
  });
});
describe("Sales studio regressions", () => {
  const input: ComparisonInput = {
    monthlyVolume: 5000,
    currentMonthly: 0,
    currentMode: "total",
    currentFixed: 15,
    currentVariablePercent: 1.5,
    currentTransactionCount: 200,
    currentPerTransaction: 0,
    mix: { ...emptyMix, domesticDebit: 5000 },
    splitConfirmed: true,
    hardware: [],
    hardwareDiscount: 0,
    subscriptions: [],
  };
  it("does not replace a confirmed zero-cost statement with formula charges", () => {
    expect(compareOffers(input).current).toBe(0);
    expect(compareOffers({ ...input, currentMode: "formula" }).current).toBe(
      90,
    );
  });
  it("rounds discounted unit prices before multiplying just like the offer", () => {
    const result = compareOffers({
      ...input,
      hardware: [{ id: "solo", quantity: 3, price: 0.05 }],
      hardwareDiscount: 25,
    });
    expect(result.hardwareNet).toBe(0.12);
  });
  it("does not silently price unknown selected hardware", () => {
    expect(() =>
      compareOffers({
        ...input,
        hardware: [{ id: "drawer", quantity: 1, price: null }],
      }),
    ).toThrow();
  });
  it("rejects overallocated card volume", () => {
    expect(() =>
      compareOffers({ ...input, mix: { ...emptyMix, domesticDebit: 5001 } }),
    ).toThrow();
  });
});
