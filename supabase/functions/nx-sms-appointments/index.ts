import { createClient } from "npm:@supabase/supabase-js@2.116.0";
const url=Deno.env.get("SUPABASE_URL")||"";
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type","access-control-allow-methods":"POST,OPTIONS"}});
const html=(s:string,status=200)=>new Response(s,{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","referrer-policy":"no-referrer","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
const escape=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("");
const berlin=(d:Date,opts:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",...opts}).format(d);
const berlinDay=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const page=(body:string)=>html('<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>neXaro · Termin</title><style>body{font:17px system-ui;background:#f5f7f5;color:#19241c;margin:0;padding:24px}main{max-width:520px;margin:7vh auto;background:white;border:1px solid #e0e8df;border-radius:20px;padding:30px;box-shadow:0 12px 40px #253a2613}h1{color:#df6717}button{background:#c8f543;border:0;border-radius:12px;padding:14px 18px;font-size:17px;cursor:pointer;margin:5px 0}input,textarea{width:100%;box-sizing:border-box;padding:12px;margin:8px 0;border:1px solid #bac9bc;border-radius:9px;font:inherit}a{color:#965112}label{display:block;margin-top:12px}</style><main><h1>neXaro Solutions</h1>'+body+'</main></html>');
async function owner(req:Request){
 const bearer=req.headers.get("authorization")||"";
 if(!bearer.startsWith("Bearer "))return false;
 const auth=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")||"",{auth:{persistSession:false}});
 const {data,error}=await auth.auth.getUser(bearer.slice(7));
 if(error||!data.user)return false;
 const result=await db.from("nx_owner").select("user_id").eq("user_id",data.user.id).maybeSingle();
 return !!result.data&&!result.error;
}
async function publicAction(req:Request){
 const u=new URL(req.url);
 const form=req.method==="POST"?await req.formData():null;
 const token=String(form?.get("token")||u.searchParams.get("token")||"");
 if(!/^[a-f0-9]{64}$/.test(token))return page("<p>Dieser Link ist ungültig.</p>");
 const hash=await digest(token);
 const {data:record}=await db.from("nx_sms_appointments").select("task_id,status,scheduled_due_at").eq("token_hash",hash).maybeSingle();
 if(!record)return page("<p>Dieser Terminlink ist nicht mehr gültig. Bitte kontaktieren Sie neXaro Solutions.</p>");
 const {data:task}=await db.from("nx_tasks").select("id,title,due_at,kind,done").eq("id",record.task_id).maybeSingle();
 if(!task||task.kind!=="Termin"||task.done||task.due_at!==record.scheduled_due_at)return page("<p>Dieser Termin wurde inzwischen geändert oder abgesagt. Bitte kontaktieren Sie neXaro Solutions.</p>");
 const info="<p><strong>"+escape(task.title)+"</strong><br>"+escape(berlin(new Date(task.due_at),{weekday:"long",day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}))+" Uhr</p>";
 if(req.method!=="POST"){
 if(record.status==="confirmed")return page(info+"<p>✓ Der Termin ist bestätigt.</p>");
 if(record.status==="reschedule_requested")return page(info+"<p>Ihr Verschiebungswunsch wurde übermittelt. Der neue Termin ist erst nach Rückbestätigung durch neXaro verbindlich.</p>");
 if(record.status!=="sent")return page("<p>Dieser Terminlink ist nicht aktiv.</p>");
 return page(info+'<form method="post"><input type="hidden" name="token" value="'+token+'"><button name="action" value="confirm">✓ Termin bestätigen</button></form><hr><h2>Termin verschieben</h2><p>Schlagen Sie ein neues Datum und eine Uhrzeit vor. Der bisherige Termin bleibt bestehen, bis wir Ihnen den neuen Termin bestätigen.</p><form method="post"><input type="hidden" name="token" value="'+token+'"><label>Wunschtermin (Datum)<input name="day" type="date" required></label><label>Uhrzeit<input name="time" type="time" required></label><label>Bemerkung (optional)<textarea name="note" maxlength="300"></textarea></label><button name="action" value="reschedule">Verschiebung anfragen</button></form>');
 }
 if(record.status!=="sent")return page(info+"<p>Ihre Rückmeldung wurde bereits erfasst oder der Link ist nicht mehr aktiv.</p>");
 const action=String(form?.get("action")||"");
 if(action==="confirm"){
 const {data,error}=await db.from("nx_sms_appointments").update({status:"confirmed",confirmed_at:new Date().toISOString()}).eq("task_id",task.id).eq("status","sent").eq("token_hash",hash).select("task_id");
 return page(info+(error||!data?.length?"<p>Die Bestätigung konnte nicht gespeichert werden. Bitte erneut versuchen.</p>":"<p>✓ Vielen Dank! Ihr Termin ist bestätigt.</p>"));
 }
 if(action==="reschedule"){
 const day=String(form?.get("day")||""),time=String(form?.get("time")||""),note=String(form?.get("note")||"").trim().slice(0,300);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d{2}:\d{2}$/.test(time)||day<berlinDay(new Date()))return page(info+"<p>Bitte geben Sie einen gültigen zukünftigen Wunschtermin an.</p>",400);
 const msg="Wunschtermin: "+day+" "+time+" Uhr"+(note?" · "+note:"");
 const {data,error}=await db.from("nx_sms_appointments").update({status:"reschedule_requested",requested_at:new Date().toISOString(),request_note:msg}).eq("task_id",task.id).eq("status","sent").eq("token_hash",hash).select("task_id");
 return page(info+(error||!data?.length?"<p>Die Anfrage konnte nicht gespeichert werden. Bitte erneut versuchen.</p>":"<p>Ihr Verschiebungswunsch wurde übermittelt. Der neue Termin ist erst nach Rückbestätigung durch neXaro verbindlich.</p>"));
 }
 return page("<p>Unbekannte Aktion.</p>",400);
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return json({});
 try{
 const u=new URL(req.url);
 if(req.method==="GET"||(req.method==="POST"&&(req.headers.get("content-type")||"").includes("application/x-www-form-urlencoded")))return await publicAction(req);
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const body=await req.json().catch(()=>({}));
 if(body.action==="dispatch") return json({enabled:false,reason:"SMS permanently disabled: switched to email confirmations"},410);
 if(!(await owner(req)))return json({error:"Unauthorized"},401);
 return json({ready:true,enabled:false,message:"Legacy appointment link handler only; email dispatch uses nx-email-appointments"});
 }catch(e){return json({error:String(e)},500)}
});
