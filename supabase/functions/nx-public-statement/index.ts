const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const base=Deno.env.get("SUPABASE_URL")!;
const allowed=new Set(["https://nexaro-solutions.github.io","https://www.nexaro-solutions.de","https://nexaro-solutions.de"]);
const encoder=new TextEncoder();
const signingKey=await crypto.subtle.importKey("raw",encoder.encode(serviceKey),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
const reply=(status:number,data:unknown,origin:string)=>new Response(JSON.stringify(data),{status,headers:{
 "Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",
 "Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"content-type,apikey",
 "Access-Control-Allow-Methods":"POST,OPTIONS",Vary:"Origin"
}});
const uid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const auth={apikey:serviceKey,Authorization:"Bearer "+serviceKey};
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(!allowed.has(origin))return reply(403,{error:"origin_not_allowed"},"https://nexaro-solutions.github.io");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{
  "Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"content-type,apikey",
  "Access-Control-Allow-Methods":"POST,OPTIONS",Vary:"Origin"}});
 if(req.method!=="POST")return reply(405,{error:"method_not_allowed"},origin);
 if(!req.headers.get("content-type")?.startsWith("multipart/form-data"))return reply(415,{error:"multipart_required"},origin);
 if(Number(req.headers.get("content-length")||0)>8500000)return reply(413,{error:"file_too_large"},origin);
 try{
  const reader=req.body?.getReader();if(!reader)return reply(400,{error:"empty_body"},origin);
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
   if(size>8500000){await reader.cancel();return reply(413,{error:"file_too_large"},origin)}
   chunks.push(value);
  }
  const content=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){content.set(chunk,offset);offset+=chunk.length}
  const formReq=new Request("https://upload.invalid/",{method:"POST",headers:{"content-type":req.headers.get("content-type")||""},body:content});
  const form=await formReq.formData();
  const file=form.get("statement");
  const raw=String(form.get("challenge")||"");
  let challenge:{id:string;issued:number;signature:string};
  try{challenge=JSON.parse(raw)}catch{return reply(400,{error:"invalid_challenge"},origin)}
  if(!challenge||!uid.test(challenge.id)||!Number.isSafeInteger(challenge.issued)||
   !/^[0-9a-f]{64}$/.test(challenge.signature))return reply(400,{error:"invalid_challenge"},origin);
  if(Date.now()-challenge.issued<2000||Date.now()-challenge.issued>3600000)
   return reply(400,{error:"expired_challenge"},origin);
  const sig=Uint8Array.from(challenge.signature.match(/.{2}/g)!,h=>parseInt(h,16));
  const signed=encoder.encode("intake:"+challenge.id+":"+challenge.issued+":"+origin);
  if(!await crypto.subtle.verify("HMAC",signingKey,sig,signed))
   return reply(403,{error:"invalid_challenge"},origin);
  if(!(file instanceof File)||file.size<1||file.size>8388608)return reply(413,{error:"invalid_file_size"},origin);
  const ext=file.name.split(".").pop()?.toLowerCase()||"";
  const mimes:Record<string,string>={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"};
  if(!mimes[ext]||file.type!==mimes[ext])return reply(400,{error:"invalid_file_type"},origin);
  const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const magic=ext==="pdf"?new TextDecoder().decode(bytes).startsWith("%PDF-"):
   ext==="png"?[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n):
   ext==="jpg"||ext==="jpeg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
   new TextDecoder().decode(bytes).startsWith("RIFF")&&new TextDecoder().decode(bytes).slice(8,12)==="WEBP";
  if(!magic)return reply(400,{error:"file_signature_mismatch"},origin);
  const receipts=await fetch(base+"/rest/v1/nx_intake_receipts?id=eq."+encodeURIComponent(challenge.id)+"&select=customer_id,created_at",{
   headers:auth,signal:AbortSignal.timeout(10000)});
  if(!receipts.ok)return reply(503,{error:"temporarily_unavailable"},origin);
  const rows=await receipts.json() as {customer_id:string;created_at:string}[];
  if(rows.length!==1||Date.now()-new Date(rows[0].created_at).getTime()>3600000)
   return reply(403,{error:"receipt_not_found"},origin);
  const existing=await fetch(base+"/rest/v1/nx_inbound_statements?receipt_id=eq."+encodeURIComponent(challenge.id)+"&select=receipt_id",{
   headers:auth,signal:AbortSignal.timeout(10000)});
  if(!existing.ok)return reply(503,{error:"temporarily_unavailable"},origin);
  if((await existing.json() as unknown[]).length)return reply(409,{error:"statement_already_uploaded"},origin);
  const name=file.name.normalize("NFKC").replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,140)||("Abrechnung."+ext);
  const path=rows[0].customer_id+"/"+crypto.randomUUID()+"_Abrechnung."+ext;
  const upload=await fetch(base+"/storage/v1/object/nx-client-documents/"+path,{
   method:"POST",headers:{...auth,"Content-Type":file.type,"cache-control":"no-store","x-upsert":"false"},
   body:file,signal:AbortSignal.timeout(30000)});
  if(!upload.ok)return reply(503,{error:"storage_unavailable"},origin);
  const save=await fetch(base+"/rest/v1/nx_inbound_statements",{
   method:"POST",headers:{...auth,"Content-Type":"application/json",Prefer:"return=minimal"},
   body:JSON.stringify({receipt_id:challenge.id,customer_id:rows[0].customer_id,
    storage_path:path,original_name:name,mime:file.type,size_bytes:file.size}),
   signal:AbortSignal.timeout(12000)});
  if(!save.ok){
   await fetch(base+"/storage/v1/object/nx-client-documents/"+path,{method:"DELETE",headers:auth}).catch(()=>undefined);
   return reply(save.status===409?409:503,{error:save.status===409?"statement_already_uploaded":"temporarily_unavailable"},origin);
  }
  return reply(200,{ok:true},origin);
 }catch{return reply(503,{error:"temporarily_unavailable"},origin)}
});
