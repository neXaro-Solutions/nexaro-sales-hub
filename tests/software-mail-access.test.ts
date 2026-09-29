import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const smtp=vi.hoisted(()=>({verify:vi.fn(),sendMail:vi.fn(),close:vi.fn()}));
vi.mock('npm:nodemailer@7.0.6',()=>({default:{createTransport:()=>smtp}}));
let handler:(req:Request)=>Promise<Response>;
const id='11111111-1111-4111-8111-111111111111',owner='d61e2d3e-f665-41a9-975e-ea89335ab61a';
const input={action:'send_invitation',id,code:'NX'+'A'.repeat(32),recipient:'demo@example.invalid',updated_at:'2026-09-29T10:00:00Z'};
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
const send=(body:object=input,token='owner')=>handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)}));
let prior:string|null,claimed:boolean,claimStatus:string,claimError:boolean,completed:boolean;
beforeEach(async()=>{
 vi.resetModules();vi.clearAllMocks();prior=null;claimed=true;claimStatus='sending';claimError=false;completed=false;
 smtp.verify.mockResolvedValue(true);smtp.sendMail.mockResolvedValue({accepted:[input.recipient],messageId:'test-message'});
 const env:Record<string,string>={SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-only',SMTP_HOST:'mail.invalid',SMTP_PORT:'465',SMTP_USER:'kontakt@nexaro-solutions.de',SMTP_PASSWORD:'test-only',SMTP_FROM:'neXaro Solutions <kontakt@nexaro-solutions.de>'};
 vi.stubGlobal('Deno',{env:{get:(k:string)=>env[k]},serve:(f:typeof handler)=>handler=f});
 vi.stubGlobal('fetch',vi.fn(async(url,init)=>{
  const u=String(url);
  if(u.endsWith('/auth/v1/user'))return json(init?.headers?.Authorization==='Bearer owner'?{id:owner}:{},init?.headers?.Authorization==='Bearer owner'?200:401);
  if(u.includes('nx_owner?'))return json([{user_id:owner}]);
  if(u.includes('nx_software_mail_delivery?')&&init?.method==='GET')return json(prior?[{status:prior}]:[]);
  if(u.endsWith('rpc/nx_claim_software_mail'))return claimError?json({},400):json({claimed,status:claimStatus,lead:{company:'Demo',contact:'Test',email:input.recipient},invitation:{expires_at:'2026-10-05T10:00:00Z'}});
  if(u.endsWith('rpc/nx_complete_software_mail')){completed=true;return json(null)}
  if(u.includes('nx_software_mail_delivery?')&&init?.method==='PATCH')return json([]);
  throw Error(u);
 }));
 await import('../supabase/functions/nx-software-sales/index');
});
afterEach(()=>vi.unstubAllGlobals());
describe('Owner-only, idempotent invitation delivery',()=>{
 it('sends exactly the branded preview from the configured account and records acceptance',async()=>{
  const r=await send();expect(r.status).toBe(200);expect(completed).toBe(true);expect(smtp.sendMail).toHaveBeenCalledTimes(1);
  const m=smtp.sendMail.mock.calls[0][0];expect(m.to).toBe(input.recipient);expect(m.from.address).toBe('kontakt@nexaro-solutions.de');expect(m.html).toContain(input.code);expect(m.text).toContain(input.code);expect(m.disableUrlAccess).toBe(true);
 });
 it('rejects unauthenticated users before connecting to SMTP',async()=>{expect((await send(input,'bad')).status).toBe(401);expect(smtp.verify).not.toHaveBeenCalled()});
 it('rejects invalid input',async()=>{expect((await send({...input,code:'bad'})).status).toBe(400);expect(smtp.sendMail).not.toHaveBeenCalled()});
 it('does not resend an already accepted invitation',async()=>{prior='accepted';expect((await send()).status).toBe(200);expect(smtp.sendMail).not.toHaveBeenCalled()});
 it.each(['sending','unknown'])('blocks retries for %s state',async(status)=>{prior=status;expect((await send()).status).toBe(409);expect(smtp.sendMail).not.toHaveBeenCalled()});
 it('loses a concurrent claim safely',async()=>{claimed=false;expect((await send()).status).toBe(409);expect(smtp.sendMail).not.toHaveBeenCalled()});
 it('does not send revoked, expired or stale recipient claims',async()=>{claimError=true;expect((await send()).status).toBe(409);expect(smtp.sendMail).not.toHaveBeenCalled()});
 it('reports preflight failure without starting delivery',async()=>{smtp.verify.mockRejectedValueOnce(Error('offline'));expect((await send()).status).toBe(503);expect(smtp.sendMail).not.toHaveBeenCalled();expect(completed).toBe(false)});
 it('does not call SMTP errors successful delivery',async()=>{smtp.sendMail.mockRejectedValueOnce(Error('timeout'));expect((await send()).status).toBe(502);expect(completed).toBe(false)});
 it('does not call a refused recipient successful delivery',async()=>{smtp.sendMail.mockResolvedValueOnce({accepted:[]});expect((await send()).status).toBe(502);expect(completed).toBe(false)});
});
