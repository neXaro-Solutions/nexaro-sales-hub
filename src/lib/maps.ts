import { client } from "./client";

export type Prospect = {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  website: string;
  email: string;
  lat: number;
  lng: number;
  category: string;
};

const searchCache = new Map<string,{at:number;items:Prospect[]}>();
const searchCacheFresh = 15*60*1000, searchCacheMax = 24*60*60*1000;
let lastSearchCached = false;
export function wasProspectSearchCached() { return lastSearchCached; }
function searchKey(center:{lat:number;lng:number},radius:number,category:string){
 return ["nx-search-v5-edge",center.lat.toFixed(3),center.lng.toFixed(3),radius,category].join(":");
}
function readSearchCache(key:string){
 const hit=searchCache.get(key);
 if(hit&&hit.at>Date.now()-searchCacheMax)return hit;
 try {
  const value=sessionStorage.getItem(key);
  if(!value)return null;
  const data=JSON.parse(value) as {at:number;items:Prospect[]};
  if(!Number.isFinite(data.at)||data.at<Date.now()-searchCacheMax||!Array.isArray(data.items))return null;
  searchCache.set(key,data);
  return data;
 }catch{return null;}
}
function writeSearchCache(key:string,items:Prospect[]){
 const data={at:Date.now(),items};searchCache.set(key,data);
 try{sessionStorage.setItem(key,JSON.stringify(data));}catch{/* private browsing */}
}

let lastGeocode = 0;
const cache = new Map<
  string,
  { lat: number; lng: number; label: string; city: string }
>();
export async function geocode(query: string) {
  const configResponse = await fetch(
    import.meta.env.BASE_URL + "maps-config.json",
    {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!configResponse.ok)
    throw Error("Die Ortssuche ist derzeit nicht konfiguriert.");
  const config = await configResponse.json();
  if (!config.enabled)
    throw Error(
      "Die öffentliche Ortssuche ist deaktiviert. Google-Maps-Links stehen weiter bereit.",
    );
  const endpoint = new URL(config.geocoder, location.href);
  if (endpoint.protocol !== "https:" && endpoint.origin !== location.origin)
    throw Error("Ungültige Konfiguration der Ortssuche.");
  const cacheKey = query.trim().toLowerCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  if (query.trim().length < 3)
    throw Error("Bitte einen Ort oder eine vollständige Adresse eingeben.");
  const wait = Math.max(0, 1100 - (Date.now() - lastGeocode));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastGeocode = Date.now();
  const response = await fetch(
    endpoint.href +
      "?" +
      new URLSearchParams({
        q: query,
        format: "jsonv2",
        limit: "1",
        countrycodes: "de",
        addressdetails: "1",
      }),
    {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok)
    throw Error(
      "Die öffentliche Ortssuche ist gerade nicht verfügbar. Bitte später erneut versuchen.",
    );
  const rows = await response.json();
  if (!rows.length)
    throw Error("Ort nicht gefunden. Bitte PLZ und Ortsname eingeben.");
  const r = rows[0],
    lat = Number(r.lat),
    lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    throw Error("Keine gültigen Koordinaten erhalten.");
  const found = {
    lat,
    lng,
    label: String(r.display_name),
    city: String(
      r.address?.city || r.address?.town || r.address?.village || query,
    ),
  };
  cache.set(cacheKey, found);
  return found;
}

export async function findProspects(
  center: { lat: number; lng: number },
  radius: number,
  category: string,
): Promise<Prospect[]> {
  if (
    !Number.isFinite(center.lat) ||
    !Number.isFinite(center.lng) ||
    radius < 1 ||
    radius > 35
  )
    throw Error("Ungültiger Suchbereich.");

  const key=searchKey(center,radius,category);
  const cached=readSearchCache(key);
  lastSearchCached=false;
  if(cached&&Date.now()-cached.at<searchCacheFresh){
   lastSearchCached=true;
   return cached.items;
  }

  try {
    const { data, error } = await client.functions.invoke("nx-hunter-search", {
      body: { center, radius, category },
    });

    if (error) throw error;
    if (!data || !Array.isArray(data.items))
      throw Error("Der neXaro-Suchdienst lieferte keine gültigen Geschäftsdaten.");

    const found=(data.items as Prospect[])
      .filter(p=>!!p&&!!p.name&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)))
      .map(p=>({...p,lat:Number(p.lat),lng:Number(p.lng)}))
      .slice(0,200);

    writeSearchCache(key,found);
    return found;
  }catch(e){
    if(cached){lastSearchCached=true;return cached.items;}
    const message=e instanceof Error?e.message:String(e);
    if(/401|403|jwt|session|unauthorized/i.test(message))
      throw Error("Die Geschäftssuche benötigt eine gültige CRM-Anmeldung. Bitte einmal neu anmelden und erneut suchen.");
    throw Error("Der neXaro-Suchdienst konnte die Geschäftsdaten nicht laden. Bitte Suche erneut starten oder Radius/Branche anpassen.");
  }
}
