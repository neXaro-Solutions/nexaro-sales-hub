/** Exclude non-commercial civic/public facilities from the prospecting results.
 * OSM tags have priority: a private hospital is still a hospital, while a
 * private medical practice, pharmacy or independent café remains eligible.
 */
const institutionalAmenities = new Set([
 "hospital","townhall","courthouse","police","fire_station","prison",
 "school","college","university","kindergarten","library","community_centre",
 "social_centre","public_building","embassy","public_bath","crematorium",
 "grave_yard","place_of_worship","ranger_station","arts_centre",
]);
const institutionalOffices = new Set([
 "government","administrative","diplomatic","political_party","association",
 "public_authority","public_service","tax","municipality",
]);
const institutionalHealthcare = new Set(["hospital"]);
const civicTourism = new Set(["museum","gallery","information"]);
const civicBuilding = new Set([
 "hospital","government","public","civic","school","university","college",
 "kindergarten","fire_station","police","transportation","train_station",
 "church","cathedral",
]);
const civicLeisure = new Set(["swimming_pool","sports_hall","stadium"]);
const institutionalNames = /(?:^|[\s,.(\-])(?:rathaus|bürgeramt|bürgerbüro|bürgerzentrum|einwohnermeldeamt|standesamt|finanzamt|ordnungsamt|gesundheitsamt|jugendamt|sozialamt|landratsamt|arbeitsamt|jobcenter|amtsgericht|landgericht|oberlandesgericht|verwaltungsgericht|polizeiwache|polizeidienststelle|polizeirevier|feuerwehr|krankenhaus|klinikum|universitätsklinikum|universitaetsklinikum|universitätskrankenhaus|universitaetskrankenhaus|stadtverwaltung|gemeindeverwaltung|kreisverwaltung|bundeswehr|bürgerhaus|buergerhaus)(?:$|[\s,.)\-])/i;
const normalize=(s:string)=>s.toLocaleLowerCase("de-DE").trim();
export function isExcludedPublicFacility(tags:Record<string,string>):boolean {
 const t=(key:string)=>normalize(tags[key]||"");
 if(institutionalAmenities.has(t("amenity")) || institutionalOffices.has(t("office"))
  || institutionalHealthcare.has(t("healthcare"))
  || civicTourism.has(t("tourism")) || civicBuilding.has(t("building"))
  || civicLeisure.has(t("leisure")))return true;
 if(["government","public_authority","public_service"].includes(t("operator:type")))return true;
 // OSM access=public does not mean publicly operated; exclude explicit
 // government ownership instead of all customer-facing public access.
 if(["government","municipal","state","federal","public"].includes(t("ownership")))return true;
 const fullName=[tags.name,tags["name:de"],tags.official_name].filter(Boolean).join(" ");
 return institutionalNames.test(fullName);
}
