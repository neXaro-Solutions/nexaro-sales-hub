import { describe, expect, it } from "vitest";
import { vapeSaleNet, vapeSaleGross } from "../src/lib/vapePricing";

describe("Vape price calculation for confirmed sale unit", () => {
  it("calculates 25% gross margin from net EK, not 25% markup", () => {
    expect(vapeSaleNet(100, 25)).toBe(133.34);
    expect(vapeSaleGross(133.34)).toBe(158.67);
  });
  it("calculates minimum 15% margin and rounds VK up to cents", () => {
    expect(vapeSaleNet(100, 15)).toBe(117.65);
    expect(vapeSaleNet(8, 25)).toBe(10.67);
  });
  it("blocks invalid EK and unapproved margin bounds", () => {
    expect(() => vapeSaleNet(0, 25)).toThrow();
    expect(() => vapeSaleNet(100, 14)).toThrow();
    expect(() => vapeSaleNet(100, 26)).toThrow();
    expect(() => vapeSaleNet(Number.NaN, 25)).toThrow();
  });
});
