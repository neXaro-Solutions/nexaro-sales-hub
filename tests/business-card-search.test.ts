import {describe,it,expect} from "vitest";
import {businessCategories,isExcludedChain} from "../src/lib/business-search";
import {readBusinessCardText} from "../src/lib/business-card";
describe("business search across desktop and mobile",()=>{
 it("offers all business kinds and all previously supported categories",()=>{
  expect(businessCategories[0]).toEqual({id:"all",label:"Alle Geschäftsarten"});
  for(const id of ["shops","food","vape","services","health","lodging","office"])
   expect(businessCategories.some(item=>item.id===id)).toBe(true);
 });
 it("filters recognizable chains by name and brand",()=>{
  expect(isExcludedChain({name:"Kaufland"})).toBe(true);
  expect(isExcludedChain({name:"McDonald's Berlin Mitte"})).toBe(true);
  expect(isExcludedChain({name:"Stadtcafé Musterblick",brand:"Burger King"})).toBe(true);
  expect(isExcludedChain({name:"Mein Café",franchise:"yes"})).toBe(true);
 });
 it("preserves independent shops",()=>{
  expect(isExcludedChain({name:"Stadtcafé Musterblick"})).toBe(false);
  expect(isExcludedChain({name:"Kaffeerösterei Kaufländer"})).toBe(false);
 });
});
describe("web business-card scan mapping",()=>{
 it("reads a contact card with labelled customer details",()=>{
  const card=["Firma: Stadtcafé Musterblick","Ansprechpartner: Max Muster","Alexanderplatz 1","10178 Berlin","Telefon: +49 30 1234567","max@stadtcafe.de","www.stadtcafe.de"].join("\n");
  const read=readBusinessCardText(card);
  expect(read.fields.company).toBe("Stadtcafé Musterblick");
  expect(read.fields.contact).toBe("Max Muster");
  expect(read.fields.street).toBe("Alexanderplatz 1");
  expect(read.fields.zip).toBe("10178");
  expect(read.fields.city).toBe("Berlin");
  expect(read.fields.phone).toBe("+49 30 1234567");
  expect(read.fields.email).toBe("max@stadtcafe.de");
  expect(read.fields.website).toBe("www.stadtcafe.de");
 });
 it("does not invent a named contact from a business letterhead",()=>{
  const read=readBusinessCardText("Stadtcafé Musterblick\nAlexanderplatz 1\n10178 Berlin");
  expect(read.fields.company).toBe("Stadtcafé Musterblick");
  expect(read.fields.contact).toBeUndefined();
 });
});
