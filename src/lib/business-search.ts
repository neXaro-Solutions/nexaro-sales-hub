export const businessCategories = [
 {id:"all",label:"Alle Geschäftsarten"},
 {id:"shops",label:"Einzelhandel"},
 {id:"food",label:"Gastronomie"},
 {id:"vape",label:"Kioske, Tabak & Vapes"},
 {id:"services",label:"Dienstleistungen & Handwerk"},
 {id:"health",label:"Gesundheit & Beauty"},
 {id:"lodging",label:"Hotels & Unterkünfte"},
 {id:"office",label:"Büros & Unternehmen"},
] as const;

const chainNames = [
 "kaufland","lidl","aldi","rewe","edeka","netto marken discount","penny","norma","real","tegut",
 "mcdonalds","mc donald s","mc donalds","burger king","kfc","subway","dominos","pizza hut","nordsee","backwerk",
 "starbucks","coffee fellows","tchibo","deutsche post","dhl","hermes paketshop",
 "rossmann","dm drogerie","müller drogerie","douglas","fielmann","apollo optik",
 "deichmann","h&m","zara","c&a","primark","new yorker","tk maxx","takko","kik",
 "obi","bauhaus","hornbach","toom","hagebaumarkt","media markt","mediamarkt","saturn",
 "expert","euronics","ikea","jysk","action","ted i","tedi","woolworth","nanu nana",
 "aral","shell","esso","jet tankstelle","totalenergies","av ia","avia","star tankstelle",
 "sparkasse","volksbank","commerzbank","deutsche bank","postbank","ing diba",
 "vodafone","telekom shop","o2 shop","mobilcom debitel","freenet shop",
 "fressnapf","das futterhaus","zooplus","obi markt","decathlon","intersport",
 "sixt","europcar","hertz","avis","enterprise rent a car",
 "clever fit","mcfit","fitx","john reed","easyfitness","basic fit"
];
const clean=(value:string)=>value.toLocaleLowerCase("de-DE").normalize("NFKD")
 .replace(/[\u0300-\u036f]/g,"").replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").trim();
const chainKeys = chainNames.map(clean);
const franchises = /^(?:yes|only|brand|chain)$/i;
/** Known chain/branch filter; conservatively avoid filtering independent shops on vague words. */
export function isExcludedChain(tags:Record<string,string>):boolean{
 if(franchises.test(tags.franchise||"")||/^(?:yes|true|1)$/i.test(tags["brand:franchise"]||""))return true;
 const fields=[tags.brand,tags["brand:name"],tags.operator,tags.name,tags["name:de"],tags["official_name"]].filter(Boolean);
 const known=fields.some(field=>{
  const v=clean(field);
  return chainKeys.some(chain=>v===chain||v.startsWith(chain+" ")||v.endsWith(" "+chain));
 });
 if(known)return true;
 // Any positively identified brand group is a chain candidate only when the
 // tag is explicit. Do not discard local independents simply for having a brand.
 return !!(tags["brand:wikidata"]&&tags["brand:wikipedia"]);
}
