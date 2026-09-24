import {describe,expect,it} from "vitest";
import {validatePayload} from "../supabase/functions/nx-public-intake/validation";

const base={
 company:"Beispiel Restaurant GmbH",contact:"Max Beispiel",email:"max@example.org",
 city:"Berlin",interest:"sumup",consent:true,request_type:"sumup_fee_check"
};

describe("Hunter AUTO incoming SumUp requests",()=>{
 it("accepts an explicitly requested fee comparison with optional bounded data",()=>{
  expect(validatePayload({...base,monthly_volume:"15000.25",current_provider:"Bisheriger Anbieter"})).toMatchObject({
   interest:"sumup",monthly_volume:"15000.25",request_type:"sumup_fee_check",consent:true
  });
 });
 it("does not infer newsletter or marketing permission from the request",()=>{
  expect(validatePayload({...base,marketing_email:true})).not.toHaveProperty("marketing_email");
 });
 it("rejects a fee-check request for a different division",()=>{
  expect(()=>validatePayload({...base,interest:"vape"})).toThrow();
 });
 it("rejects missing request consent",()=>{
  expect(()=>validatePayload({...base,consent:false})).toThrow();
 });
 it("rejects invalid or oversized turnover",()=>{
  expect(()=>validatePayload({...base,monthly_volume:"999999999"})).toThrow();
  expect(()=>validatePayload({...base,monthly_volume:"not-a-number"})).toThrow();
 });
});
