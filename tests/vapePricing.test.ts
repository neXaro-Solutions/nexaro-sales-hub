import { describe, expect, it } from "vitest";
import { vapeSaleNet, vapeSaleGross, vapeIndicativePieceNet } from "../src/lib/vapePricing";

describe("Vape price calculation for confirmed sale unit", () => {
  it("calculates 25% gross margin from net EK, not 25% markup", () => {
    expect(vapeSaleNet(100, 25)).toBe(133.34);
    expect(vapeSaleGross(133.34)).toBe(158.67);
  });
  it("calculates minimum 15% margin and rounds VK up to cents", () => {
    expect(vapeSaleNet(100, 15)).toBe(117.65);
    expect(vapeSaleNet(8, 25)).toBe(10.67);
  });
  it("shows the indicative piece value based on the complete VE sale price", () => {
    const veNet = vapeSaleNet(50, 25);
    expect(veNet).toBe(66.67);
    expect(vapeIndicativePieceNet(veNet, 10)).toBe(6.67);
    expect(vapeSaleGross(veNet / 10)).toBe(7.93);
    expect(vapeIndicativePieceNet(vapeSaleNet(50, 15), 10)).toBe(5.88);
  });
  it("does not calculate an indicative piece value from an unknown pack size", () => {
    expect(() => vapeIndicativePieceNet(66.67, 0)).toThrow();
    expect(() => vapeIndicativePieceNet(66.67, 2.5)).toThrow();
    expect(() => vapeIndicativePieceNet(0, 10)).toThrow();
  });
  it("blocks invalid EK and unapproved margin bounds", () => {
    expect(() => vapeSaleNet(0, 25)).toThrow();
    expect(() => vapeSaleNet(100, 14)).toThrow();
    expect(() => vapeSaleNet(100, 26)).toThrow();
    expect(() => vapeSaleNet(Number.NaN, 25)).toThrow();
  });
});
