import {describe,it,expect} from "vitest";
import {feeReadiness,feeReviewSignature} from "../src/lib/feeReadiness";
import type {ExistingProviderInput} from "../src/lib/fieldSalesComparison";
const input:ExistingProviderInput={volume:15000,transactions:400,debitShare:80,debitRate:1.95,creditRate:2.59,
 serviceFee:0,terminalFee:0,perTransaction:0,confirmedTotal:null};
describe("incoming statement review gate",()=>{
 it("does not accept 80/20 defaults and estimated fees as verified",()=>{
  expect(feeReadiness(input,"Provider",false,false).ready).toBe(false);
  expect(feeReadiness(input,"Provider",false,false).missing.length).toBeGreaterThan(1);
 });
 it("requires a named provider and nonzero cards volume",()=>{
  expect(feeReadiness({...input,volume:0},"",true,true).ready).toBe(false);
 });
 it("accepts verified card mix and verified rates",()=>{
  expect(feeReadiness(input,"Provider",true,true).ready).toBe(true);
 });
 it("accepts actual confirmed total instead of synthetic rate validation",()=>{
  expect(feeReadiness({...input,confirmedTotal:180},"Provider",true,false).ready).toBe(true);
 });
 it("invalidates approval when any comparison field changes",()=>{
  expect(feeReviewSignature(input,"Provider",true,true)).not.toBe(feeReviewSignature({...input,volume:16000},"Provider",true,true));
 });
});
