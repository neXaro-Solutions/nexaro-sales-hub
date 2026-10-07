import {useState} from 'react';
import {invitationMail,demoLink} from '../../supabase/functions/nx-software-sales/invitation-template';

export type PreparedInvitation={code:string;lead:{company:string;contact:string;email:string;updated_at:string};invitation:{id:string;expires_at:string}};
export function SoftwareInvitation({issued,onSend,onClose}:{issued:PreparedInvitation;onSend:()=>Promise<void>;onClose:()=>void}){
 const [busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
 const language=(localStorage.getItem('nexaro-language')==='en'?'en':'de') as 'de'|'en';
 const mail=invitationMail({...issued.lead,code:issued.code,expires_at:issued.invitation.expires_at,language});
 const [copied,setCopied]=useState('');
 async function copy(value:string,label:string){setCopied('');try{if(!navigator.clipboard?.writeText)throw Error('clipboard');await navigator.clipboard.writeText(value);setCopied(label+' kopiert.')}catch{setCopied('Kopieren nicht möglich. Bitte das Feld markieren und manuell kopieren.')}}
 async function send(){
  if(busy||sent||!window.confirm(`Diese Einladung jetzt an ${issued.lead.email} senden?`))return;
  setBusy(true);setError('');try{await onSend();setSent(true)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <aside className="sw-mail" aria-label="E-Mail-Vorschau">
  <div className="sw-mail-heading"><span className="sw-badge">CRM SOFTWARE · PERSÖNLICHE EINLADUNG</span><h2>{sent?'Einladung versendet':'Prüfen. Senden. Persönlich überzeugen.'}</h2><p>{sent?'Der Mailserver hat die E-Mail angenommen. Das bestätigt noch nicht die Zustellung im Posteingang.':'Die Einladung ist vorbereitet. Erst mit „Einladung jetzt senden“ und deiner Bestätigung wird sie verschickt.'}</p></div>
  <dl className="sw-mail-meta"><div><dt>An</dt><dd>{issued.lead.contact} · {issued.lead.company}<br/><strong>{issued.lead.email}</strong></dd></div><div><dt>Von</dt><dd>neXaro Solutions · kontakt@nexaro-solutions.de</dd></div><div><dt>Betreff</dt><dd>{mail.subject}</dd></div></dl>
  <div className="sw-share"><h3>Link & Zugang</h3><p>Gültig bis {new Date(issued.invitation.expires_at).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium',timeStyle:'short'})} Uhr (Berlin)</p><label>Einladungslink<div className="sw-copy-row"><input readOnly value={demoLink} onFocus={e=>e.currentTarget.select()}/><button type="button" onClick={()=>void copy(demoLink,'Einladungslink')}>Link kopieren</button></div></label><label>Einladungscode<div className="sw-copy-row"><input readOnly value={issued.code} onFocus={e=>e.currentTarget.select()}/><button type="button" onClick={()=>void copy(issued.code,'Einladungscode')}>Code kopieren</button></div></label><p>Zum Start braucht dein Kontakt den Link und den Code.</p><button type="button" onClick={()=>void copy(mail.text,'Einladung')}>Gesamte Einladung kopieren</button><p className="sw-copy-status" role="status" aria-live="polite">{copied}</p></div>
  <details className="sw-preview-section"><summary>E-Mail-Vorschau öffnen</summary><iframe title="Vorschau der Kunden-E-Mail" className="sw-mail-preview" sandbox="" srcDoc={mail.html}/></details>
  <details className="sw-mail-fallback"><summary>Textversion anzeigen</summary><textarea aria-label="Einladung als Text" readOnly rows={8} value={mail.text} onFocus={e=>e.currentTarget.select()}/><p>Der Code wird nur hier angezeigt. Vor dem Schließen bei Bedarf kopieren.</p></details>
  {error&&<p className="error" role="alert">{error}</p>}
  {sent&&<p className="sw-hint" role="status">Versand im Vorgang und in der zentralen Kundenakte dokumentiert.</p>}
  <div className="sw-actions"><button className="primary" disabled={busy||sent} onClick={()=>void send()}>{busy?'Wird versendet …':sent?'✓ Vom Mailserver angenommen':'Einladung jetzt senden'}</button><button disabled={busy} onClick={()=>{if(sent||window.confirm('Vorschau schließen? Der Code kann danach nicht erneut angezeigt werden. Du kannst später eine neue Einladung erstellen.'))onClose()}}>Vorschau schließen</button></div>
 </aside>;
}
