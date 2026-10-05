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
 return ["nx-search-v9-edge",center.lat.toFixed(3),center.lng.toFixed(3),radius,category].join(":");
}
function readSearchCache(key:string){
 const hit=searchCache.get(key);
 if(hit&&hit.at>Date.now()-searchCacheMax&&hit.items.length>0)return hit;
 if(hit&&hit.items.length===0)searchCache.delete(key);
 try {
  const value=sessionStorage.getItem(key);
  if(!value)return null;
  const data=JSON.parse(value) as {at:number;items:Prospect[]};
  if(!Number.isFinite(data.at)||data.at<Date.now()-searchCacheMax||!Array.isArray(data.items)||data.items.length===0){
   sessionStorage.removeItem(key);
   return null;
  }
  searchCache.set(key,data);
  return data;
 }catch{return null;}
}
function writeSearchCache(key:string,items:Prospect[]){
 if(items.length===0){
  searchCache.delete(key);
  try{sessionStorage.removeItem(key);}catch{/* private browsing */}
  return;
 }
 const data={at:Date.now(),items};searchCache.set(key,data);
 try{sessionStorage.setItem(key,JSON.stringify(data));}catch{/* private browsing */}
}

const geocodeCache = new Map<string,{lat:number;lng:number;label:string;city:string}>();
export async function geocode(query:string){
  const raw=query.trim();
  if(raw.length<3)throw Error("Bitte einen Ort oder eine vollständige Adresse eingeben.");
  const key="geoapify-v1:"+raw.toLowerCase();
  const cached=geocodeCache.get(key);
  if(cached)return cached;
  const {data,error}=await client.functions.invoke("nx-hunter-geocode",{body:{query:raw}});
  if(error)throw Error("Die Ortssuche konnte den Standort nicht bestimmen. Bitte PLZ und Ort prüfen.");
  const lat=Number(data?.lat),lng=Number(data?.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))throw Error("Die Ortssuche lieferte keine gültigen Koordinaten.");
  const found={lat,lng,label:String(data?.label||raw),city:String(data?.city||raw)};
  geocodeCache.set(key,found);
  return found;
}

export async function findProspects(
  center:{lat:number;lng:number},
  radius:number,
  category:string,
):Promise<Prospect[]> {
  if(!Number.isFinite(center.lat)||!Number.isFinite(center.lng)||radius<1||radius>35)throw Error("Ungültiger Suchbereich.");

  const key=searchKey(center,radius,category);
  const cached=readSearchCache(key);
  lastSearchCached=false;
  if(cached&&Date.now()-cached.at<searchCacheFresh){lastSearchCached=true;return cached.items;}

  try{
    const {data,error}=await client.functions.invoke("nx-hunter-search",{body:{center,radius,category}});
    if(error)throw error;
    if(!data||!Array.isArray(data.items))throw Error("Der neXaro-Suchdienst lieferte keine gültigen Geschäftsdaten.");
    const found=(data.items as Prospect[])
      .filter(p=>!!p&&!!p.name&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)))
      .map(p=>({...p,lat:Number(p.lat),lng:Number(p.lng)}))
      .slice(0,200);
    writeSearchCache(key,found);
    return found;
  }catch(e){
    if(cached){lastSearchCached=true;return cached.items;}
    const message=e instanceof Error?e.message:String(e);
    if(/401|403|jwt|session|unauthorized/i.test(message))throw Error("Die Geschäftssuche benötigt eine gültige CRM-Anmeldung. Bitte einmal neu anmelden und erneut suchen.");
    throw Error("Der neXaro-Suchdienst konnte die Geschäftsdaten nicht laden. Bitte Suche erneut starten oder Radius/Branche anpassen.");
  }
}
