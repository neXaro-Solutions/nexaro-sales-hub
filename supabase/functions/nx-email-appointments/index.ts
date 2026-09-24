import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import nodemailer from "npm:nodemailer@7.0.6";

const env=(name:string)=>Deno.env.get(name)||"";
const client=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const berlinDay=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const berlinTime=(date:Date)=>new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Berlin",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(date);
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,"0")).join("");
const validMail=(mail:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)&&mail.length<=254;
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
function configReady(){
 return ["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASSWORD","SMTP_FROM","NX_SMS_CRON_SECRET"].every(name=>env(name))&&env("NX_EMAIL_ENABLED")==="true";
}
async function dispatch(){
 if(!configReady())return response({enabled:false,reason:"SMTP credentials or email dispatch approval missing"});
 const now=new Date(),clock=berlinTime(now),day=berlinDay(now);
 if(clock<"07:30"||clock>"07:59")return response({skipped:"Outside 07:30–07:59 Europe/Berlin"});
 const {data:records,error}=await client.from("nx_sms_appointments").select("task_id,status").eq("enabled",true).in("status",["planned","failed"]).limit(200);
 if(error)return response({error:"Could not read appointment confirmations"},500);
 const port=Number(env("SMTP_PORT"));
 if(!Number.isInteger(port)||port<1||port>65535)return response({error:"Invalid SMTP port"},503);
 const transport=nodemailer.createTransport({host:env("SMTP_HOST"),port,secure:port===465,auth:{user:env("SMTP_USER"),pass:env("SMTP_PASSWORD")},connectionTimeout:12000,greetingTimeout:12000,socketTimeout:20000});
 let sent=0,failed=0,skipped=0;
 try{
 for(const record of records||[]){
 const {data:task}=await client.from("nx_tasks").select("id,title,division,due_at,done,kind,customer_id").eq("id",record.task_id).maybeSingle();
 if(!task||task.kind!=="Termin"||task.done||!task.customer_id||berlinDay(new Date(task.due_at))!==day||new Date(task.due_at).getTime()<=Date.now()){skipped++;continue}
 const {data:customer}=await client.from("nx_customers").select("contact,company,email").eq("id",task.customer_id).maybeSingle();
 if(!customer||!validMail(customer.email||"")){skipped++;continue}
 const raw=crypto.getRandomValues(new Uint8Array(32));
 const token=Array.from(raw).map(n=>n.toString(16).padStart(2,"0")).join("");
 const hash=await digest(token);
 const locked=await client.from("nx_sms_appointments").update({status:"sending",token_hash:hash,scheduled_due_at:task.due_at,failure_reason:null,updated_at:new Date().toISOString()}).eq("task_id",task.id).in("status",["planned","failed"]).eq("enabled",true).select("task_id");
 if(!locked.data?.length){skipped++;continue}
 const when=berlinTime(new Date(task.due_at));
 const topic=task.division==="sumup"?"kostenlosen Tarifvergleich Ihrer Kartenzahlungsgebühren":task.division==="vape"?"Gespräch über unser Vape- und Trendartikel-Sortiment":task.title;
 const prepare=task.division==="sumup"?"Bitte halten Sie eine aktuelle Abrechnung Ihres bisherigen Zahlungsanbieters bereit.":task.division==="vape"?"Gern besprechen wir Sortiment und mögliche Konditionen für Ihr Geschäft.":"";
 const link=env("SUPABASE_URL")+"/functions/v1/nx-sms-appointments?token="+token;
 const salutation=customer.contact?"Guten Morgen "+customer.contact+",":"Guten Morgen,";
 const message=salutation+"\n\nwir erinnern Sie an unseren heutigen Termin um "+when+" Uhr zum Thema "+topic+".\n"+prepare+"\n\nBestätigen oder Verschiebung anfragen: "+link+"\n\nViele Grüße\nneXaro Solutions";
 try{
 const result=await transport.sendMail({from:env("SMTP_FROM"),to:customer.email,subject:"Ihr heutiger Termin um "+when+" Uhr | neXaro Solutions",text:message,html:'<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#182818"><h1 style="color:#ed6d15">neXaro Solutions</h1><p>'+escape(salutation)+'</p><p>Wir erinnern Sie an unseren heutigen Termin um <strong>'+escape(when)+' Uhr</strong> zum Thema '+escape(topic)+'.</p><p>'+escape(prepare)+'</p><p><a href="'+escape(link)+'" style="display:inline-block;padding:14px 20px;border-radius:8px;background:#d4fa51;color:#142114;text-decoration:none">Termin bestätigen oder verschieben</a></p><p>Viele Grüße<br>neXaro Solutions</p></div>'});
 const updated=await client.from("nx_sms_appointments").update({status:"sent",sent_at:new Date().toISOString(),twilio_sid:null,failure_reason:null,updated_at:new Date().toISOString()}).eq("task_id",task.id).eq("status","sending");
 if(updated.error)throw Error("SMTP accepted message but database update failed: "+String(result.messageId||""));
 sent++;
 }catch(e){
 const reason=String(e).slice(0,250);
 if(reason.includes("database update failed")){failed++;continue} // do not retry an accepted email
 await client.from("nx_sms_appointments").update({status:"failed",token_hash:null,failure_reason:reason,updated_at:new Date().toISOString()}).eq("task_id",task.id).eq("status","sending");
 failed++;
 }
 }
 }finally{transport.close();}
 return response({sent,failed,skipped});
}
Deno.serve(async req=>{
 if(req.method!=="POST")return response({error:"Method not allowed"},405);
 let body:{action?:string};
 try{body=await req.json()}catch{return response({error:"JSON required"},400)}
 if(body.action!=="dispatch")return response({error:"Unknown action"},400);
 const presented=req.headers.get("x-nx-cron-secret")||"";
 if(!presented||!env("NX_SMS_CRON_SECRET")||presented!==env("NX_SMS_CRON_SECRET"))return response({error:"Forbidden"},403);
 try{return await dispatch()}catch{return response({error:"Email dispatch unavailable"},500)}
});
