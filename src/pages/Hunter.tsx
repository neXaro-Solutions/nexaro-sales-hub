import { useEffect, useMemo, useState } from "react";
import { Search, MapPin, Navigation, Plus, Check, ExternalLink, RefreshCw, Trash2, Route as RouteIcon, ArrowRight, X, ArrowUp, ArrowDown } from "lucide-react";
import { client } from "../lib/client";
import { useStore } from "../lib/store";
import { geocode, findProspects, wasProspectSearchCached, type Prospect } from "../lib/maps";
import { locate } from "../lib/location";
import { osmEmbed } from "../lib/osmEmbed";
import { optimizeHunterRoute,hunterRouteLength } from "../lib/hunterRoute";
import { today } from "../lib/calculations";
import { mapSearch, mapsRoutes, dateLabel } from "../lib/calculations";
import { businessCategories } from "../lib/business-search";
import { CustomerForm } from "../components/Forms";
import type { Customer,Stop,Route } from "../lib/types";

type HunterStage = "Neu"|"Vorbereitet"|"Besucht"|"Interesse"|"Wiedervorlage"|"Kein Interesse"|"Übernommen";
type HunterLead = {
 id:string;source_id:string;company:string;street:string;zip:string;city:string;
 industry:string;phone:string;website:string;lat:number;lng:number;
 status:HunterStage;note:string;customer_id:string|null;updated_at:string;
};
const stages:HunterStage[]=["Neu","Vorbereitet","Besucht","Interesse","Wiedervorlage","Kein Interesse","Übernommen"];
const norm=(v:string)=>v.toLocaleLowerCase("de-DE").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
export function hunterDuplicate(p:Pick<Prospect,"id"|"name"|"street"|"zip"|"city">,customers:Customer[]){
 return customers.find(c=>c.source==="OpenStreetMap "+p.id||
   (norm(c.company)===norm(p.name)&&(
     (!!p.street&&norm(c.street)===norm(p.street)&&(!p.zip||!c.zip||c.zip===p.zip))||
     (!!p.zip&&!!c.zip&&c.zip===p.zip&&!p.street&&!c.street&&norm(c.city)===norm(p.city))
   )));
}
function inRegion(p:{lat:number;lng:number}){
 // Coarse geographic guard, including Berlin. A bounding box is not an administrative boundary.
 return p.lat>=51.32&&p.lat<=53.57&&p.lng>=11.25&&p.lng<=14.85;
}
const leadFrom=(p:Prospect):Omit<HunterLead,"id"|"updated_at">=>({
 source_id:"osm:"+p.id,company:p.name,street:p.street,zip:p.zip,city:p.city,
 industry:p.category,phone:p.phone,website:p.website,lat:p.lat,lng:p.lng,
 status:"Neu",note:"",customer_id:null
});
const addressOf=(p:{street:string;zip:string;city:string})=>[p.street,[p.zip,p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
export function Hunter({initialTab="leads"}:{initialTab?:"leads"|"tour"|"search"}){
 const {data,save,remove,refresh,demo}=useStore();
 const [place,setPlace]=useState("15757 Halbe"),[radius,setRadius]=useState(2),[category,setCategory]=useState("food");
 const [center,setCenter]=useState<{lat:number;lng:number}|null>(null);
 const [results,setResults]=useState<Prospect[]>([]);
 const [leads,setLeads]=useState<HunterLead[]>([]);
 const [focused,setFocused]=useState<Prospect|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const [stageFilter,setStageFilter]=useState("Offen");
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [cached,setCached]=useState(false);
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [tour,setTour]=useState<string[]>([]);
 const [tourDay,setTourDay]=useState(today());
 const [tourOrigin,setTourOrigin]=useState<{lat:number;lng:number}|null>(null);
 const [tourFocus,setTourFocus]=useState<string|null>(null);
 const [confirmDelete,setConfirmDelete]=useState<HunterLead|null>(null);
 const [rejectLead,setRejectLead]=useState<HunterLead|null>(null);
 const [tourTitle,setTourTitle]=useState("");
 const [tourBusy,setTourBusy]=useState(false);
 const [editCustomer,setEditCustomer]=useState<Customer|null>(null);
 const [workspaceTab,setWorkspaceTab]=useState<"search"|"leads"|"tour">(initialTab);
 const [openedRoute,setOpenedRoute]=useState<string|null>(null);
 const [editingRoute,setEditingRoute]=useState<string|null>(null);
 const [routeToDelete,setRouteToDelete]=useState<Route|null>(null);

 async function loadLeads(){
  if(demo)return;
  const {data:rows,error}=await client.from("nx_hunter_prospects").select("*").order("updated_at",{ascending:false}).limit(500);
  if(error)throw Error("Hunter-Merkliste konnte nicht geladen werden.");
  setLeads(rows as HunterLead[]);
 }
 useEffect(()=>{void loadLeads().catch(e=>setError((e as Error).message));},[demo]);
 async function lookup(gps=false){
  if(busy)return;
  setBusy(true);setError("");setMessage("");setFocused(null);
  try{
   const c=gps?await locate():await geocode(place.trim()+(/berlin|brandenburg/i.test(place)?"":", Brandenburg"));
   if(!inRegion(c))throw Error("Hunter Core sucht derzeit nur in Berlin/Brandenburg. Bitte einen Ort innerhalb des Gebiets wählen.");
   setCenter(c);
   const items=await findProspects(c,radius,category);
   const filtered=items.filter(inRegion);
   setResults(filtered);setCached(wasProspectSearchCached());
   setMessage(filtered.length+" Standorte gefunden. Einträge vor Ort prüfen; die Daten sind kein bestätigter Zahlungsbedarf.");
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 const bySource=useMemo(()=>new Map(leads.map(l=>[l.source_id,l])),[leads]);
 async function remember(p:Prospect){
  if(demo){setError("Im Demomodus können Hunter-Merklisten nicht dauerhaft gespeichert werden.");return}
  const duplicate=hunterDuplicate(p,data.customers);
  if(duplicate){setMessage("Bereits in der zentralen Kundenakte: "+duplicate.company+". Kein doppelter Lead erstellt.");return}
  if(bySource.has("osm:"+p.id)){setMessage("Geschäft ist bereits in deiner Hunter-Merkliste.");return}
  setBusy(true);setError("");
  try{
   const {error}=await client.from("nx_hunter_prospects").insert(leadFrom(p));
   if(error)throw Error(error.code==="23505"?"Geschäft bereits vorgemerkt.":"Vormerken fehlgeschlagen. Bitte erneut versuchen.");
   await loadLeads();setWorkspaceTab("leads");setMessage(p.name+" vorgemerkt – noch kein separater CRM-Kunde angelegt.");
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function updateLead(l:HunterLead,status:HunterStage,note:string){
  if(demo)return;
  setBusy(true);setError("");
  try{
   const {error}=await client.from("nx_hunter_prospects").update({status,note:note.slice(0,3000),updated_at:new Date().toISOString()}).eq("id",l.id);
   if(error)throw Error("Hunter-Status konnte nicht gespeichert werden.");
   await loadLeads();
   if(status==="Kein Interesse"){setSelectedIds(ids=>ids.filter(id=>id!==l.id));setTour(ids=>ids.filter(id=>id!==l.id));}
   setMessage(l.company+": "+status+" dokumentiert.");
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function promote(l:HunterLead){
  if(demo)return;
  setBusy(true);setError("");
  try{
   const equivalent=data.customers.find(c=>c.source==="OpenStreetMap "+l.source_id.replace(/^osm:/,"")||
    (norm(c.company)===norm(l.company)&&!!l.street&&norm(c.street)===norm(l.street)&&(!l.zip||c.zip===l.zip)));
   let c=equivalent;
   if(!c){
    c=await save("customers",{
     company:l.company,contact:"",email:"",phone:l.phone,website:l.website,
     street:l.street,zip:l.zip,city:l.city,industry:l.industry,
     source:"OpenStreetMap "+l.source_id.replace(/^osm:/,""),
     notes:"Hunter Außendienst · öffentliche Geschäftsdaten, vor Ort zu verifizieren. "+l.note,
     lat:l.lat,lng:l.lng,interests:["sumup"]
    });
   }
   const {error}=await client.from("nx_hunter_prospects").update({status:"Übernommen",customer_id:c.id,updated_at:new Date().toISOString()}).eq("id",l.id);
   if(error)throw Error("Kunde gespeichert, aber Hunter-Zuordnung noch nicht aktualisiert. Bitte Liste neu laden.");
   await loadLeads();await refresh();
   setEditCustomer(c);
   setMessage(c.company+(equivalent?" war bereits im CRM.":" in zentrale Kundenakte übernommen.")+" SumUp-Kundenprofil steht bereit.");
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function deleteLead(l:HunterLead){
  if(demo||busy)return;
  setBusy(true);setError("");
  try{
   const {data:deleted,error}=await client.from("nx_hunter_prospects").delete().eq("id",l.id).select("id");
   if(error||!deleted?.length)throw Error("Vorgemerkter Eintrag konnte nicht gelöscht werden.");
   setSelectedIds(ids=>ids.filter(id=>id!==l.id));
   setTour(ids=>ids.filter(id=>id!==l.id));
   if(tourFocus===l.id)setTourFocus(null);
   setConfirmDelete(null);
   await loadLeads();
   setMessage("„"+l.company+"“ aus der Hunter-Merkliste entfernt. Eine bereits übernommene zentrale Kundenakte bleibt erhalten.");
  }catch(e){setError(e instanceof Error?e.message:"Löschen fehlgeschlagen.")}
  finally{setBusy(false)}
 }
 function selectLead(l:HunterLead,checked:boolean){
  setTourTitle("");
  setSelectedIds(old=>checked?[...new Set([...old,l.id])]:old.filter(id=>id!==l.id));
  setTour(old=>checked?old:old.filter(id=>id!==l.id));
 }
 const eligibleTour=leads.filter(l=>!["Kein Interesse","Übernommen"].includes(l.status));
 const tourStops=tour.map(id=>leads.find(l=>l.id===id)).filter((l):l is HunterLead=>!!l);
 const tourMapStops=tourStops.filter(l=>Number.isFinite(l.lat)&&Number.isFinite(l.lng));
 const mapCoordinates=tourOrigin?[...tourMapStops,tourOrigin]:tourMapStops;
 const minLat=mapCoordinates.length?Math.min(...mapCoordinates.map(l=>l.lat)):52.3;
 const maxLat=mapCoordinates.length?Math.max(...mapCoordinates.map(l=>l.lat)):52.4;
 const minLng=mapCoordinates.length?Math.min(...mapCoordinates.map(l=>l.lng)):13;
 const maxLng=mapCoordinates.length?Math.max(...mapCoordinates.map(l=>l.lng)):13.1;
 const projected=(l:{lat:number;lng:number})=>({
  x:28+((l.lng-minLng)/Math.max(.005,maxLng-minLng))*544,
  y:28+((maxLat-l.lat)/Math.max(.005,maxLat-minLat))*284
 });
 const polyline=[...(tourOrigin?[tourOrigin]:[]),...tourMapStops].map(l=>{const p=projected(l);return p.x+","+p.y}).join(" ");
 async function planTour(){
  const picks=eligibleTour.filter(l=>selectedIds.includes(l.id));
  if(!picks.length){setError("Bitte mindestens einen noch offenen Hunter-Lead auswählen.");return;}
  const ordered=optimizeHunterRoute(picks,tourOrigin||undefined);
  setTour(ordered.map(l=>l.id));setTourTitle("");
  setTourFocus(ordered[0]?.id||null);
  setMessage(ordered.length+" Station(en) im Hunter geplant · ca. "+hunterRouteLength(ordered,tourOrigin||undefined).toFixed(1).replace(".",",")+" km Luftlinie. Keine berechnete Fahrzeit oder Straßennavigation.");
 }
 async function startGPS(){
  setTourBusy(true);setError("");
  try{
   const location=await locate();
   setTourOrigin({lat:location.lat,lng:location.lng});setTourTitle("");
   setMessage("GPS-Startpunkt gesetzt. Anschließend „Route nach Nähe planen“ wählen.");
  }catch(e){setError(e instanceof Error?e.message:"GPS konnte nicht ermittelt werden.")}
  finally{setTourBusy(false)}
 }
 async function saveTour(){
  if(demo){setError("Im Demomodus wird keine Route dauerhaft gespeichert.");return;}
  if(!tourStops.length){setError("Bitte zuerst die Route planen.");return;}
  const existing=data.routes.find(r=>r.day===tourDay);
  if(existing&&existing.id!==editingRoute){setError("Für diesen Tag gibt es eine gespeicherte Route. Bitte unten diese Route öffnen und zur Bearbeitung auswählen.");return;}
  setTourBusy(true);setError("");
  try{
   const stops:Stop[]=tourStops.map(l=>({id:l.customer_id||"hunter:"+l.id,company:l.company,address:addressOf(l),lat:Number.isFinite(l.lat)?l.lat:null,lng:Number.isFinite(l.lng)?l.lng:null}));
   await save("routes",{...(existing&&editingRoute===existing.id?existing:{}),day:tourDay,name:"HUNTER · "+tourDay,origin:tourOrigin?tourOrigin.lat+","+tourOrigin.lng:"",stops});
   setTourTitle(tourDay);setEditingRoute(null);
   setMessage("Tour für "+tourDay+" im HUNTER gespeichert. Sie lässt sich hier jederzeit wieder öffnen.");
  }catch(e){setError(e instanceof Error?e.message:"Tagesroute konnte nicht gespeichert werden.")}
  finally{setTourBusy(false)}
 }
 const shown=leads.filter(l=>stageFilter==="Alle"||stageFilter==="Offen"
  ?stageFilter==="Alle"||!["Kein Interesse","Übernommen"].includes(l.status)
  :l.status===stageFilter);
 const overview=[
  ["Vorgemerkt",leads.length],
  ["Noch offen",leads.filter(l=>["Neu","Vorbereitet"].includes(l.status)).length],
  ["Besucht",leads.filter(l=>l.status==="Besucht").length],
  ["Interesse",leads.filter(l=>l.status==="Interesse").length]
 ] as const;
 const noteOf=(l:HunterLead)=>drafts[l.id]??l.note;
 return <div>
  <div className="section-intro"><div>
   <h1>🎯 neXaro HUNTER</h1><p>SumUp · Außendienst in Berlin/Brandenburg · integriert in deine zentrale Kundenakte.</p>
  </div><span className="badge positive">Hunter Core</span></div>
  <div className="nx-hunter-workspace-tabs" role="tablist" aria-label="Außendienst-Arbeitsbereich">
    <button type="button" role="tab" aria-selected={workspaceTab==="search"} className={workspaceTab==="search"?"active":""} onClick={()=>setWorkspaceTab("search")}><Search size={17}/> 1 · Geschäfte finden</button>
    <button type="button" role="tab" aria-selected={workspaceTab==="leads"} className={workspaceTab==="leads"?"active":""} onClick={()=>setWorkspaceTab("leads")}><Check size={17}/> 2 · Merkliste <b>{leads.length}</b></button>
    <button type="button" role="tab" aria-selected={workspaceTab==="tour"} className={workspaceTab==="tour"?"active":""} onClick={()=>setWorkspaceTab("tour")}><RouteIcon size={17}/> 3 · Touren <b>{selectedIds.length||data.routes.length}</b></button>
  </div>
  {workspaceTab==="search"&&  <section className="card" style={{padding:20,marginBottom:16,border:"1px solid #d9e4d6",background:"#f8fbf6"}}>
   <span className="badge positive">HUNTER AUTO · EINGEHENDE ANFRAGEN</span>
   <h2>SumUp-Beratung – optional mit Abrechnung</h2>
   <p>Das kurze Formular erfasst Beratungsanfragen. Auf Wunsch kann der Interessent eine geschwärzte Händlerabrechnung für eine konkretere Angebotsvorbereitung privat hochladen. Im CRM entsteht eine Bearbeitungsaufgabe – keine Werbeeinwilligung.</p>
   <a className="primary" href="https://nexaro-solutions.github.io/new-nexaro-field-sales-crm/sumup-gebuehrencheck.html" target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> SumUp-Beratungsformular öffnen</a>
   <p className="hint">Teile diesen Link nur über zulässige Kanäle, z. B. deine Website, bestehende Unterlagen oder nach einem persönlichen Gespräch. Nicht als unaufgeforderte Werbe-E-Mail versenden.</p>
  </section>}
  {workspaceTab==="tour"&&  <section className="card nx-hunter-tour" aria-label="Hunter Tour und Routenplanung">
    <span className="badge positive">HUNTER ROUTE · IM CRM</span>
    <h2>Deine Touren & Besuche</h2>
    <p className="hint">Öffne deine gespeicherte Tour oder wähle in der Merkliste Geschäfte aus und plane hier einen neuen Besuchstag. Notizen und Entscheidungen bearbeitest du direkt am Stopp.</p>
    <section className="nx-hunter-saved-routes" aria-label="Gespeicherte Touren">
      <h3>Gespeicherte Touren <span>{data.routes.length}</span></h3>
      {!data.routes.length&&<p className="hint">Noch keine Tour gespeichert. Wähle in der Merkliste deine Geschäfte aus und plane hier deinen Besuchstag.</p>}
      {data.routes.slice().sort((a,b)=>b.day.localeCompare(a.day)).map(route=><article className="nx-hunter-saved-route" key={route.id}>
        <button className="nx-hunter-route-header" type="button" onClick={()=>setOpenedRoute(openedRoute===route.id?null:route.id)} aria-expanded={openedRoute===route.id}>
          <span><strong>{dateLabel(route.day)} · {route.name}</strong><small>{route.stops.length} Stopps · {openedRoute===route.id?"Schließen":"Öffnen"}</small></span><ArrowRight size={17}/>
        </button>
        {openedRoute===route.id&&<div className="nx-hunter-saved-route-detail">
          {route.stops.map((st,i)=>{
            const hunter=leads.find(l=>"hunter:"+l.id===st.id||l.customer_id===st.id);
            const customer=data.customers.find(c=>c.id===st.id||c.id===hunter?.customer_id);
            return <div className="nx-hunter-saved-stop" key={st.id+"-"+i}>
              <b>{i+1}</b><span><strong>{st.company}</strong><small>{st.address}</small></span>
              <div className="button-row">
                {hunter&&<button className="secondary" onClick={()=>{setWorkspaceTab("leads");setStageFilter("Alle");setMessage(hunter.company+" ist in deiner Hunter-Merkliste sichtbar.")}}>Im HUNTER bearbeiten</button>}
                {customer&&<button className="primary" onClick={()=>setEditCustomer(customer)}>Kundenakte öffnen</button>}
              </div>
            </div>;
          })}
          <div className="button-row">
            {mapsRoutes(route.stops,route.origin).map((url,i)=><a className="secondary" href={url} target="_blank" rel="noopener noreferrer" key={url}><Navigation size={15}/> Navigation {route.stops.length>4?" · Etappe "+(i+1):""}</a>)}
            <button className="secondary" disabled={tourBusy} onClick={()=>{
              const ids=route.stops.map(st=>leads.find(l=>"hunter:"+l.id===st.id||l.customer_id===st.id)?.id);
              if(ids.some(id=>!id)){setError("Diese Tour enthält bestehende Kunden oder nicht mehr vorgemerkte Stopps. Alle Stopps bleiben gespeichert. Deren Kundenakte lässt sich oben öffnen.");return;}
              const leadIds=ids.filter((id):id is string=>!!id);
              setSelectedIds(leadIds);setTour(leadIds);setTourDay(route.day);setTourTitle(route.day);setEditingRoute(route.id);
              const coords=route.origin.split(",").map(Number);
              setTourOrigin(coords.length===2&&coords.every(Number.isFinite)?{lat:coords[0],lng:coords[1]}:null);
              setOpenedRoute(null);setError("");setMessage("Gespeicherte Hunter-Tour zur Bearbeitung geladen.");
            }}>Tour bearbeiten</button>
            <button className="nx-delete-trigger" onClick={()=>setRouteToDelete(route)}><Trash2 size={15}/> Tour löschen</button>
          </div>
        </div>}
      </article>)}
    </section>
    <div className="nx-hunter-tour-stats"><strong>{selectedIds.length} ausgewählt</strong><span>{eligibleTour.length} offen verfügbar</span><span>{tourStops.length} in der Tour</span></div>
    <div className="button-row">
      <button type="button" className="secondary" onClick={()=>{setSelectedIds(eligibleTour.map(l=>l.id));setTour([])}} disabled={busy}>Alle offenen vormerken</button>
      <button type="button" className="secondary" onClick={()=>{setSelectedIds([]);setTour([]);setTourFocus(null)}} disabled={busy}>Auswahl aufheben</button>
      <button type="button" className="secondary" disabled={tourBusy} onClick={()=>void startGPS()}><MapPin size={15}/> GPS als Start</button>
      <button type="button" className="primary" disabled={tourBusy||!selectedIds.length} onClick={()=>void planTour()}><RouteIcon size={16}/> Route nach Nähe planen</button>
    </div>
    <p className="hint">{tourOrigin?"Startpunkt: ermittelter GPS-Standort":"Startpunkt: erster ausgewählter Standort. Für die Route ab deinem tatsächlichen Standort GPS verwenden."}</p>
    {tourStops.length>0&&<div className="nx-hunter-tour-result">
      <div className="nx-hunter-tour-summary"><strong>{tourStops.length} Stopps in Reihenfolge</strong><span>ca. {hunterRouteLength(tourStops,tourOrigin||undefined).toLocaleString("de-DE",{maximumFractionDigits:1})} km Luftlinie</span></div>
      <p className="hint">Geografisch optimierte Näherung ohne Straßenführung, Stau, Besuchsdauer oder Öffnungszeiten – keine Zusage zur kürzesten Fahrzeit.</p>
      <div className="nx-hunter-tour-map" role="img" aria-label="Schematische geografische Übersicht der ausgewählten Hunter-Route">
        <svg viewBox="0 0 600 340" preserveAspectRatio="xMidYMid meet">
          <rect width="600" height="340" rx="16" fill="#f6faee"/>
          <polyline points={polyline} fill="none" stroke="#ff7829" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="9 4"/>
          {tourOrigin&&<g><circle cx={projected(tourOrigin).x} cy={projected(tourOrigin).y} r="11" fill="#244b2c" stroke="#fff" strokeWidth="3"/><text x={projected(tourOrigin).x+12} y={projected(tourOrigin).y-13} fill="#244b2c" fontSize="14" fontWeight="700">Start</text></g>}
          {tourMapStops.map((l,i)=>{const v=projected(l);return <g key={l.id}>
            <circle cx={v.x} cy={v.y} r="13" fill={tourFocus===l.id?"#ff7829":"#caff47"} stroke="#244b2c" strokeWidth="2"/>
            <text x={v.x} y={v.y+5} textAnchor="middle" fontSize="14" fill="#223a20" fontWeight="800">{i+1}</text>
          </g>})}
        </svg>
      </div>
      <p className="hint">Schematische Karte anhand der OSM-Koordinaten; die echte Standortkarte erscheint, sobald du einen Stopp unten auswählst.</p>
      <div className="nx-hunter-tour-stops">{tourStops.map((l,i)=><article key={l.id} className={"nx-hunter-tour-stop"+(tourFocus===l.id?" active":"")}>
        <button type="button" className="nx-hunter-stop-focus" onClick={()=>setTourFocus(l.id)}>
          <b>{i+1}</b><span><strong>{l.company}</strong><small>{addressOf(l)||"Adresse prüfen"} · {l.status}</small></span><ArrowRight size={18}/>
        </button>
        <div className="button-row">
          <button type="button" className="secondary" disabled={i===0} onClick={()=>{setTourTitle("");setTour(x=>{const a=[...x];[a[i],a[i-1]]=[a[i-1],a[i]];return a})}}><ArrowUp size={14}/> Hoch</button>
          <button type="button" className="secondary" disabled={i===tourStops.length-1} onClick={()=>{setTourTitle("");setTour(x=>{const a=[...x];[a[i],a[i+1]]=[a[i+1],a[i]];return a})}}><ArrowDown size={14}/> Runter</button>
          <button type="button" className="secondary" onClick={()=>{selectLead(l,false);setTourFocus(null)}}><X size={14}/> Aus Tour</button>
        </div>
        {tourFocus===l.id&&<div className="nx-hunter-visit-actions">
          {Number.isFinite(l.lat)&&Number.isFinite(l.lng)&&<iframe title={"OSM Standortkarte "+l.company} loading="lazy" referrerPolicy="no-referrer" src={osmEmbed(l,.65,l)} />}
          <label>Besuchsnotiz<textarea value={noteOf(l)} onChange={e=>setDrafts(v=>({...v,[l.id]:e.target.value}))} rows={3} maxLength={3000}/></label>
          <div className="button-row">
            <button className="secondary" disabled={busy||noteOf(l)===l.note} onClick={()=>void updateLead(l,l.status,noteOf(l))}><Check size={15}/> Notiz speichern</button>
            <button className="secondary" disabled={busy} onClick={()=>void updateLead(l,"Besucht",noteOf(l))}>Als besucht markieren</button>
            <button className="primary" disabled={busy||!!l.customer_id} onClick={()=>void promote(l)}>Ins CRM übernehmen</button>
            {l.status!=="Kein Interesse"&&<button className="secondary" disabled={busy} onClick={()=>setRejectLead(l)}>Ablehnen</button>}
            {l.customer_id&&data.customers.find(c=>c.id===l.customer_id)&&<button className="primary" onClick={()=>setEditCustomer(data.customers.find(c=>c.id===l.customer_id)!)}>Kundenakte bearbeiten</button>}
       <button className="nx-delete-trigger" disabled={busy} onClick={()=>setConfirmDelete(l)}>Löschen</button>
          </div>
        </div>}
      </article>)}</div>
      <div className="nx-hunter-tour-save">
        <label>Besuchstag<input type="date" value={tourDay} onChange={e=>{setTourDay(e.target.value);setTourTitle("");setEditingRoute(null)}}/></label>
        <button className="primary" type="button" disabled={tourBusy||!tourDay||!!tourTitle&&tourTitle===tourDay} onClick={()=>void saveTour()}><Check size={16}/> {tourBusy?"Speichern …":tourTitle===tourDay?"Im CRM gespeichert":"Tour im CRM speichern"}</button>
      </div>
      <p className="hint">Tour speichern, später hier öffnen und Kontakte bei jedem Halt bearbeiten. Für die Straßen-Navigation öffnest du bei Bedarf Maps.</p>
    </div>}
  </section>}
  {workspaceTab==="leads"&&<div className="analysis-grid">{overview.map(([name,n])=><div className="card" key={name} style={{padding:18}}><small>{name}</small><h2 style={{fontSize:30,margin:"8px 0"}}>{n}</h2></div>)}</div>
  <div className="route-grid">
   {workspaceTab==="search"&&<div>
    <section className="card" style={{padding:20,marginBottom:16}}>
     <h2>Geschäfte vor Ort finden</h2>
     <p className="hint">Manuelle Einzelsuche mit vorhandener OSM-Standortsuche und deren Filtern für Behörden, Krankenhäuser und bekannte Ketten. Keine automatisierte Massensuche.</p>
     <div className="form-grid">
      <label>PLZ / Ort / Straße<input value={place} onChange={e=>setPlace(e.target.value)} placeholder="15757 Halbe"/></label>
      <label>Umkreis<select value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[1,2,5,10].map(k=><option key={k} value={k}>{k} km</option>)}</select></label>
      <label>Branche<select value={category} onChange={e=>setCategory(e.target.value)}>{businessCategories.filter(b=>!["vape","health","office"].includes(b.id)).map(b=><option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
     </div>
     <div className="button-row">
      <button className="primary" disabled={busy||place.trim().length<3} onClick={()=>void lookup()}><Search size={16}/> {busy?"Suche läuft …":"Geschäfte suchen"}</button>
      <button className="secondary" disabled={busy} onClick={()=>void lookup(true)}><Navigation size={16}/> Mein Standort</button>
     </div>
     {center&&<iframe title="Hunter Suchgebiet" loading="lazy" referrerPolicy="no-referrer" src={osmEmbed(center,radius,focused||undefined)} style={{width:"100%",height:280,border:"1px solid #dce5d5",borderRadius:12,marginTop:14}}/>}
     {cached&&<p className="hint">Zwischengespeicherte Suchergebnisse – öffentliche Schnittstelle wurde geschont.</p>}
     <small>© OpenStreetMap-Mitwirkende (ODbL). Treffer sind Recherchehinweise, keine vollständig verifizierten Unternehmens- oder Kontaktdaten.</small>
    </section>
    <section className="card" style={{padding:20}}>
     <h2>Recherchetreffer ({results.length})</h2>
     {results.length===0&&<p className="hint">Starte eine Suche, um lokale, bereits gefilterte Geschäfte zu sehen.</p>}
     {results.map(p=>{
      const duplicate=hunterDuplicate(p,data.customers),existing=bySource.get("osm:"+p.id);
      return <div key={p.id} className="prospect" style={{padding:"14px 0",borderBottom:"1px solid #e8ede5",display:"block"}}>
       <strong>{p.name}</strong><small style={{display:"block"}}>{addressOf(p)||"Adresse vor Ort prüfen"} · {p.category}</small>
       {duplicate?<p className="hint">✓ Bereits in zentraler Kundenakte: {duplicate.company}</p>:existing?<p className="hint">✓ Hunter-Merkliste: {existing.status}</p>:null}
       <div className="button-row" style={{flexWrap:"wrap",marginTop:8}}>
        <button className="secondary" onClick={()=>setFocused(p)}><MapPin size={15}/> Karte</button>
        <a className="secondary" target="_blank" rel="noopener noreferrer" href={mapSearch([p.name,addressOf(p)].join(" "))}>Maps ↗</a>
        <button className="primary" disabled={busy||!!duplicate||!!existing} onClick={()=>void remember(p)}><Plus size={15}/> Vormerken</button>
       </div>
      </div>
     })}
    </section>
   </div>}
   {workspaceTab==="leads"&&<div>
    <section className="card" style={{padding:20}}>
     <h2>Meine vorgemerkten Geschäfte</h2>
     <p className="hint">Vormerken legt noch keinen zusätzlichen Kunden an. Erst „Ins CRM übernehmen“ erstellt die zentrale Kundenakte.</p>
     <label>Filter<select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}>{["Offen","Alle",...stages].map(st=><option key={st}>{st}</option>)}</select></label>
     <div className="button-row"><button className="secondary" disabled={busy||demo} onClick={()=>void loadLeads().catch(e=>setError((e as Error).message))}><RefreshCw size={15}/> Aktualisieren</button></div>
     {shown.length===0&&<p className="hint">Noch keine passenden Geschäfte vorgemerkt.</p>}
     {shown.map(l=><div key={l.id} style={{padding:"16px 0",borderBottom:"1px solid #e5eae0"}}>
      <label className="nx-hunter-select"><input type="checkbox" checked={selectedIds.includes(l.id)} disabled={busy||["Kein Interesse","Übernommen"].includes(l.status)} onChange={e=>selectLead(l,e.target.checked)}/> <strong>{l.company}</strong><span>{selectedIds.includes(l.id)?"Für Tour ausgewählt":"Für Tour auswählen"}</span></label><small style={{display:"block"}}>{addressOf(l)}</small>
      <small style={{display:"block"}}>Quelle: OpenStreetMap {l.source_id.replace(/^osm:/,"")}</small>
      <label>Status<select disabled={busy} value={l.status} onChange={e=>void updateLead(l,e.target.value as HunterStage,noteOf(l))}>{stages.map(st=><option key={st}>{st}</option>)}</select></label>
      <label>Besuchsnotiz<textarea rows={3} maxLength={3000} value={noteOf(l)} onChange={e=>setDrafts(d=>({...d,[l.id]:e.target.value}))} placeholder="Ansprechpartner, Bedarf, nächster Schritt – nur gesicherte Gesprächsinformationen."/></label>
      <div className="button-row" style={{flexWrap:"wrap"}}>
       <button className="secondary" disabled={busy||noteOf(l)===l.note} onClick={()=>void updateLead(l,l.status,noteOf(l))}><Check size={15}/> Notiz speichern</button>
       <a className="secondary" href={mapSearch(l.company+" "+addressOf(l))} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Navigation</a>
       <button className="primary" disabled={busy||!!l.customer_id} onClick={()=>void promote(l)}>Ins CRM übernehmen</button>
       {l.status!=="Kein Interesse"&&l.status!=="Übernommen"&&<button type="button" className="secondary" disabled={busy} onClick={()=>setRejectLead(l)}><X size={15}/> Ablehnen</button>}
       {l.customer_id&&data.customers.find(c=>c.id===l.customer_id)&&<button className="secondary" onClick={()=>setEditCustomer(data.customers.find(c=>c.id===l.customer_id)!)}>Kundenakte bearbeiten</button>}
       <button type="button" className="nx-delete-trigger" disabled={busy} onClick={()=>setConfirmDelete(l)}><Trash2 size={15}/> Löschen</button>
      </div>
      {l.customer_id&&<p className="hint">✓ Zentraler Kunde verknüpft – weitere Bearbeitung direkt hier im Außendienst.</p>}
     </div>)}
    </section>
   </div>}
  </div>
  {routeToDelete&&<div className="nx-hunter-overlay" role="presentation"><section className="nx-hunter-confirm" role="dialog" aria-modal="true" aria-label="Gespeicherte Tour löschen">
    <h3>Gespeicherte Tour endgültig löschen?</h3>
    <p>Die Tour „{routeToDelete.name}“ vom {dateLabel(routeToDelete.day)} wird entfernt. Alle Hunter-Einträge und Kundenakten bleiben bestehen.</p>
    <div className="button-row">
      <button className="nx-delete-confirm-button" disabled={tourBusy} onClick={async()=>{
        if(!routeToDelete||tourBusy)return;
        setTourBusy(true);setError("");
        try{
          await remove("routes",routeToDelete.id);
          setOpenedRoute(null);setEditingRoute(null);setRouteToDelete(null);setTourTitle("");
          setMessage("Tour entfernt – Kunden und Merkliste unverändert.");
        }catch(e){setError(e instanceof Error?e.message:"Tour konnte nicht gelöscht werden.")}
        finally{setTourBusy(false)}
      }}>Tour endgültig löschen</button>
      <button className="secondary" disabled={tourBusy} onClick={()=>setRouteToDelete(null)}>Abbrechen</button>
    </div>
  </section></div>}
  {editCustomer&&<CustomerForm customer={editCustomer} division="sumup" onClose={()=>{setEditCustomer(null);void refresh()}}/>}
  {confirmDelete&&<div className="nx-hunter-overlay" role="presentation">
    <section className="nx-hunter-confirm" role="dialog" aria-modal="true" aria-label="Hunter-Eintrag löschen">
      <h3>Eintrag endgültig löschen?</h3><p>„{confirmDelete.company}“ wird aus der Hunter-Merkliste und der aktuellen Tourauswahl entfernt.</p>
      {confirmDelete.customer_id&&<p className="hint">Die bereits übernommene zentrale Kundenakte und bestehende gespeicherte Tagesrouten bleiben erhalten.</p>}
      <div className="button-row">
        <button className="nx-delete-confirm-button" disabled={busy} onClick={()=>void deleteLead(confirmDelete)}><Trash2 size={16}/> Löschen bestätigen</button>
        <button className="secondary" disabled={busy} onClick={()=>setConfirmDelete(null)}>Abbrechen</button>
      </div>
    </section>
  </div>}
  {rejectLead&&<div className="nx-hunter-overlay" role="presentation">
    <section className="nx-hunter-confirm" role="dialog" aria-modal="true" aria-label="Hunter-Lead ablehnen">
      <h3>Kein Interesse dokumentieren?</h3><p>„{rejectLead.company}“ wird als „Kein Interesse“ markiert und aus der offenen Tourauswahl genommen, bleibt aber unter dem Filter „Alle“ erhalten.</p>
      <div className="button-row">
        <button className="primary" disabled={busy} onClick={async()=>{const l=rejectLead;await updateLead(l,"Kein Interesse",noteOf(l));setRejectLead(null)}}>Ablehnen und speichern</button>
        <button className="secondary" disabled={busy} onClick={()=>setRejectLead(null)}>Abbrechen</button>
      </div>
    </section>
  </div>}
  {message&&<p className="notice" role="status">{message}</p>}
  {error&&<p className="error" role="alert">{error}</p>}
  <p className="hint">B2B-Kontaktregeln beachten: Keine automatischen Werbe-E-Mails oder Massenanrufe. OSM-Daten können veraltet sein; berechtigten Kontaktgrund, Widersprüche und Quelle dokumentieren.</p>
 </div>;
}
