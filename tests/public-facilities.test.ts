import { describe, expect, it } from "vitest";
import { isExcludedPublicFacility as excluded } from "../src/lib/public-facilities";

describe("public facility prospect exclusion", () => {
 it.each([
  [{ name:"Kreiskrankenhaus", amenity:"hospital" }],
  [{ name:"Privates Klinikum", healthcare:"hospital" }],
  [{ name:"Bürgeramt", office:"government" }],
  [{ name:"Finanzamt Königs Wusterhausen", office:"office" }],
  [{ name:"Rathaus", building:"public" }],
  [{ name:"Polizeiwache", amenity:"police" }],
  [{ name:"Feuerwehr", amenity:"fire_station" }],
  [{ name:"Grundschule", amenity:"school" }],
  [{ name:"Stadtbibliothek", amenity:"library" }],
  [{ name:"Kreisverwaltung", office:"government" }],
  [{ name:"Stadtverwaltung Halbe", office:"company" }],
  [{ name:"Hotel im Rathaus", building:"government" }],
 ])("excludes institution %j", tags => {
  expect(excluded(tags)).toBe(true);
 });
 it.each([
  [{ name:"Stadtcafé", amenity:"cafe" }],
  [{ name:"Rathaus Café", amenity:"cafe" }],
  [{ name:"Klinik Café", amenity:"cafe" }],
  [{ name:"Private Arztpraxis", amenity:"doctors", healthcare:"doctor" }],
  [{ name:"Apotheke Halbe", amenity:"pharmacy" }],
  [{ name:"Friseur im Stadtzentrum", shop:"hairdresser" }],
  [{ name:"Privates Fitnessstudio", leisure:"fitness_centre" }],
  [{ name:"Krankenhaus Apotheke", amenity:"pharmacy" }],
  [{ name:"Café Bürgerhaus", amenity:"cafe" }],
 ])("does not exclude independent business %j", tags => {
  expect(excluded(tags)).toBe(false);
 });
});
