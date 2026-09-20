import { describe,it,expect } from "vitest";
import { hardwareOfferPrice } from "../src/lib/hardwareOfferPrice";
describe("regular SumUp hardware and optional sales discount",()=>{
  it("defaults to zero and keeps full regular price",()=>{
    expect(hardwareOfferPrice(169,0)).toMatchObject({regularUnit:169,percent:0,discountedUnit:169,offerNet:169,discountTotal:0});
  });
  it("calculates max 25 percent before multiplying unit quantity",()=>{
    expect(hardwareOfferPrice(169,25,2)).toMatchObject({discountedUnit:126.75,regularTotal:338,discountTotal:84.5,offerNet:253.5});
  });
  it("rounds net unit to cents before quantity, matching the offer line",()=>{
    expect(hardwareOfferPrice(34,15,3)).toMatchObject({discountedUnit:28.9,offerNet:86.7});
  });
  it("rejects negative or greater-than-25 discounts and invalid quantities",()=>{
    expect(()=>hardwareOfferPrice(79,-1)).toThrow();
    expect(()=>hardwareOfferPrice(79,26)).toThrow();
    expect(()=>hardwareOfferPrice(79,25,0)).toThrow();
  });
});
