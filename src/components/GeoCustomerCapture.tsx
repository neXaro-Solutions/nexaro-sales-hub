import { useRef, useState } from "react";
import { MapPin, Navigation, Search } from "lucide-react";
import { locate,type Position } from "../lib/location";
import { findProspects,geocode,type Prospect } from "../lib/maps";
import { osmEmbed } from "../lib/osmEmbed";

export type GeoCustomerDraft={
  company:string;street:string;zip:string;city:string;
  phone:string;email:string;industry:string;website:string;
  lat:number;lng:number;source:string;provenance:string;
};
const kilometers=(a:{lat:number;lng:number},b:{lat:number;lng:number})=>{
 const r=Math.PI/180,x=(b.lat-a.lat)*r,y=(b.lng-a.lng)*r*Math.cos((a.lat+b.lat)/2*r);
 return Math.sqrt(x*x+y*y)*111.195;
};
export function nearbyRanked(prospects:Prospect[],center:{lat:number;lng:number}){
 return [...prospects].sort((a,b)=>kilometers(a,center)-kilometers(b,center)).slice(0,24);
}
export function GeoCustomerCapture({onSelect}:{
 onSelect:(draft:GeoCustomerDraft)=>void;
}){
 const [gps,setGps]=useState<Position|null>(null);
 const [center,setCenter]=useState<{lat:number;lng:number}|null>(null);
 const [results,setResults]=useState<Prospect[]>([]);
 const [query,setQuery]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [status,setStatus]=useState("");
 const sequence=useRef(0);
 async function load(position:{lat:number;lng:number}){
  const n=++sequence.current;
  setCenter(position);setResults([]);setBusy(true);setError("");
  setStatus("Suche nach Geschäften in der Umgebung …");
  try{
   const results=await findProspects(position,1,"all");
   if(n!==sequence.current)return;
   const sorted=nearbyRanked(results,position);
   setResults(sorted);
   setStatus(sorted.length
    ?sorted.length+" mögliche Unternehmen gefunden. Wähle das tatsächliche Geschäft – GPS allein identifiziert keine Firma."
    :"Kein öffentlich eingetragenes Geschäft in der Nähe. Adresse manuell erfassen oder einen anderen Suchort verwenden.");
  }catch(e){if(n===sequence.current)setError((e as Error).message);}
  finally{if(n===sequence.current)setBusy(false);}
 }
 async function gpsLookup(){
  setBusy(true);setError("");setStatus("GPS wird ermittelt …");
  try{
   const pos=await locate();setGps(pos);
   await load({lat:pos.lat,lng:pos.lng});
  }catch(e){setError((e as Error).message);setBusy(false);}
 }
 async function addressLookup(){
  if(query.trim().length<3){setError("Bitte Straße, PLZ/Ort oder einen Stadtteil eingeben.");return;}
  setBusy(true);setError("");setStatus("Ort wird gesucht …");
  try{
   const place=await geocode(query.trim());
   await load({lat:place.lat,lng:place.lng});
  }catch(e){setError((e as Error).message);setBusy(false);}
 }
 const googleUrl=(p:Prospect)=>"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(
  [p.name,p.street,p.zip,p.city].filter(Boolean).join(" ")||p.lat+","+p.lng
 );
 const registryUrl="https://www.handelsregister.de/rp_web/normalesuche/welcome.xhtml";
 const webUrl=(value:string)=>{try{const u=new URL(/^https?:\/\//i.test(value)?value:"https://"+value);return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}};
 function choose(p:Prospect){
  onSelect({
   company:p.name,street:p.street,zip:p.zip,city:p.city,
   phone:p.phone,email:p.email,industry:p.category,website:p.website,
   lat:p.lat,lng:p.lng,source:"OpenStreetMap "+p.id,
   provenance:"OpenStreetMap "+p.id+" · Auswahl durch Außendienst · "+
    new Date().toLocaleDateString("de-DE")+
    ". Google Maps und Handelsregister nicht automatisch verifiziert."
  });
  setStatus(p.name+" zur Übernahme in die Kundenakte ausgewählt. Bitte Daten vor dem Speichern kontrollieren.");
 }
 return <section className="geo-capture" aria-label="Standortdaten ermitteln">
  <h3>📍 Standort automatisch erfassen</h3>
  <p className="hint">GPS ermittelt deine Position, nicht automatisch den Unternehmensnamen. Wähle das Geschäft vor Ort aus den öffentlich verfügbaren Standortdaten; Konzernfilter wie in der Standortsuche aktiv.</p>
  <div className="button-row" style={{flexWrap:"wrap"}}>
   <button type="button" className="primary" disabled={busy} onClick={()=>void gpsLookup()}>
    <Navigation size={16}/> {busy?"Standortsuche läuft …":"Meinen GPS-Standort suchen"}
   </button>
  </div>
  <div className="form-grid">
   <label>Alternativ Adresse / Berlin Mitte eingeben
    <input aria-label="Ort für die Standortsuche" placeholder="z. B. Berlin Mitte, Friedrichstraße 100"
      value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void addressLookup();}}}/>
   </label>
   <div style={{display:"flex",alignItems:"end"}}>
    <button type="button" className="secondary" disabled={busy||query.trim().length<3} onClick={()=>void addressLookup()}><Search size={16}/> Standorte suchen</button>
   </div>
  </div>
  {gps&&<p className="hint">GPS-Genauigkeit: ca. {Math.round(gps.accuracy)} m. Der tatsächliche Geschäftsstandort kann davon abweichen.</p>}
  {center&&<iframe title="Suchgebiet" loading="lazy" referrerPolicy="no-referrer"
   src={osmEmbed(center,1)} style={{width:"100%",height:200,border:"1px solid #dce5d5",borderRadius:12}}/>}
  {status&&<p className="notice" role="status">{status}</p>}
  {error&&<p role="alert" className="error">{error}</p>}
  {results.length>0&&<div className="geo-results">
   <h4>Geschäft am Standort auswählen</h4>
   {results.map(p=><div className="geo-candidate" key={p.id}>
    <div><strong>{p.name}</strong><small>{[p.street,p.zip,p.city].filter(Boolean).join(" · ")||"Adresse nicht vollständig hinterlegt"}</small>
     <small>Ca. {Math.round(kilometers(p,center!)*1000)} m vom Suchpunkt · OpenStreetMap</small>
     {(p.phone||p.email||p.website)&&<small>{[p.phone,p.email].filter(Boolean).join(" · ")}{p.website&&webUrl(p.website)&&<> · <a href={webUrl(p.website)||undefined} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>Webseite ↗</a></>}</small>}</div>
    <div className="button-row" style={{flexWrap:"wrap"}}>
     <button type="button" className="primary" onClick={()=>choose(p)}><MapPin size={14}/> Daten übernehmen</button>
     <a href={googleUrl(p)} className="secondary" target="_blank" rel="noopener noreferrer">Google Maps prüfen ↗</a>
    </div>
   </div>)}
  </div>}
  <p className="hint">Google Maps: manueller Gegencheck per Link. Handelsregister: offiziellen Eintrag gesondert prüfen. Ohne freigeschaltete Google-Places-Schnittstelle und eine zulässige Registerdaten-Anbindung werden diese Quellen nicht automatisch in die Kundenakte importiert.</p>
  <a className="secondary" href={registryUrl} target="_blank" rel="noopener noreferrer">Handelsregister öffnen ↗</a>
 </section>;
}
