// neXaro CRM → iCloud CalDAV. Disabled until the owner independently supplies
// secrets in Supabase AND explicitly enables synchronization. No credential
// is ever accepted from or returned to a browser.
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
const url=Deno.env.get("SUPABASE_URL")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
const origin="https://nexaro-solutions.github.io";
const respond=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{
 "Content-Type":"application/json","Cache-Control":"no-store",
 "Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type",
 "Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin",
 "X-Content-Type-Options":"nosniff"
}});
const env=(key:string)=>Deno.env.get(key)?.trim()||"";
const config=()=>({enabled:env("NX_ICLOUD_ENABLED")==="true",
 ready:!!(env("NX_ICLOUD_APPLE_ID")&&env("NX_ICLOUD_APP_PASSWORD")),
 calendar:"neXaro Außendienst", direction:"CRM → iCloud", reminderMinutes:30});
const validate=(raw:string)=>{
 const u=new URL(raw,"https://caldav.icloud.com");
 if(u.protocol!=="https:"||!(/^(?:caldav|p\d+-caldav)\.icloud\.com$/i.test(u.hostname))
 ||u.username||u.password||u.port)throw Error("Ungültiges CalDAV-Ziel.");
 return u.href;
};
function prop(xml:string,key:string) {
 const element=new RegExp("<(?:[\\w.-]+:)?"+key+"\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?"+key+">","i").exec(xml)?.[1]||"";
 return /<(?:[\w.-]+:)?href\b[^>]*>([^<]+)<\/(?:[\w.-]+:)?href>/i.exec(element)?.[1]?.trim()||"";
}
function responses(xml:string){
 return [...xml.matchAll(/<(?:[\w.-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?response>/gi)]
  .map(m=>({xml:m[1],href:prop(m[1],"href")||/<(?:[\w.-]+:)?href\b[^>]*>([^<]+)/i.exec(m[1])?.[1]||""}));
}
const reqXml=(property:string)=>'<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop>'+property+'</d:prop></d:propfind>';
const toAuth=()=>{
 const value=new TextEncoder().encode(env("NX_ICLOUD_APPLE_ID")+":"+env("NX_ICLOUD_APP_PASSWORD"));
 return "Basic "+btoa(String.fromCharCode(...value));
};
async function dav(target:string,method:string,body?:string,additional:Record<string,string>={}) {
 let current=validate(target);
 for(let step=0;step<5;step++){
  const response=await fetch(current,{method,headers:{
   Authorization:toAuth(),...additional,...(body?{"Content-Type":method==="PUT"?"text/calendar; charset=utf-8":"application/xml; charset=utf-8"}:{})
  },body,signal:AbortSignal.timeout(18000),redirect:"manual"});
  if([301,302,307,308].includes(response.status)){
   const destination=response.headers.get("location");
   if(!destination)throw Error("Ungültige CalDAV-Weiterleitung.");
   // Never forward the Apple credential to a non-iCloud host.
   current=validate(new URL(destination,current).href);
   continue;
  }
  if(response.status===401||response.status===403)throw Error("iCloud-Zugriff nicht autorisiert. Anwendungsspezifisches Passwort prüfen.");
  return response;
 }
 throw Error("Zu viele iCloud CalDAV-Weiterleitungen.");
}
async function propfind(target:string,property:string,depth="0") {
 const response=await dav(target,"PROPFIND",reqXml(property),{Depth:depth});
 if(response.status!==207)throw Error("iCloud CalDAV antwortet nicht wie erwartet (HTTP "+response.status+").");
 return {xml:await response.text(),url:response.url};
}
async function calendarUrl() {
 const principal=await propfind("https://caldav.icloud.com/","<d:current-user-principal/>");
 const principalHref=prop(principal.xml,"current-user-principal");
 if(!principalHref)throw Error("iCloud CalDAV Principal fehlt.");
 const home=await propfind(new URL(principalHref,principal.url).href,"<c:calendar-home-set/>");
 const homeHref=prop(home.xml,"calendar-home-set");
 if(!homeHref)throw Error("iCloud Kalenderverzeichnis fehlt.");
 const calendars=await propfind(new URL(homeHref,home.url).href,
  "<d:displayname/><d:resourcetype/>","1");
 const selected=responses(calendars.xml).find(item=>
  /<(?:[\w.-]+:)?calendar(?:\s|\/|>)/i.test(item.xml)&&
  /<(?:[\w.-]+:)?displayname(?:\s[^>]*)?>\s*neXaro Außendienst\s*<\/(?:[\w.-]+:)?displayname>/i.test(item.xml));
 if(!selected)throw Error("Der iCloud-Kalender „neXaro Außendienst“ fehlt. Bitte zuerst in Apple Kalender anlegen.");
 return validate(new URL(selected.href,calendars.url).href);
}
const fold=(line:string)=>{
 let bytes=0,current="",rows:string[]=[];const encoder=new TextEncoder();
 for(const c of line){const n=encoder.encode(c).length;if(bytes+n>73&&current){rows.push(current);current=" ";bytes=1;}current+=c;bytes+=n;}
 rows.push(current);return rows.join("\r\n");
};
const esc=(s:string)=>s.replace(/\\/g,"\\\\").replace(/\r\n?|\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
const stamp=(s:string)=>new Date(s).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
function ics(task:Record<string,unknown>,customer?:Record<string,unknown>){
 const start=new Date(String(task.due_at));
 if(!Number.isFinite(start.valueOf()))throw Error("Ungültiges CRM-Termindatum.");
 const c=(k:string)=>String(customer?.[k]||"");
 const where=[c("street"),[c("zip"),c("city")].filter(Boolean).join(" ")].filter(Boolean).join(", ");
 const note=[customer?"Kunde: "+c("company"):"",c("contact")?"Kontakt: "+c("contact"):"",
 c("phone")?"Telefon: "+c("phone"):"",c("email")?"E-Mail: "+c("email"):"",
 String(task.notes||""),"CRM-ID: "+String(task.id)].filter(Boolean).join("\n");
 return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//neXaro Solutions//Sales Hub//DE",
 "CALSCALE:GREGORIAN","BEGIN:VEVENT",
 "UID:"+String(task.id)+"@crm.nexaro-solutions.de",
 "SEQUENCE:"+Math.max(0,Number(task.version||1)-1),
 "DTSTAMP:"+stamp(String(task.updated_at||task.created_at||task.due_at)),
 "DTSTART:"+stamp(String(task.due_at)),
 "DTEND:"+stamp(new Date(start.getTime()+60*60000).toISOString()),
 "SUMMARY:"+esc(String(task.title)+(customer?" · "+c("company"):"")),
 ...(where?["LOCATION:"+esc(where)]:[]),
 "DESCRIPTION:"+esc(note),"CLASS:PRIVATE","STATUS:CONFIRMED",
 "BEGIN:VALARM","TRIGGER:-PT30M","ACTION:DISPLAY",
 "DESCRIPTION:neXaro Termin","END:VALARM","END:VEVENT","END:VCALENDAR"
 ].map(fold).join("\r\n")+"\r\n";
}
async function processSync() {
 const base=await calendarUrl();
 const {data:tasks,error:taskError}=await admin.from("nx_tasks").select("*").eq("kind","Termin").eq("done",false).order("updated_at",{ascending:true});
 if(taskError)throw Error("CRM-Termine konnten nicht gelesen werden.");
 const {data:customers,error:customerError}=await admin.from("nx_customers").select("*");
 if(customerError)throw Error("Kunden konnten nicht gelesen werden.");
 const {data:records,error:recordsError}=await admin.from("nx_icloud_sync").select("*");
 if(recordsError)throw Error("Kalender-Synchronisationsstatus konnte nicht gelesen werden.");
 const customerMap=new Map((customers||[]).map(c=>[c.id,c]));
 const recordMap=new Map((records||[]).map(r=>[r.task_id,r]));
 const current=new Set((tasks||[]).map(t=>t.id));
 let synced=0,deleted=0,errors=0; const maxChanges=40; let changes=0;
 for(const task of tasks||[]) {
  const old=recordMap.get(task.id);
  if(old?.synced_version===task.version && old?.last_success)continue;
  if(changes++>=maxChanges)break;
  const href=validate(old?.event_href||new URL("nexaro-"+task.id+".ics",base.endsWith("/")?base:base+"/").href);
  try {
   const result=await dav(href,"PUT",ics(task,customerMap.get(task.customer_id)),{
    ...(old?.etag?{"If-Match":old.etag}:old?.synced_version?{"If-Match":"*"}:{"If-None-Match":"*"})
   });
   if(![200,201,204].includes(result.status))throw Error("Kalendereintrag nicht gespeichert (HTTP "+result.status+").");
   const {error}=await admin.from("nx_icloud_sync").upsert({
    task_id:task.id,event_href:href,etag:result.headers.get("ETag")||"",
    synced_version:task.version,last_attempt:new Date().toISOString(),
    last_success:new Date().toISOString(),last_error:""
   });
   if(error)throw Error("Synchronisationsstatus konnte nicht gespeichert werden.");
   synced++;
  }catch(e){
   errors++;
   await admin.from("nx_icloud_sync").upsert({
    task_id:task.id,event_href:href,etag:old?.etag||"",
    synced_version:old?.synced_version||0,last_attempt:new Date().toISOString(),
    last_success:old?.last_success||null,
    last_error:String((e as Error).message||"Fehler").slice(0,450)
   });
  }
 }
 for(const old of records||[]){
  if(current.has(old.task_id)||!old.event_href||changes++>=maxChanges)continue;
  try{
   const result=await dav(old.event_href,"DELETE",undefined,old.etag?{"If-Match":old.etag}:{});
   if(![200,204,404,410].includes(result.status))throw Error("Kalenderlöschung fehlgeschlagen (HTTP "+result.status+").");
   const {error}=await admin.from("nx_icloud_sync").delete().eq("task_id",old.task_id);
   if(error)throw Error("Sync-Metadaten konnten nicht gelöscht werden.");
   deleted++;
  }catch{errors++;}
 }
 return {synced,deleted,errors};
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return respond(204,{});
 if(req.method!=="POST")return respond(405,{error:"method_not_allowed"});
 if(req.headers.get("origin")&&req.headers.get("origin")!==origin)return respond(403,{error:"origin_not_allowed"});
 const bearer=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
 if(!bearer)return respond(401,{error:"authentication_required"});
 // A dedicated service-role invocation may only be used by a future trusted
 // scheduled job; do not enable that job until owner approves account linking.
 const worker=bearer===serviceKey;
 if(!worker){
  const {data:{user},error}=await admin.auth.getUser(bearer);
  if(error||!user)return respond(401,{error:"authentication_required"});
  const {data:owner,error:ownerError}=await admin.from("nx_owner").select("user_id").eq("user_id",user.id).maybeSingle();
  if(ownerError||!owner)return respond(403,{error:"owner_only"});
 }
 const conf=config();
 if(!conf.enabled||!conf.ready)return respond(200,{status:"not_connected",calendar:conf.calendar,
  direction:conf.direction,reminderMinutes:30,credentialsStored:false});
 let body:{action?:string}={};
 try{body=await req.json();}catch{return respond(400,{error:"invalid_json"});}
 if(body.action==="status")return respond(200,{status:"configured",calendar:conf.calendar,
  direction:conf.direction,reminderMinutes:30,credentialsStored:true});
 if(body.action!=="sync")return respond(400,{error:"unknown_action"});
 try {const result=await processSync();return respond(200,{status:result.errors?"partial":"synced",...result,calendar:conf.calendar});}
 catch(e){return respond(503,{status:"error",error:(e as Error).message.slice(0,250)});}
});
