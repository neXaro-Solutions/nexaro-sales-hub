import {validateLead,stages} from './validation.ts';
import nodemailer from 'npm:nodemailer@7.0.6';
import {invitationMail,invitationSubjectFor} from './invitation-template.ts';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins=new Set(['https://www.nexaro-solutions.de','https://nexaro-solutions.de','https://nexaro-solutions.github.io']);
const encoder=new TextEncoder();const hmacKey=crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const hex=(v:ArrayBuffer)=>Array.from(new Uint8Array(v)).map(b=>b.toString(16).padStart(2,'0')).join('');
const sign=async(s:string)=>hex(await crypto.subtle.sign('HMAC',await hmacKey,encoder.encode(s)));
const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
async function db(path:string,method='GET',body?:unknown){const r=await fetch(url+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});if(!r.ok){const t=await r.text();throw Error(t.includes('rate_limited')?'rate_limited':'database_error')}return r.status===204?null:r.json()}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
 if(origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,{error:'Zugriff nicht erlaubt.'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  if(req.method==='GET'){const id=crypto.randomUUID(),issued=Date.now();return reply(200,{id,issued,signature:await sign(`software:${id}:${issued}:${origin}`)})}
  if(req.method!=='POST')return reply(405,{error:'Methode nicht erlaubt.'});
  if(!req.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON erforderlich.'});
  const reader=req.body?.getReader();if(!reader)return reply(400,{error:'Angaben fehlen.'});let raw='',size=0;const dec=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>20000){await reader.cancel();return reply(413,{error:'Anfrage zu groß.'})}raw+=dec.decode(value,{stream:true})}raw+=dec.decode();let b;try{b=JSON.parse(raw)}catch{return reply(400,{error:'Ungültige Anfrage.'})}if(!b||typeof b!=='object')return reply(400,{error:'Ungültige Anfrage.'});
  if(b.action==='submit'){
   if(!origins.has(origin)||b.website||b.consent!==true)return reply(400,{error:'Bitte Angaben und Datenschutzhinweis prüfen.'});
   const c=b.challenge;if(!c||!uuid(c.id)||!Number.isSafeInteger(c.issued)||typeof c.signature!=='string'||!/^[a-f0-9]{64}$/.test(c.signature)||Date.now()-c.issued<1500||Date.now()-c.issued>3600000)return reply(400,{error:'Bitte lade das Formular neu und versuche es erneut.'});
   const signature=new Uint8Array(c.signature.match(/.{2}/g).map((s:string)=>parseInt(s,16)));
   if(!await crypto.subtle.verify('HMAC',await hmacKey,signature,encoder.encode(`software:${c.id}:${c.issued}:${origin}`)))return reply(403,{error:'Ungültige Anfrage.'});
   let payload;try{payload=validateLead(b.payload)}catch(e){return reply(400,{error:(e as Error).message})}
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
   await db('rpc/nx_software_submit','POST',{p_id:c.id,p_key:await sign('ip:'+ip),p_payload:payload});return reply(200,{ok:true});
  }
  const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return reply(401,{error:'Bitte erneut im CRM anmelden.'});
  const userResponse=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:auth},signal:AbortSignal.timeout(10000)});
  if(!userResponse.ok)return reply(401,{error:'Bitte erneut im CRM anmelden.'});const user=await userResponse.json();
  if(!uuid(user.id))return reply(401,{error:'Ungültige Anmeldung.'});
  if(!(await db('nx_owner?select=user_id&user_id=eq.'+user.id)).length)return reply(403,{error:'Dieser Bereich ist nur für den CRM-Inhaber freigeschaltet.'});
  if(b.action==='list'){
   const rows=await db('nx_software_requests?select=*&order=created_at.desc&limit=1000');
   const invitations=await db('nx_demo_invitations?select=id,label,request_id,created_at,expires_at,revoked_at&order=created_at.desc&limit=1000');
   const deliveries=await db('nx_software_mail_delivery?select=invitation_id,request_id,recipient,status,created_at,accepted_at&order=created_at.desc&limit=1000');
   return reply(200,{rows,invitations,deliveries,truncated:rows.length===1000||invitations.length===1000});
  }
  if(b.action==='save'){
   let payload;try{payload=validateLead(b.payload)}catch(e){return reply(400,{error:(e as Error).message})}
   if(!stages.includes(b.payload.status)||typeof b.payload.notes!=='string'||b.payload.notes.length>6000)return reply(400,{error:'Status oder Notizen ungültig.'});
   const date=b.payload.next_contact||null;if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date).toISOString().slice(0,10)!==date))return reply(400,{error:'Wiedervorlagedatum ungültig.'});
   const values={...payload,status:b.payload.status,notes:b.payload.notes,next_contact:date,updated_at:new Date().toISOString()};
   if(b.id){if(!uuid(b.id)||typeof b.updated_at!=='string'||!Number.isFinite(Date.parse(b.updated_at)))return reply(400,{error:'Ungültige Anfrage.'});const rows=await db('nx_software_requests?id=eq.'+b.id+'&updated_at=eq.'+encodeURIComponent(b.updated_at),'PATCH',values);if(!rows.length)return reply(409,{error:'Diese Anfrage wurde inzwischen geändert. Bitte aktualisieren und Änderungen erneut prüfen.'});return reply(200,{row:rows[0]})}
   const rows=await db('nx_software_requests','POST',{...values,source:'manual'});const fresh=await db('nx_software_requests?id=eq.'+rows[0].id);return reply(200,{row:fresh[0]});
  }
  if(b.action==='link_customer'){
   if(!uuid(b.request_id)||(b.customer_id!=null&&!uuid(b.customer_id))||typeof b.create!=='boolean')return reply(400,{error:'Ungültige Kundenzuordnung.'});
   const customerId=await db('rpc/nx_link_software_customer','POST',{p_id:b.request_id,p_customer_id:b.customer_id||null,p_create:b.create});
   const rows=await db('nx_software_requests?id=eq.'+b.request_id);
   return reply(200,{row:rows[0],customer_id:customerId});
  }
  if(b.action==='invite'){
   if(!uuid(b.request_id)||!Number.isInteger(b.days)||b.days<1||b.days>30)return reply(400,{error:'Bitte eine Gültigkeit zwischen 1 und 30 Tagen wählen.'});
   const leads=await db('nx_software_requests?id=eq.'+b.request_id);if(!leads.length)return reply(404,{error:'Anfrage nicht gefunden.'});
   if(!leads[0].customer_id)return reply(409,{error:'Bitte zuerst die zentrale Kundenakte zuordnen.'});
   const bytes=crypto.getRandomValues(new Uint8Array(16));const code='NX'+hex(bytes.buffer).toUpperCase();const hash=hex(await crypto.subtle.digest('SHA-256',encoder.encode(code)));
   const rows=await db('nx_demo_invitations','POST',{label:leads[0].company+' · '+leads[0].contact,request_id:b.request_id,created_by:user.id,code_hash:hash,expires_at:new Date(Date.now()+b.days*86400000).toISOString()});
   return reply(200,{code,lead:leads[0],invitation:{id:rows[0].id,label:rows[0].label,request_id:b.request_id,created_at:rows[0].created_at,expires_at:rows[0].expires_at,revoked_at:null}});
  }
  if(b.action==='send_invitation'){
   if(!uuid(b.id)||typeof b.code!=='string'||!/^NX[A-F0-9]{32}$/.test(b.code)||typeof b.recipient!=='string'||b.recipient.length>254||typeof b.updated_at!=='string'||!Number.isFinite(Date.parse(b.updated_at)))return reply(400,{error:'Ungültige Einladung. Bitte die Vorschau erneut erstellen.'});
   const prior=await db('nx_software_mail_delivery?invitation_id=eq.'+b.id+'&select=status');
   if(prior.length)return prior[0].status==='accepted'?reply(200,{ok:true,status:'accepted',already_sent:true}):reply(409,{error:'Der Versand wurde bereits gestartet. Der Status ist noch nicht bestätigt. Bitte nicht erneut senden; zunächst Versandverlauf bzw. Postausgang prüfen.'});
   const sender='kontakt@nexaro-solutions.de',host=Deno.env.get('SMTP_HOST')||'',port=Number(Deno.env.get('SMTP_PORT')||'465'),smtpUser=Deno.env.get('SMTP_USER')||'',password=Deno.env.get('SMTP_PASSWORD')||'',from=(Deno.env.get('SMTP_FROM')||sender).toLowerCase();
   if(!host||!password||!Number.isInteger(port)||port<1||port>65535||smtpUser.toLowerCase()!==sender||![sender,'nexaro solutions <'+sender+'>'].includes(from))return reply(503,{error:'Der E-Mail-Versand ist noch nicht vollständig eingerichtet. Es wurde keine E-Mail versendet.'});
   const transport=nodemailer.createTransport({host,port,secure:port===465,requireTLS:port!==465,tls:{minVersion:'TLSv1.2',servername:host},auth:{user:smtpUser,pass:password},connectionTimeout:12000,greetingTimeout:12000,socketTimeout:20000});
   try{await transport.verify()}catch{return reply(503,{error:'Der Mailserver ist momentan nicht erreichbar. Es wurde noch keine E-Mail versendet. Bitte später erneut versuchen.'})}
   const hash=hex(await crypto.subtle.digest('SHA-256',encoder.encode(b.code)));
   let claim;try{claim=await db('rpc/nx_claim_software_mail','POST',{p_id:b.id,p_hash:hash,p_recipient:b.recipient,p_subject:invitationSubjectFor(b.language==='en'?'en':'de'),p_owner:user.id,p_updated_at:b.updated_at})}catch{return reply(409,{error:'Code, Empfänger oder Anfrage haben sich geändert oder die Einladung ist abgelaufen. Bitte aktualisieren und eine neue Vorschau erstellen.'})}
   if(!claim.claimed)return claim.status==='accepted'?reply(200,{ok:true,status:'accepted',already_sent:true}):reply(409,{error:'Dieser Versand wurde bereits gestartet. Bitte den Versandverlauf prüfen und nicht erneut senden.'});
   const mail=invitationMail({company:claim.lead.company,contact:claim.lead.contact,code:b.code,expires_at:claim.invitation.expires_at,language:b.language==='en'?'en':'de'});
   try{
    const result=await transport.sendMail({from:{name:'neXaro Solutions',address:sender},replyTo:sender,to:claim.lead.email,subject:mail.subject,text:mail.text,html:mail.html,disableFileAccess:true,disableUrlAccess:true});
    if(!result.accepted?.some((v:string)=>String(v).toLowerCase()===claim.lead.email.toLowerCase()))throw Error('not_accepted');
    await db('rpc/nx_complete_software_mail','POST',{p_id:b.id,p_message_id:String(result.messageId||'')});
    return reply(200,{ok:true,status:'accepted'});
   }catch{
    try{await db('nx_software_mail_delivery?invitation_id=eq.'+b.id+'&status=neq.accepted','PATCH',{status:'unknown'})}catch{/* Keep sending as an uncertainty marker; never retry automatically. */}
    return reply(502,{error:'Der Versandstatus konnte nicht sicher bestätigt werden. Bitte Postausgang bzw. Empfänger prüfen. Um doppelte E-Mails zu vermeiden, wird dieser Code nicht erneut automatisch versendet.'});
   }finally{transport.close()}
  }
  if(b.action==='revoke'){
   if(!uuid(b.id))return reply(400,{error:'Ungültige Einladung.'});const rows=await db('nx_demo_invitations?id=eq.'+b.id,'PATCH',{revoked_at:new Date().toISOString()});if(!rows.length)return reply(404,{error:'Einladung nicht gefunden.'});return reply(200,{ok:true});
  }
  return reply(400,{error:'Unbekannte Aktion.'});
 }catch(e){return reply((e as Error).message==='rate_limited'?429:503,{error:(e as Error).message==='rate_limited'?'Zu viele Anfragen. Bitte versuche es später erneut.':'Die Anfrage konnte nicht abgeschlossen werden. Bitte erneut versuchen.'})}
});
