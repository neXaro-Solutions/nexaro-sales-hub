import {describe,it,expect} from 'vitest';
import {invitationMail,demoLink} from '../supabase/functions/nx-software-sales/invitation-template';
const input={company:'Muster & Partner',contact:'Alex Beispiel',code:'NX'+'A'.repeat(32),expires_at:'2026-10-05T16:45:00Z'};
describe('Software invitation',()=>{
 it('contains access, instructions and important functions in HTML and plain text',()=>{
  const m=invitationMail(input);
  for(const part of [m.html,m.text])for(const word of [input.code,demoLink,'Hunter','Dokumentenscan','Zeiterfassung','Dienstplan','Einsatzplanung','Beispieldaten','Berlin','neXaro','Start-ups','KMU'])expect(part).toContain(word);
  expect(m.text).toContain('18:45');expect(m.text).toContain('kein Kauf');
 });
 it('escapes all contact and company content',()=>{
  const m=invitationMail({...input,contact:'<img src=x onerror=alert(1)>',company:'<script>alert(1)</script>'});
  expect(m.html).not.toContain('<script>');expect(m.html).not.toContain('<img');expect(m.html).toContain('&lt;script&gt;');
 });
 it('does not place the access code in a URL or load trackers',()=>{
  const m=invitationMail(input);expect(m.html).not.toContain('src=');expect(m.html).not.toMatch(/href="[^"]*NX/);expect(m.text).not.toContain('?code=');
 });
});
