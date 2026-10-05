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

type SearchResponse={items?:Prospect[];partial?:boolean;source?:string;error?:string};
const searchCache = new Map<string,{at:number;items:Prospect[]}>();
const searchCacheFresh = 30*60*1000, searchCacheMax = 7*24*60*60*1000;
let lastSearchCached = false;
export function wasProspectSearchCached(){return lastSearchCached;}
function searchKey(center:{lat:number;lng:number},radius:number,category:string){
  return ["nx-search-v8-edge",center.lat.toFixed(3),center.lng.toFixed(3),radius,category].join(":");
}
function readSearchCache(key:string){
  const hit=searchCache.get(key);
  if(hit&&hit.at>Date.now()-searchCacheMax)return hit;
  try{
    const value=localStorage.getItem(key)||sessionStorage.getItem(key);
    if(!value)return null;
    const data=JSON.parse(value) as {at:number;items:Prospect[]};
    if(!Number.isFinite(data.at)||data.at<Date.now()-searchCacheMax||!Array.isArray(data.items))return null;
    searchCache.set(key,data);return data;
  }catch{return null;}
}
function writeSearchCache(key:string,items:Prospect[]){
  const data={at:Date.now(),items};searchCache.set(key,data);
  try{localStorage.setItem(key,JSON.stringify(data));}catch{try{sessionStorage.setItem(key,JSON.stringify(data));}catch{/* private browsing */}}
}
function timeoutError(message:string){return Object.assign(Error(message),{name:"TimeoutError"});}
async function fetchWithHardTimeout(url:string,init:RequestInit,ms:number){
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<Response>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(timeoutError("Zeitlimit erreicht."));},ms);});
  try{return await Promise.race([fetch(url,{...init,signal:controller.signal}),timeout]);}
  finally{if(timer)clearTimeout(timer);}
}

let lastGeocode=0;
const cache=new Map<string,{lat:number;lng:number;label:string;city:string}>();
export async function geocode(query:string){
  const configResponse=await fetchWithHardTimeout(import.meta.env.BASE_URL+"maps-config.json",{cache:"no-store"},4000);
  if(!configResponse.ok)throw Error("Die Ortssuche ist derzeit nicht konfiguriert.");
  const config=await configResponse.json();
  if(!config.enabled)throw Error("Die öffentliche Ortssuche ist deaktiviert. Google-Maps-Links stehen weiter bereit.");
  const endpoint=new URL(config.geocoder,location.href);
  if(endpoint.protocol!=="https:"&&endpoint.origin!==location.origin)throw Error("Ungültige Konfiguration der Ortssuche.");
  const cacheKey=query.trim().toLowerCase();
  if(cache.has(cacheKey))return cache.get(cacheKey)!;
  if(query.trim().length<3)throw Error("Bitte einen Ort oder eine vollständige Adresse eingeben.");
  const wait=Math.max(0,1100-(Date.now()-lastGeocode));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));lastGeocode=Date.now();
  const response=await fetchWithHardTimeout(endpoint.href+"?"+new URLSearchParams({q:query,format:"jsonv2",limit:"1",countrycodes:"de",addressdetails:"1"}),{headers:{Accept:"application/json"}},8000);
  if(!response.ok)throw Error("Die öffentliche Ortssuche ist gerade nicht verfügbar. Bitte später erneut versuchen.");
  const rows=await response.json();if(!rows.length)throw Error("Ort nicht gefunden. Bitte PLZ und Ortsname eingeben.");
  const r=rows[0],lat=Number(r.lat),lng=Number(r.lon);if(!Number.isFinite(lat)||!Number.isFinite(lng))throw Error("Keine gültigen Koordinaten erhalten.");
  const found={lat,lng,label:String(r.display_name),city:String(r.address?.city||r.address?.town||r.address?.village||query)};cache.set(cacheKey,found);return found;
}

export async function findProspects(center:{lat:number;lng:number},radius:number,category:string):Promise<Prospect[]>{
  if(!Number.isFinite(center.lat)||!Number.isFinite(center.lng)||radius<1||radius>35)throw Error("Ungültiger Suchbereich.");
  const key=searchKey(center,radius,category),cached=readSearchCache(key);lastSearchCached=false;
  if(cached&&Date.now()-cached.at<searchCacheFresh){lastSearchCached=true;return cached.items;}
  try{
    const {data,error}=await client.functions.invoke<SearchResponse>("nx-hunter-search",{body:{center,radius,category}});
    if(error)throw error;
    const items=Array.isArray(data?.items)?data.items:[];
    if(!items.length&&data?.error)throw Error(data.error);
    writeSearchCache(key,items);
    return items;
  }catch(e){
    if(cached){lastSearchCached=true;return cached.items;}
    throw Error("Die Geschäftssuche konnte den neXaro-Suchdienst nicht erreichen. Bitte einmal neu anmelden oder die Seite neu laden und erneut suchen.");
  }
}
