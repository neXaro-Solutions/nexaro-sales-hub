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
let lastSearchWarning = "";
export function prospectSearchWarning(){return lastSearchWarning;}
async function searchError(error:unknown, geocoding=false):Promise<Error>{
 const response=(error as {context?:Response})?.context;
 const status=response?.status;
 if(status===401||status===403)return Error("Die Suche benötigt eine gültige CRM-Anmeldung. Bitte neu anmelden und erneut suchen.");
 if(status===429)return Error("Der Suchdienst ist gerade ausgelastet. Bitte etwas warten und erneut suchen.");
 if(geocoding&&status===404)return Error("Kein passender Ort gefunden. Bitte PLZ und Ort oder die vollständige Adresse prüfen.");
 return Error(geocoding?"Die Ortssuche ist momentan nicht erreichbar. Bitte erneut versuchen.":"Die Geschäftssuche ist momentan nicht erreichbar. Bitte erneut versuchen; das ist kein Ergebnis mit null Treffern.");
}
export function wasProspectSearchCached() { return lastSearchCached; }
function searchKey(center:{lat:number;lng:number},radius:number,category:string){
 return ["nx-search-v13-edge",center.lat.toFixed(3),center.lng.toFixed(3),radius,category].join(":");
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

export async function geocode(query:string){
  const raw=query.trim();
  if(raw.length<3)throw Error("Bitte einen Ort oder eine vollständige Adresse eingeben.");
  const {data,error}=await client.functions.invoke("nx-hunter-geocode",{body:{query:raw}});
  if(error)throw await searchError(error,true);
  const lat=Number(data?.lat),lng=Number(data?.lng);
  if(data?.lat==null||data?.lng==null||!Number.isFinite(lat)||!Number.isFinite(lng))throw Error("Die Ortssuche lieferte keine gültigen Koordinaten.");
  return {lat,lng,label:String(data?.label||raw),city:String(data?.city||raw)};
}

export async function findProspects(
  center:{lat:number;lng:number},
  radius:number,
  category:string,
):Promise<Prospect[]> {
  if(!Number.isFinite(center.lat)||!Number.isFinite(center.lng)||!Number.isFinite(radius)||radius<1||radius>35)throw Error("Ungültiger Suchbereich.");

  const key=searchKey(center,radius,category);
  const cached=readSearchCache(key);
  lastSearchCached=false;lastSearchWarning="";
  if(cached&&Date.now()-cached.at<searchCacheFresh){lastSearchCached=true;return cached.items;}

  try{
    const {data,error}=await client.functions.invoke("nx-hunter-search",{body:{center,radius,category}});
    if(error)throw error;
    if(!data||!Array.isArray(data.items))throw Error("Der neXaro-Suchdienst lieferte keine gültigen Geschäftsdaten.");
    const found=(data.items as Prospect[])
      .filter(p=>!!p&&!!p.name&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)))
      .map(p=>({...p,lat:Number(p.lat),lng:Number(p.lng)}))
      .slice(0,200);
    lastSearchWarning=[data.partial?"Ein Teil der Datenquellen ist nicht erreichbar. Die Trefferliste ist unvollständig.":"",data.truncated?"Es werden die nächstgelegenen Treffer gezeigt. Für weitere Ergebnisse bitte Radius oder Branche eingrenzen.":""].filter(Boolean).join(" ");
    if(!data.partial&&!data.truncated)writeSearchCache(key,found);
    return found;
  }catch(e){
    const status=(e as {context?:Response})?.context?.status;
    if(cached&&status!==401&&status!==403){lastSearchCached=true;lastSearchWarning="Suchdienst momentan nicht erreichbar – zuletzt gespeicherte Treffer werden angezeigt.";return cached.items;}
    throw await searchError(e);
  }
}
