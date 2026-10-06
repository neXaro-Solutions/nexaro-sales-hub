import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { isExcludedPublicFacility } from "../src/lib/public-facilities";
function edge(slug:string, fetcher:any){
 let handler:(r:Request)=>Promise<Response>;
 const code=ts.transpileModule(readFileSync(`supabase/functions/${slug}/index.ts`,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports:{},require:(name:string)=>name.includes("public-facilities")?{isExcludedPublicFacility}:{corsHeaders:{}},Deno:{env:{get:()=>"test-key"},serve:(h:any)=>handler=h},fetch:fetcher,Response,Request,URLSearchParams,AbortController,setTimeout,clearTimeout,console:{log(){},error(){}}});
 return async(body:unknown)=>handler(new Request("https://example.invalid",{method:"POST",body:JSON.stringify(body)}));
}
const feature=(name="Café Test",lng=13.7,lat=52.11667,raw={})=>({properties:{name,place_id:name,street:"Hauptstraße",housenumber:"4",address_line1:name,postcode:"15757",categories:["catering.cafe"],datasource:{raw}},geometry:{coordinates:[lng,lat]}});
const body={center:{lat:52.11667,lng:13.7},radius:2,category:"all"};
describe("Hunter edge regression",()=>{
 it("resolves exact Halbe town independently of the bad municipality centroid",async()=>{
  const fetcher=vi.fn();const run=edge("nx-hunter-geocode",fetcher);
  for(const query of ["15757 Halbe, Brandenburg","Halbe","Halbe, Deutschland"]){const r=await run({query});expect(await r.json()).toMatchObject({lat:52.11667,lng:13.7});}
  expect(fetcher).not.toHaveBeenCalled();
 });
 it("does not replace street addresses or neighbouring towns with Halbe",async()=>{
  const fetcher=vi.fn(async()=>Response.json({results:[{lat:52.08,lon:13.72,formatted:"Adresse"}]}));const run=edge("nx-hunter-geocode",fetcher);
  for(const query of ["15757 Halbe, Bahnhofstraße 2","15757 Teurow"]){expect(await (await run({query})).json()).toMatchObject({lat:52.08,lng:13.72});}
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.has("type")).toBe(false);
 });
 it("recovers from a geocoder request failure",async()=>{
  const fetcher=vi.fn().mockRejectedValueOnce(Error("timeout")).mockResolvedValue(Response.json({results:[{lat:52.5,lon:13.4}]}));
  expect((await edge("nx-hunter-geocode",fetcher)({query:"Berlin"})).status).toBe(200);
 });
 it("keeps the exact GPS centre and respects the radius",async()=>{
  const center={lat:52.08246,lng:13.7045};const fetcher=vi.fn(async()=>Response.json({features:[feature("Too far"),feature("Near",center.lng,center.lat)]}));
  const r=await edge("nx-hunter-search",fetcher)({...body,center});const data=await r.json();
  expect(data.center).toEqual(center);expect(data.items.map((p:any)=>p.name)).toEqual(["Near"]);
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("filter")).toBe("circle:13.7045,52.08246,2000");
 });
 it("uses street fields, excludes institutions and chains, deduplicates results",async()=>{
  const fetcher=vi.fn(async()=>Response.json({features:[feature(),feature("Lidl"),feature("Berliner Volksbank"),feature("Krankenhaus",13.7,52.11667,{amenity:"hospital"})]}));
  const data=await (await edge("nx-hunter-search",fetcher)(body)).json();
  expect(data.items).toHaveLength(1);expect(data.items[0].street).toBe("Hauptstraße 4");
 });
 it("returns 503 when all providers fail, never fake zero results",async()=>{
  const r=await edge("nx-hunter-search",async()=>new Response("unavailable",{status:503}))(body);
  expect(r.status).toBe(503);expect(await r.json()).not.toHaveProperty("items");
 });
 it("marks partial results and distinguishes a genuine empty search",async()=>{
  const fetcher=vi.fn().mockRejectedValueOnce(Error("timeout")).mockImplementation(async()=>Response.json({features:[feature()]}));
  expect(await (await edge("nx-hunter-search",fetcher)(body)).json()).toMatchObject({partial:true});
  expect(await (await edge("nx-hunter-search",async()=>Response.json({features:[]}))(body)).json()).toMatchObject({items:[],partial:false});
 });
 it("rejects invalid inputs and removes unsupported service category",async()=>{
  const fetcher=vi.fn(async()=>Response.json({features:[]}));const run=edge("nx-hunter-search",fetcher);
  expect((await run({...body,center:{lat:null,lng:13.7}})).status).toBe(400);
  expect((await run({...body,category:"unknown"})).status).toBe(400);
  expect((await run({...body,category:"services"})).status).toBe(200);
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("categories")).toBe("service");
 });
});
