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
 it("reads the uploaded neXaro test card without mistaking Außendienst & Vertrieb for the company",()=>{
  const card=[
   "neXaro Solutions","IDEEN BEWEGEN MÄRKTE","LÖSUNGEN FÜR EINE STARKE ZUKUNFT",
   "Sebastian Pötschke","Außendienst & Vertrieb",
   "Friedrichstraße 100","10117 Berlin Mitte",
   "Telefon: +49 30 12345678","Mobil: +49 176 12345678",
   "E-Mail: kontakt@nexaro-solutions.de","Web: www.nexaro-solutions.de"
  ].join("\n");
  const {fields}=readBusinessCardText(card);
  expect(fields.company).toBe("neXaro Solutions");
  expect(fields.contact).toBe("Sebastian Pötschke");
  expect(fields.jobTitle).toBe("Außendienst & Vertrieb");
  expect(fields.phone).toBe("+49 30 12345678");
  expect(fields.mobile).toBe("+49 176 12345678");
  expect(fields.email).toBe("kontakt@nexaro-solutions.de");
  expect(fields.website).toBe("www.nexaro-solutions.de");
  expect(fields.street).toBe("Friedrichstraße 100");
  expect(fields.zip).toBe("10117");
  expect(fields.city).toBe("Berlin Mitte");
 });
 it("never guesses a position as the company when an OCR logo is missing",()=>{
  const {fields,warnings}=readBusinessCardText("Sebastian Pötschke\nAußendienst & Vertrieb\nFriedrichstraße 100\n10117 Berlin Mitte\nkontakt@nexaro-solutions.de");
  expect(fields.company).toBeUndefined();
  expect(fields.contact).toBe("Sebastian Pötschke");
  expect(warnings.some(w=>w.includes("Unternehmen"))).toBe(true);
 });
 it("handles actual Tesseract output of the uploaded neXaro card and flags logo correction",()=>{
  const raw=["neXarOo Solutions","FDEEN BIEW'E GEN MÄRKTE",
   "Sebastian Pötschke","Außendienst & Vertrieb","Friedrichstraße 100",
   "10117 Berlin Mitte","Telefon: +49 30 12345678","Mobil: +49 176 12345678",
   "E-Mail: kontakt@nexaro-solutions.de","Web: www.nexaro-solutions.de",
   "8Ror ©","LÖSUNGEN","FÜR EINE","STARKE","ZUR URN IT",
   "MENSCHEN","IHDJEFEAN","ERFOLG"].join("\n");
  const read=readBusinessCardText(raw);
  expect(read.fields.company).toBe("neXaro Solutions");
  expect(read.fields.contact).toBe("Sebastian Pötschke");
  expect(read.fields.phone).toBe("+49 30 12345678");
  expect(read.fields.mobile).toBe("+49 176 12345678");
  expect(read.warnings.some(w=>w.includes("Schreibweise"))).toBe(true);
 });
 it("reads a split logo with company name in two rows",()=>{
  const {fields}=readBusinessCardText("neXaro\nSolutions\nSebastian Pötschke\nAußendienst & Vertrieb\nFriedrichstraße 100\n10117 Berlin Mitte\nkontakt@nexaro-solutions.de");
  expect(fields.company).toBe("neXaro Solutions");
 });
 it("extracts the supplied graphic business card with a combined address and unlabelled phone",()=>{
  const raw=[
   "neXaro", "SOLUTIONS", "Einfach. Mehr. Möglichkeiten.",
   "Sebastian Pötschke", "INHABER | VERTRIEB & BERATUNG",
   "0171 90 98 831", "Kontakt@nexaro-solutions.de",
   "Kirchstraße 1A | 15757 Halbe", "www.nexaro-solutions.de",
   "Payment Lösungen", "Scan mich!"
  ].join("\n");
  const read=readBusinessCardText(raw);
  expect(read.fields.contact).toBe("Sebastian Pötschke");
  expect(read.fields.jobTitle).toBe("INHABER | VERTRIEB & BERATUNG");
  expect(read.fields.company).toBe("neXaro SOLUTIONS");
  expect(read.fields.street).toBe("Kirchstraße 1A");
  expect(read.fields.zip).toBe("15757");
  expect(read.fields.city).toBe("Halbe");
  expect(read.fields.phone).toBe("0171 90 98 831");
  expect(read.fields.email).toBe("kontakt@nexaro-solutions.de");
  expect(read.fields.website).toBe("www.nexaro-solutions.de");
 });
 it("does not invent a named contact from a business letterhead",()=>{
  const read=readBusinessCardText("Stadtcafé Musterblick\nAlexanderplatz 1\n10178 Berlin");
  expect(read.fields.company).toBe("Stadtcafé Musterblick");
  expect(read.fields.contact).toBeUndefined();
 });
});
