import { describe,it,expect } from "vitest";
import { compareFieldSales, type ExistingProviderInput } from "../src/lib/fieldSalesComparison";

const base: ExistingProviderInput={
  volume:10000,transactions:200,debitShare:80,debitRate:1.95,creditRate:2.59,
  serviceFee:10,terminalFee:15,perTransaction:0.05,confirmedTotal:null
};
describe("SumUp field-sales studio costs",()=>{
  it("defaults competitor 80/20 to 1.95/2.59 plus service terminal and transaction fees",()=>{
    const c=compareFieldSales(base,"standard");
    expect(c.debit).toBe(8000);
    expect(c.credit).toBe(2000);
    expect(c.variableOld).toBe(207.8);
    expect(c.fixedOld).toBe(35);
    expect(c.oldTotal).toBe(242.8);
  });
  it("does not add a confirmed statement total twice",()=>{
    const c=compareFieldSales({...base,confirmedTotal:230},"standard");
    expect(c.calculatedOld).toBe(242.8);
    expect(c.oldTotal).toBe(230);
  });
  it("keeps the user-adjusted card mix and rates",()=>{
    const c=compareFieldSales({...base,debitShare:65,debitRate:1.7,creditRate:2.8},"plus");
    expect(c.debit).toBe(6500);
    expect(c.credit).toBe(3500);
    expect(c.sumupBase).toBe(19);
  });
  it("rejects invalid rates or negative values",()=>{
    expect(()=>compareFieldSales({...base,debitShare:101},"standard")).toThrow();
    expect(()=>compareFieldSales({...base,terminalFee:-1},"plus")).toThrow();
    expect(()=>compareFieldSales({...base,confirmedTotal:NaN},"standard")).toThrow();
  });
});