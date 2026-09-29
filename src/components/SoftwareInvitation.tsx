import {useState} from 'react';
import {invitationMail} from '../../supabase/functions/nx-software-sales/invitation-template';

export type PreparedInvitation={code:string;lead:{company:string;contact:string;email:string;updated_at:string};invitation:{id:string;expires_at:string}};
export function SoftwareInvitation({issued,onSend,onClose}:{issued:PreparedInvitation;onSend:()=>Promise<void>;onClose:()=>void}){
 const [busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
 const mail=invitationMail({...issued.lead,code:issued.code,expires_at:issued.invitation.expires_at});
 async function send(){
  if(busy||sent||!window.confirm(`Diese Einladung jetzt an ${issued.lead.email} senden?`))return;
  setBusy(true);setError('');try{await onSend();setSent(true)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <aside className="sw-mail" aria-label="E-Mail-Vorschau">
  <div className="sw-mail-heading"><span className="sw-badge">CRM SOFTWARE · PERSÖNLICHE EINLADUNG</span><h2>{sent?'Einladung versendet':'Prüfen. Senden. Persönlich überzeugen.'}</h2><p>{sent?'Der Mailserver hat die E-Mail angenommen. Das bestätigt noch nicht die Zustellung im Posteingang.':'Die Einladung ist vorbereitet. Erst mit „Einladung jetzt senden“ und deiner Bestätigung wird sie verschickt.'}</p></div>
  <dl className="sw-mail-meta"><div><dt>An</dt><dd>{issued.lead.contact} · {issued.lead.company}<br/><strong>{issued.lead.email}</strong></dd></div><div><dt>Von</dt><dd>neXaro Solutions · kontakt@nexaro-solutions.de</dd></div><div><dt>Betreff</dt><dd>{mail.subject}</dd></div></dl>
  <iframe title="Vorschau der Kunden-E-Mail" className="sw-mail-preview" sandbox="" srcDoc={mail.html}/>
  <details className="sw-mail-fallback"><summary>Code & Textversion anzeigen</summary><label>Einladungscode<input readOnly value={issued.code} onFocus={e=>e.currentTarget.select()}/></label><textarea aria-label="Einladung als Text" readOnly rows={10} value={mail.text} onFocus={e=>e.currentTarget.select()}/><p>Der Code wird nur hier im Klartext angezeigt. Bei Bedarf vor dem Schließen sichern. Der E-Mail-Versand speichert keinen Klartextcode im CRM.</p></details>
  {error&&<p className="error" role="alert">{error}</p>}
  {sent&&<p className="sw-hint" role="status">Versand im Vorgang und in der zentralen Kundenakte dokumentiert.</p>}
  <div className="sw-actions"><button className="primary" disabled={busy||sent} onClick={()=>void send()}>{busy?'Wird versendet …':sent?'✓ Vom Mailserver angenommen':'Einladung jetzt senden'}</button><button disabled={busy} onClick={()=>{if(sent||window.confirm('Vorschau schließen? Der Code kann danach nicht erneut angezeigt werden. Du kannst später eine neue Einladung erstellen.'))onClose()}}>Vorschau schließen</button></div>
 </aside>;
}
