import { describe, it, expect } from "vitest";
import {
  paymentAnalysis,
  margin,
  offerTotals,
  orderStops,
  mapsRoutes,
  distance,
  type PaymentInput,
} from "../src/lib/calculations";
import {
  parseCsv,
  decimal,
  mapProducts,
  type ColumnMap,
} from "../src/lib/import";
import { validatePayload } from "../supabase/functions/nx-public-intake/validation";
const base: PaymentInput = {
  volume: 10000,
  eligibleShare: 80,
  freeShare: 0,
  onlineVolume: 0,
  transactions: 100,
  currentRate: 1.5,
  currentFixed: 10,
  currentPerTransaction: 0.1,
  hardware: 59,
  targetVolume: 12000,
};
describe("Payment economics", () => {
  it("applies reduced fees only to eligible cards and includes hardware once", () => {
    const r = paymentAnalysis(base);
    expect(r.standard).toBe(139);
    expect(r.plus).toBe(110);
    expect(r.current).toBe(170);
    expect(r.annualSavings).toBe(661);
    expect(r.firstYear).toBe(1379);
    expect(r.breakEven).toBeCloseTo(3958.333);
  });
  it("keeps SumUp cards free and online volume separate", () => {
    const r = paymentAnalysis({
      ...base,
      eligibleShare: 70,
      freeShare: 10,
      onlineVolume: 1000,
    });
    expect(r.standard).toBe(150.1);
    expect(r.plus).toBe(127.1);
  });
  it("handles a zero eligible share without inventing break-even", () => {
    const r = paymentAnalysis({ ...base, eligibleShare: 0 });
    expect(r.breakEven).toBeNull();
    expect(r.recommended).toBe("Umsatzbasiert");
  });
  it("does not claim savings where previous plan is cheaper", () => {
    expect(
      paymentAnalysis({
        ...base,
        currentRate: 0,
        currentFixed: 0,
        currentPerTransaction: 0,
      }).savings,
    ).toBeLessThan(0);
  });
  it("rejects impossible card mixes and nonfinite/negative amounts", () => {
    expect(() => paymentAnalysis({ ...base, freeShare: 30 })).toThrow();
    expect(() => paymentAnalysis({ ...base, volume: NaN })).toThrow();
    expect(() => paymentAnalysis({ ...base, volume: -1 })).toThrow();
  });
});
describe("Trade calculations", () => {
  it("distinguishes margin from markup and subtracts shipping once", () => {
    expect(margin(4, 10, 10, 5)).toEqual({
      profit: 55,
      margin: 60,
      markup: 150,
      revenue: 100,
      cost: 45,
    });
  });
  it("handles free or zero-sale items without NaN", () => {
    expect(margin(0, 0).margin).toBeNull();
    expect(margin(0, 0).markup).toBeNull();
  });
  it("rounds VAT per line consistently and rejects invalid quantities", () => {
    expect(
      offerTotals([
        { name: "A", quantity: 3, price: 0.99, vat: 19 },
        { name: "B", quantity: 1, price: 10, vat: 7 },
      ]),
    ).toEqual({ net: 12.97, gross: 14.23, vat: 1.26 });
    expect(() =>
      offerTotals([{ name: "A", quantity: 0, price: 1, vat: 19 }]),
    ).toThrow();
  });
});
describe("CSV import validation", () => {
  const mapping: ColumnMap = {
    sku: "sku",
    name: "name",
    ek_net: "ek",
    vk_net: "vk",
    ean: "ean",
    category: "",
    stock: "stock",
    pack_size: "ve",
  };
  it("parses semicolon CSV with quoted delimiters, escaped quotes and multiline cells", () => {
    const r = parseCsv(
      '\uFEFFsku;name;ek;vk\r\n01;"Pod; \"\"Mint\"\"\nEdition";4,50;7,50',
    );
    expect(r.rows[0].name).toBe('Pod; "Mint"\nEdition');
    expect(decimal(r.rows[0].ek)).toBe(4.5);
    expect(decimal("1.234,56 €")).toBe(1234.56);
  });
  it("retains leading zeroes and unknown stock", () => {
    const p = mapProducts(
      [
        {
          sku: "01",
          name: "Pod",
          ek: "4,5",
          vk: "7,5",
          ean: "00123",
          ve: "10",
          stock: "",
        },
      ],
      mapping,
      "supplier",
    )[0];
    expect(p.ean).toBe("00123");
    expect(p.stock).toBeNull();
    expect(p.pack_size).toBe(10);
  });
  it("rejects duplicate SKUs and malformed/negative inputs atomically", () => {
    const row = { sku: "a", name: "Pod", ek: "4", vk: "6" };
    expect(() => mapProducts([row, row], mapping, "supplier")).toThrow(
      "Doppelte",
    );
    expect(() =>
      mapProducts([{ ...row, ek: "-1" }], mapping, "supplier"),
    ).toThrow();
    expect(() => parseCsv("a;b\n1;2;3")).toThrow();
    expect(() => parseCsv('a;b\n1;"oops')).toThrow();
  });
});
describe("Routes", () => {
  const stops = Array.from({ length: 11 }, (_, i) => ({
    id: String(i),
    company: "Stop " + i,
    address: "Berlin " + i,
    lat: 52 + i / 100,
    lng: 13 + i / 100,
  }));
  it("preserves every stop across mobile-compatible legs", () => {
    const urls = mapsRoutes(stops, "Berlin Hbf");
    expect(urls).toHaveLength(3);
    const destinations = urls.flatMap((u) => {
      const p = new URL(u).searchParams;
      const waypoints = p.get("waypoints")?.split("|") || [];
      expect(waypoints.length).toBeLessThanOrEqual(3);
      return [...waypoints, p.get("destination")];
    });
    expect(destinations).toHaveLength(11);
    expect(new URL(urls[1]).searchParams.get("origin")).toBe(
      new URL(urls[0]).searchParams.get("destination"),
    );
  });
  it("sorts by proximity and preserves missing coordinates", () => {
    const ordered = orderStops(
      [
        stops[4],
        { ...stops[0], id: "missing", lat: null, lng: null },
        stops[1],
      ],
      { lat: 52, lng: 13 },
    );
    expect(ordered.map((s) => s.id)).toEqual(["1", "4", "missing"]);
    expect(distance(stops[0], stops[0])).toBe(0);
    expect(mapsRoutes([])).toEqual([]);
  });
});
describe("Public intake server validation", () => {
  const p = {
    company: "Test",
    contact: "Person",
    city: "Berlin",
    email: "TEST@example.invalid",
    consent: true,
    interest: "both",
  };
  it("normalizes email and only returns allowed fields", () => {
    const validated = validatePayload({
      ...p,
      user_id: "attacker",
      status: "won",
    });
    expect(validated.email).toBe("test@example.invalid");
    expect(validated).not.toHaveProperty("user_id");
  });
  it("requires consent, a valid contact and a bounded message", () => {
    expect(() => validatePayload({ ...p, consent: false })).toThrow();
    expect(() => validatePayload({ ...p, email: "bad" })).toThrow();
    expect(() =>
      validatePayload({ ...p, message: "x".repeat(3001) }),
    ).toThrow();
    expect(() => validatePayload({ ...p, interest: "admin" })).toThrow();
  });
});
