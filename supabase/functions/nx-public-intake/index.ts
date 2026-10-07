import nodemailer from "npm:nodemailer@7.0.6";
import { validatePayload } from "./validation.ts";

const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const url=Deno.env.get("SUPABASE_URL")!;
const origins=new Set(["https://nexaro-solutions.github.io","https://www.nexaro-solutions.de","https://nexaro-solutions.de"]);
const encoder=new TextEncoder();
const keyPromise=crypto.subtle.importKey("raw",encoder.encode(serviceKey),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),(x)=>x.toString(16).padStart(2,"0")).join("");
async function sign(s:string){return hex(await crypto.subtle.sign("HMAC",await keyPromise,encoder.encode(s)))}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const env=(k:string)=>Deno.env.get(k)||"";
const validMail=(mail:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)&&mail.length<=254;
function head(){return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light only!important}body,.nx{background:#fffdf9!important;color:#252724!important}.card{background:#fff!important}.panel{background:#f4ffdf!important}.warm{background:#fff0e5!important}@media(prefers-color-scheme:dark){body,.nx{background:#fffdf9!important;color:#252724!important}.card{background:#fff!important}.panel{background:#f4ffdf!important}.warm{background:#fff0e5!important}}</style>`}
function header(){return `<tr><td bgcolor="#fffdf9" style="padding:24px 30px;background:#fffdf9!important;border-top:4px solid #ff6b00;border-bottom:1px solid #e7e0d9"><div style="font-size:30px;font-weight:900;letter-spacing:-1.4px;color:#252724">ne<span style="color:#ff6b00">X</span>aro</div><div style="font-size:10px;font-weight:800;color:#59634e;letter-spacing:4px">SOLUTIONS</div><div style="height:5px;background:#baff00;margin-top:18px;border-radius:5px"></div></td></tr>`}
function footer(language="de"){const en=language==="en";return `<tr><td bgcolor="#f1f5e9" style="padding:22px 30px;background:#f1f5e9!important;border-top:4px solid #baff00;font-size:11px;line-height:1.65;color:#59634e"><strong>neXaro Solutions</strong> · Kirchstraße 1A · 15757 Halbe<br><a href="https://www.nexaro-solutions.de/">Website</a> · <a href="https://www.nexaro-solutions.de/impressum.html">${en?"Legal notice":"Impressum"}</a> · <a href="https://www.nexaro-solutions.de/datenschutz.html">${en?"Privacy":"Datenschutz"}</a></td></tr>`}

async function confirm(id:string,p:any){
  if(!(env("NX_EMAIL_ENABLED")==="true"&&["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASSWORD","SMTP_FROM"].every(k=>env(k))))return;
  if(!validMail(p.email||""))return;
  const rh={apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"};
  const claim=await fetch(url+"/rest/v1/nx_intake_email_receipts?on_conflict=intake_id",{method:"POST",headers:{...rh,Prefer:"return=representation,resolution=ignore-duplicates"},body:JSON.stringify({intake_id:id,status:"sending"}),signal:AbortSignal.timeout(8000)});
  if(!claim.ok)return;
  const rows=await claim.json();if(!Array.isArray(rows)||rows.length!==1)return;
  let status="failed",reason="";
  const port=Number(env("SMTP_PORT"));if(!Number.isInteger(port)||port<1||port>65535)return;
  const tr=nodemailer.createTransport({host:env("SMTP_HOST"),port,secure:port===465,requireTLS:port!==465,tls:{minVersion:"TLSv1.2",serverName:env("SMTP_HOST")},auth:{user:env("SMTP_USER"),pass:env("SMTP_PASSWORD")},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000});
  try{
    const name=String(p.contact||"").trim();
    const newPayment=p.interest==="sumup"&&String(p.current_provider||"").trim().toLowerCase()==="noch keine kartenzahlung";
    const fee=p.interest==="sumup"&&p.request_type==="sumup_fee_check"&&!newPayment;
    const sal=name?"Guten Tag "+name+",":"Guten Tag,";
    let subject,title,kicker,intro,panel,warm,text;
    if(newPayment){
      subject="Ihr Einstieg in die Kartenzahlung ist angekommen | neXaro Solutions";
      title="Ihre Einstiegskalkulation ist bei uns angekommen.";
      kicker="KARTENZAHLUNG · EINSTIEG";
      intro="Vielen Dank für Ihre Angaben. Wir prüfen Ihren erwarteten Kartenumsatz, den gewünschten Tarif und Ihren Einsatz im Alltag und bereiten daraus eine passende SumUp-Empfehlung vor.";
      panel='<strong style="font-size:16px">Was Sie jetzt erwarten können</strong><p>Wir ordnen Gebührenmodell, Kartentypen und Hardware passend zu Ihrem geplanten Einsatz ein. Dabei arbeiten wir bewusst ohne erfundene Alt-Kosten oder künstliche Ersparnis.</p><p><strong>Ihre Angaben sind bereits im neXaro Vertriebsprozess hinterlegt.</strong> Falls für eine belastbare Empfehlung noch etwas fehlt, melden wir uns gezielt bei Ihnen.</p>';
      warm='<strong>Keine Vergleichswerte nötig.</strong><br>Wir planen ausschließlich mit Ihrem erwarteten Einsatz und den aktuell relevanten SumUp-Konditionen.';
      text=`${sal}\n\n${intro}\n\nWir ordnen Tarif, Kartentypen und Hardware ein. Es werden keine erfundenen bisherigen Gebühren oder künstlichen Einsparungen angesetzt. Falls Angaben fehlen, melden wir uns gezielt.\n\nFreundliche Grüße\nSebastian Pötschke\nneXaro Solutions`;
    }else if(fee){
      subject="Ihre Abrechnung ist eingegangen – wir erstellen Ihren Payment-Vergleich | neXaro Solutions";
      title="Ihre Abrechnung ist angekommen.";
      kicker="ABRECHNUNG · EINGEGANGEN";
      intro="Vielen Dank für die Übermittlung Ihrer Abrechnung. Wir analysieren Ihre aktuellen Konditionen und erstellen daraus eine nachvollziehbare Grundlage für Ihr individuelles Payment-Angebot.";
      panel='<strong style="font-size:16px">Was Sie jetzt erwarten können</strong><p>Wir prüfen Gebühren, Kartenmix, Hardware und relevante laufende Kosten. Anschließend erhalten Sie ein auf Ihr Unternehmen abgestimmtes Angebot mit einer verständlichen Gegenüberstellung. Wenn etwas fehlt oder nicht eindeutig ist, melden wir uns gezielt bei Ihnen.</p><p><strong>Sie müssen aktuell nichts weiter tun.</strong></p>';
      warm='<strong>Persönlich. Klar. Nachvollziehbar.</strong><br>Ihre Daten werden ausschließlich zur Bearbeitung Ihrer Anfrage und zur Erstellung Ihres individuellen Angebots verwendet.';
      text=`${sal}\n\n${intro}\n\nWir prüfen Gebühren, Kartenmix, Hardware und laufende Kosten und erstellen anschließend Ihr individuelles Angebot. Wenn Angaben fehlen, melden wir uns gezielt.\n\nFreundliche Grüße\nSebastian Pötschke\nneXaro Solutions`;
    }else{
      const area=p.interest==="sumup"?"Ihre Anfrage zur SumUp- und Payment-Beratung":p.interest==="vape"?"Ihre Anfrage zu Vape- und Trendartikeln":"Ihre Anfrage";
      subject="Ihre Anfrage ist angekommen – wir kümmern uns persönlich darum | neXaro Solutions";
      title="Ihre Anfrage ist angekommen.";
      kicker="ANFRAGE · EINGEGANGEN";
      intro=`${area} ist bei uns eingegangen. Wir prüfen Ihre Angaben und melden uns persönlich, damit Sie schnell eine klare und passende Lösung für Ihr Unternehmen erhalten.`;
      panel='<strong style="font-size:16px">Wie es weitergeht</strong><p>Wir ordnen Ihre Anfrage fachlich ein und melden uns persönlich mit den nächsten sinnvollen Schritten. Unser Ziel: keine Standardantwort, sondern eine Lösung, die zu Ihrem tatsächlichen Bedarf passt.</p><p>Wenn Sie vorab etwas ergänzen möchten, antworten Sie einfach direkt auf diese E-Mail.</p>';
      warm='<strong>Persönlich. Klar. Nachvollziehbar.</strong><br>Ihre Anfrage wird zweckgebunden bearbeitet. Eine Einwilligung in Werbe-E-Mails ist damit nicht verbunden.';
      text=`${sal}\n\n${intro}\n\nWir prüfen Ihre Angaben und melden uns persönlich mit den nächsten sinnvollen Schritten.\n\nFreundliche Grüße\nSebastian Pötschke\nneXaro Solutions`;
    }
    const language=p.language==="en"?"en":"de",english=language==="en";
    if(english){
      if(newPayment){
        subject="Your start with card payments – request received | neXaro Solutions";
        title="We received your card payment setup request.";
        kicker="CARD PAYMENTS · GETTING STARTED";
        intro="Thank you for your details. We review your expected card turnover, preferred tariff and day-to-day use to prepare a suitable SumUp recommendation.";
        panel='<strong style="font-size:16px">What happens next</strong><p>We assess the fee model, card types and hardware for your intended use. We deliberately do not invent previous costs or artificial savings.</p><p><strong>Your details are already recorded in the neXaro sales process.</strong> If anything is missing for a reliable recommendation, we will contact you specifically.</p>';
        warm='<strong>No comparison data required.</strong><br>We work only with your expected use and the currently relevant SumUp conditions.';
        text=`${name?"Hello "+name+",":"Hello,"}\n\n${intro}\n\nWe assess the tariff, card types and hardware. No invented previous fees or artificial savings are used. If details are missing, we will contact you specifically.\n\nBest regards\nSebastian Pötschke\nneXaro Solutions`;
      }else if(fee){
        subject="Your statement has arrived – we are preparing your payment comparison | neXaro Solutions";
        title="We received your statement.";
        kicker="STATEMENT · RECEIVED";
        intro="Thank you for sending your statement. We analyse your current conditions and use them to create a transparent basis for your individual payment offer.";
        panel='<strong style="font-size:16px">What happens next</strong><p>We review fees, card mix, hardware and relevant recurring costs. You will then receive a tailored offer with an understandable comparison. If anything is missing or unclear, we will contact you directly.</p><p><strong>You do not need to do anything else right now.</strong></p>';
        warm='<strong>Personal. Clear. Transparent.</strong><br>Your data is used exclusively to process your request and prepare your individual offer.';
        text=`${name?"Hello "+name+",":"Hello,"}\n\n${intro}\n\nWe review fees, card mix, hardware and recurring costs and then prepare your individual offer. If anything is missing, we will contact you directly.\n\nBest regards\nSebastian Pötschke\nneXaro Solutions`;
      }else{
        const area=p.interest==="sumup"?"your SumUp and payment consulting request":p.interest==="vape"?"your vape and trend product request":"your request";
        subject="We received your request – we will take care of it personally | neXaro Solutions";
        title="We received your request.";
        kicker="REQUEST · RECEIVED";
        intro=`We received ${area}. We will review your details and contact you personally so you can quickly get a clear solution that fits your business.`;
        panel='<strong style="font-size:16px">What happens next</strong><p>We review your request and contact you personally with the next sensible steps. Our goal is not a standard reply, but a solution that fits your actual needs.</p><p>If you would like to add anything beforehand, simply reply directly to this email.</p>';
        warm='<strong>Personal. Clear. Transparent.</strong><br>Your request is processed for this purpose only. This does not constitute consent to marketing emails.';
        text=`${name?"Hello "+name+",":"Hello,"}\n\n${intro}\n\nWe review your details and contact you personally with the next sensible steps.\n\nBest regards\nSebastian Pötschke\nneXaro Solutions`;
      }
    }
    const html=`<!doctype html><html lang="${language}"><head>${head()}</head><body class="nx" bgcolor="#fffdf9" style="margin:0;background:#fffdf9!important;font-family:Arial,Helvetica,sans-serif;line-height:1.62"><table width="100%" bgcolor="#fffdf9"><tr><td style="padding:26px 12px"><table class="card" width="100%" bgcolor="#fff" style="max-width:640px;margin:auto;border:1px solid #e7e0d9;border-radius:20px;overflow:hidden">${header()}<tr><td style="padding:34px 30px"><p style="margin:0;color:#a44000;font-size:11px;font-weight:800;letter-spacing:1.6px">${kicker}</p><h1 style="font-size:30px;line-height:1.14;margin:8px 0 20px">${title}</h1><p>${esc(sal)}</p><p>${esc(intro)}</p><table class="panel" width="100%" bgcolor="#f4ffdf" style="margin:24px 0;border:1px solid #cfe68b;border-left:5px solid #baff00;border-radius:14px"><tr><td style="padding:20px">${panel}</td></tr></table><div class="warm" style="margin:22px 0;padding:16px 18px;border-left:5px solid #ff6b00;background:#fff0e5;border-radius:0 12px 12px 0;font-size:13px">${warm}</div><p>${english?"Best regards":"Freundliche Grüße"}<br><strong>Sebastian Pötschke</strong><br>neXaro Solutions</p></td></tr>${footer(language)}</table></td></tr></table></body></html>`;
    const sent=await tr.sendMail({from:env("SMTP_FROM"),to:p.email,replyTo:"kontakt@nexaro-solutions.de",subject,text,html});
    status=sent.accepted?.some((a:string)=>a.toLowerCase()===p.email.toLowerCase())?"sent":"failed";if(status==="failed")reason="Recipient not accepted";
  }catch(x){reason=x instanceof Error?x.name:"Send error"}finally{tr.close()}
  await fetch(url+"/rest/v1/nx_intake_email_receipts?intake_id=eq."+encodeURIComponent(id),{method:"PATCH",headers:rh,body:JSON.stringify({status,failure_reason:reason||null,updated_at:new Date().toISOString()}),signal:AbortSignal.timeout(8000)}).catch(()=>{});
}

async function readJsonBounded(req:Request){
  if(Number(req.headers.get("content-length")||0)>16000)throw new Error("too_large");
  const reader=req.body?.getReader();if(!reader)throw new Error("empty_body");
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw new Error("too_large")}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw new Error("invalid_json")}
}

