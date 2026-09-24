import {describe,it,expect} from "vitest";
import {hunterRouteLength,optimizeHunterRoute} from "../src/lib/hunterRoute";
const p=(id:string,lat:number|null,lng:number|null)=>({id,lat,lng});
describe("Hunter embedded route",()=>{
 it("keeps all unique selected stops and puts ungeocoded stops last",()=>{
  const stops=[p("a",52,13),p("b",52.1,13.2),p("c",null,null),p("d",52.2,13.05)];
  const route=optimizeHunterRoute(stops,{lat:52,lng:13});
  expect(route.map(s=>s.id).sort()).toEqual(stops.map(s=>s.id).sort());
  expect(route.at(-1)?.id).toBe("c");
 });
 it("does not worsen straight-line sequence from selected GPS origin",()=>{
  const stops=[p("a",52.1,13.1),p("b",52.3,13.1),p("c",52.15,13),p("d",52.21,13.22)];
  const start={lat:52,lng:13};
  expect(hunterRouteLength(optimizeHunterRoute(stops,start),start)).toBeLessThanOrEqual(hunterRouteLength(stops,start)+.00001);
 });
 it("handles empty selections",()=>expect(optimizeHunterRoute([])).toEqual([]));
});