Deno.serve(async(req)=>{
  const origin=req.headers.get("origin")||"";
  const headers={"Access-Control-Allow-Origin":origins.has(origin)?origin:"https://nexaro-solutions.github.io","Access-Control-Allow-Headers":"content-type,apikey","Access-Control-Allow-Methods":"GET, POST, OPTIONS",Vary:"Origin","Cache-Control":"no-store","Content-Type":"application/json","X-Content-Type-Options":"nosniff"};
  const reply=(s:number,d:any)=>new Response(JSON.stringify(d),{status:s,headers});
  if(!origins.has(origin))return reply(403,{error:"origin_not_allowed"});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  try{
    if(req.method==="GET"){const c={id:crypto.randomUUID(),issued:Date.now()};return reply(200,{...c,signature:await sign(`intake:${c.id}:${c.issued}:${origin}`)})}
    if(req.method!=="POST")return reply(405,{error:"method_not_allowed"});
    if(!req.headers.get("content-type")?.startsWith("application/json"))return reply(415,{error:"json_required"});
    let body;try{body=await readJsonBounded(req)}catch(e){return reply(e instanceof Error&&e.message==="too_large"?413:400,{error:e instanceof Error?e.message:"invalid_json"})}
    const c=body.challenge;
    if(!c||typeof c.id!=="string"||!/^[-0-9a-f]{36}$/.test(c.id)||!Number.isSafeInteger(c.issued)||typeof c.signature!=="string"||!/^[0-9a-f]{64}$/.test(c.signature))return reply(400,{error:"invalid_challenge"});
    const age=Date.now()-c.issued;if(age<2000||age>3600000)return reply(400,{error:"expired_challenge"});
    const sig=new Uint8Array(c.signature.match(/.{2}/g).map((s:string)=>parseInt(s,16)));
    if(!(await crypto.subtle.verify("HMAC",await keyPromise,sig,encoder.encode(`intake:${c.id}:${c.issued}:${origin}`))))return reply(403,{error:"invalid_challenge"});
    if(body.website)return reply(400,{error:"invalid_submission"});
    let p;try{p=validatePayload(body.payload)}catch{return reply(400,{error:"invalid_fields"})}
    const ip=req.headers.get("x-forwarded-for")?.split(",")[0].trim()||"unknown";
    const r=await fetch(`${url}/rest/v1/rpc/nx_submit_intake`,{method:"POST",headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"},body:JSON.stringify({p_id:c.id,p_ip_hash:await sign("ip:"+ip),p_payload:p}),signal:AbortSignal.timeout(12000)});
    if(!r.ok){const f=await r.text();return reply(f.includes("rate_limited")?429:503,{error:f.includes("rate_limited")?"rate_limited":"temporarily_unavailable"})}
    try{await confirm(c.id,p)}catch{}
    return reply(200,{ok:true});
  }catch{return reply(503,{error:"temporarily_unavailable"})}
});