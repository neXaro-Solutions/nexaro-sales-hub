import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CalendarClock, CheckCircle2, Globe2, Mail, Maximize2, Minimize2, Phone, RefreshCw, Shuffle, XCircle } from "lucide-react";
import { client } from "../lib/client";

type CallLead = {
  id: string;
  created_at: string;
  batch_date: string;
  company: string;
  phone: string;
  email: string | null;
  website: string | null;
  city: string | null;
  industry: string | null;
  address: string | null;
  source: string;
  status: "neu" | "kontaktiert" | "termin" | "angebot" | "gewonnen" | "verloren";
  notes: string | null;
  customer_id: string | null;
  info_permission_at: string | null;
  info_permission_source: string | null;
  last_contact_at: string | null;
  callback_at: string | null;
};

type SalesAutomation = {
  id: string;
  call_lead_id: string;
  status: "active" | "paused" | "completed" | "stopped" | "unsubscribed";
  phase: "information" | "appointment" | "offer" | "onboarding" | "manual_review" | "closed";
  last_action_at: string | null;
  next_action_at: string | null;
  stop_reason: string | null;
};

const openers = [
  "Hallo, Sebastian Pötschke von neXaro Solutions. Wissen Sie aktuell genau, was Sie Ihre Kartenzahlungen im Monat kosten?",
  "Hallo, Sebastian Pötschke von neXaro Solutions. Ich melde mich kurz zum Thema Kartenzahlung – wann haben Sie Ihre aktuellen Kosten zuletzt wirklich verglichen?",
  "Hallo, Sebastian Pötschke von neXaro Solutions. Eine kurze Frage: Zahlen Sie für Kartenzahlung nur nach Umsatz oder kommen bei Ihnen noch feste Gebühren dazu?",
  "Hallo, Sebastian Pötschke von neXaro Solutions. Ich betreue Unternehmen hier in der Region rund um Payment. Darf ich Ihnen kurz sagen, warum sich ein aktueller Vergleich fast immer lohnt?",
  "Hallo, Sebastian Pötschke von neXaro Solutions. Ich halte es ganz kurz: Ich vergleiche gerade Payment-Lösungen für Unternehmen in Ihrer Region – kennen Sie Ihre effektiven Kartenkosten pro Monat?",
];
const bridge = "Genau deshalb rufe ich an. Ich kann Ihnen die wichtigsten Infos und einen strukturierten Vergleich per Mail schicken – wohin darf ich sie senden?";

const statusLabel: Record<CallLead["status"], string> = {
  neu: "Neu", kontaktiert: "Kontaktiert", termin: "Termin", angebot: "Angebot", gewonnen: "Gewonnen", verloren: "Kein Interesse",
};
const phaseLabel: Record<SalesAutomation["phase"], string> = {
  information: "Informationsfolge", appointment: "Termin", offer: "Angebotsphase", onboarding: "Onboarding", manual_review: "Automatik wartet auf nächsten CRM-Schritt", closed: "Abgeschlossen",
};

function berlinDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function place(lead: CallLead) {
  return [lead.address, lead.city].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(" · ");
}
function formatDateTime(value: string | null) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function websiteHref(value: string | null) {
  if (!value) return "";
  try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).toString(); } catch { return ""; }
}
function companyVisual(lead: CallLead) {
  const site = websiteHref(lead.website);
  if (!site) return "";
  try { return new URL("/favicon.ico", site).toString(); } catch { return ""; }
}
function openerFor(lead: CallLead, offset = 0) {
  const seed = Array.from(lead.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return openers[(seed + offset) % openers.length];
}

export function CallLeads() {
  const [rows, setRows] = useState<CallLead[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [automations, setAutomations] = useState<Record<string, SalesAutomation>>({});
  const [draftEmails, setDraftEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [callMode, setCallMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openerOffset, setOpenerOffset] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointerStart = useRef<{x:number;y:number}|null>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const today = berlinDate();

  async function load(preserveNotice = false) {
    setLoading(true); setError(""); if (!preserveNotice) setNotice("");
    try {
      const result = await client.from("nx_daily_call_leads")
        .select("id,created_at,batch_date,company,phone,email,website,city,industry,address,source,status,notes,customer_id,info_permission_at,info_permission_source,last_contact_at,callback_at")
        .order("batch_date", { ascending: true }).order("created_at", { ascending: true }).limit(250);
      if (result.error) throw result.error;
      const all = (result.data || []) as CallLead[];
      const open = all.filter(row => row.status === "neu");
      const processedToday = all.filter(row => row.last_contact_at && berlinDate(new Date(row.last_contact_at)) === today);
      const chosen: CallLead[] = [];
      for (const row of processedToday) if (!chosen.some(item => item.id === row.id)) chosen.push(row);
      for (const row of open) { if (chosen.length >= 10) break; if (!chosen.some(item => item.id === row.id)) chosen.push(row); }
      setRows(chosen); setQueueTotal(open.length);
      setDraftEmails(current => { const next = { ...current }; for (const row of chosen) if (next[row.id] === undefined) next[row.id] = row.email || ""; return next; });
      if (chosen.length) {
        const autoResult = await client.from("nx_sales_automations").select("id,call_lead_id,status,phase,last_action_at,next_action_at,stop_reason").in("call_lead_id", chosen.map(row => row.id));
        if (autoResult.error) throw autoResult.error;
        const map: Record<string, SalesAutomation> = {}; for (const item of (autoResult.data || []) as SalesAutomation[]) map[item.call_lead_id] = item; setAutomations(map);
      } else setAutomations({});
    } catch (e) { setError(e instanceof Error ? e.message : "Telefonleads konnten nicht geladen werden."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const onFullscreen = () => { if (!document.fullscreenElement && callMode) setCallMode(false); };
    document.addEventListener("fullscreenchange", onFullscreen); return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, [callMode]);

  async function setStatus(lead: CallLead, status: CallLead["status"], note?: string) {
    if (busy) return false;
    setBusy(lead.id); setError(""); setNotice("");
    const now = new Date(); const stamp = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(now);
    const notes = [lead.notes?.trim(), note ? `${stamp}: ${note}` : ""].filter(Boolean).join("\n").slice(0, 5000) || null;
    try {
      const { data, error } = await client.from("nx_daily_call_leads").update({ status, notes, last_contact_at: now.toISOString() }).eq("id", lead.id)
        .select("id,created_at,batch_date,company,phone,email,website,city,industry,address,source,status,notes,customer_id,info_permission_at,info_permission_source,last_contact_at,callback_at").single();
      if (error) throw error;
      setRows(current => current.map(row => row.id === lead.id ? data as CallLead : row)); setNotice(`${lead.company}: ${statusLabel[status]} gespeichert.`); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Status konnte nicht gespeichert werden."); return false; }
    finally { setBusy(""); }
  }

  async function startInfoFunnel(lead: CallLead) {
    if (busy) return false;
    const email = (draftEmails[lead.id] || "").trim().toLowerCase();
    if (!validEmail(email)) { setNotice(`${lead.company}: Bitte zuerst die geschäftliche E-Mail-Adresse eintragen, die im Gespräch ausdrücklich für den Versand genannt wurde.`); return false; }
    setBusy(lead.id); setError(""); setNotice("");
    try {
      if (email !== (lead.email || "").trim().toLowerCase()) {
        const saved = await client.from("nx_daily_call_leads").update({ email }).eq("id", lead.id).select("id").single(); if (saved.error) throw saved.error;
      }
      const { data, error } = await client.functions.invoke("nx-sales-funnel", { body: { action: "start", leadId: lead.id, consentConfirmed: true } });
      if (error || !data?.ok) {
        let detail = data?.error || "Der neXaro-Mailfunnel konnte nicht gestartet werden.";
        try { if (!data?.error && error && "context" in error) detail = (await (error as any).context.json())?.error || detail; } catch { /* fallback */ }
        throw new Error(detail);
      }
      await load(true);
      if (data.alreadyActive) setNotice(`${lead.company}: Funnel bereits aktiv.`);
      else if (data.initialSent) setNotice(`${lead.company}: Erste neXaro-Mail versendet. Die Folge läuft automatisch.`);
      else setNotice(`${lead.company}: Funnel aktiv. Der erste Versand wird serverseitig automatisch erneut versucht.`);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Funnel konnte nicht gestartet werden."); return false; }
    finally { setBusy(""); }
  }

  function nextCard() {
    setDragX(0); setDragY(0); setOpenerOffset(0);
    setCurrentIndex(index => rows.length ? (index + 1) % rows.length : 0);
  }
  async function actionAndAdvance(action: "info" | "callback" | "appointment" | "lost") {
    const lead = rows[currentIndex]; if (!lead || busy) return;
    let ok = false;
    if (action === "info") ok = await startInfoFunnel(lead);
    if (action === "callback") ok = await setStatus(lead, "kontaktiert", "Rückruf vereinbart / erforderlich.");
    if (action === "appointment") ok = await setStatus(lead, "termin", "Termin aus Telefongespräch vorgemerkt; Terminangaben anschließend im Kalender erfassen.");
    if (action === "lost") ok = await setStatus(lead, "verloren", "Kein Interesse im Telefongespräch dokumentiert.");
    if (ok) nextCard();
  }
  async function startCallMode() {
    setCallMode(true); setCurrentIndex(Math.max(0, rows.findIndex(row => row.status === "neu"))); setOpenerOffset(0);
    try { await modeRef.current?.requestFullscreen?.(); } catch { /* iOS/PWA may use CSS fullscreen instead */ }
  }
  async function stopCallMode() {
    setCallMode(false); if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* ignore */ } }
  }
  function onPointerDown(event: React.PointerEvent) {
    if (busy) return; pointerStart.current = { x: event.clientX, y: event.clientY }; setDragging(true); event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event: React.PointerEvent) {
    if (!pointerStart.current || !dragging) return; setDragX(event.clientX - pointerStart.current.x); setDragY(event.clientY - pointerStart.current.y);
  }
  async function onPointerUp() {
    if (!pointerStart.current) return;
    const x = dragX, y = dragY; pointerStart.current = null; setDragging(false); setDragX(0); setDragY(0);
    if (Math.abs(x) > 95 && Math.abs(x) > Math.abs(y)) await actionAndAdvance(x > 0 ? "info" : "lost");
    else if (y < -95 && Math.abs(y) > Math.abs(x)) await actionAndAdvance("callback");
  }

  const stats = useMemo(() => ({ total: rows.length, open: rows.filter(row => row.status === "neu").length, contacted: rows.filter(row => row.status === "kontaktiert").length, done: rows.filter(row => ["termin", "angebot", "gewonnen", "verloren"].includes(row.status)).length }), [rows]);
  const current = rows[currentIndex] || rows[0];
  const currentAutomation = current ? automations[current.id] : undefined;
  const currentImage = current ? companyVisual(current) : "";
  const currentWebsite = current ? websiteHref(current.website) : "";
  const isCarryover = current ? current.batch_date < today && current.status === "neu" : false;
  const rotation = Math.max(-9, Math.min(9, dragX / 18));

  return <>
    <section className="nx-call-leads">
      <div className="section-intro">
        <div><span className="eyebrow">AUSSENDIENST · TELEFONAKQUISE</span><h1>📞 Telefonleads</h1><p>10er-Arbeitsliste mit Vollbild-Call-Modus. Offene Anrufe bleiben erhalten, bis du sie bearbeitet hast.</p></div>
        <div className="nx-call-top-actions"><button className="secondary" type="button" disabled={loading || !!busy} onClick={() => void load()}><RefreshCw size={16}/> Aktualisieren</button><button className="primary" type="button" disabled={loading || !rows.length} onClick={() => void startCallMode()}><Maximize2 size={17}/> Call-Modus starten</button></div>
      </div>
      <div className="metrics nx-call-metrics"><div className="card"><strong>{stats.total}</strong><p>Arbeitsliste</p></div><div className="card"><strong>{stats.open}</strong><p>Noch offen</p></div><div className="card"><strong>{stats.contacted}</strong><p>Funnel / Kontakt</p></div><div className="card"><strong>{queueTotal}</strong><p>Rückstand gesamt</p></div></div>
      {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}
      {!loading && rows.length > 0 && <div className="card nx-call-preview"><div><span className="eyebrow">MOBILE CALL EXPERIENCE</span><h2>Ein Lead. Ein Gespräch. Eine Entscheidung.</h2><p>Im Call-Modus bekommst du jede Firma einzeln als Swipe-Karte – ohne CRM-Ablenkung.</p></div><button className="primary" onClick={() => void startCallMode()}><Phone size={18}/> Jetzt starten</button></div>}
      {loading && <div className="loading">Telefonleads werden geladen …</div>}
      {!loading && !rows.length && <div className="card"><h2>Keine offenen Telefonleads</h2><p>Aktuell ist keine offene Arbeitsliste vorhanden.</p></div>}
    </section>

    <div ref={modeRef} className={"nx-call-mode " + (callMode ? "is-open" : "")} aria-hidden={!callMode}>
      {callMode && current && <>
        <header className="nx-call-mode-header"><div><strong>ne<span>X</span>aro</strong><small>CALL HUNTER</small></div><div className="nx-call-progress"><b>{Math.min(currentIndex + 1, rows.length)}</b><span>/ {rows.length}</span></div><button onClick={() => void stopCallMode()} aria-label="Call-Modus schließen"><Minimize2 size={21}/></button></header>
        <main className="nx-swipe-stage">
          <div className="nx-swipe-card nx-swipe-card-back" aria-hidden="true" />
          <article className={"nx-swipe-card " + (dragging ? "is-dragging" : "")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => void onPointerUp()} onPointerCancel={() => { pointerStart.current = null; setDragging(false); setDragX(0); setDragY(0); }} style={{ transform: `translate3d(${dragX}px, ${dragY}px, 0) rotate(${rotation}deg)` }}>
            {dragX > 45 && <div className="nx-swipe-stamp nx-swipe-stamp-right">INFOS</div>}{dragX < -45 && <div className="nx-swipe-stamp nx-swipe-stamp-left">NEIN</div>}{dragY < -45 && <div className="nx-swipe-stamp nx-swipe-stamp-up">RÜCKRUF</div>}
            <div className="nx-company-visual">
              {currentImage ? <img src={currentImage} alt="" onError={event => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement?.classList.add("fallback"); }} /> : <Building2 size={68}/>} 
              <div className="nx-company-overlay"><span>{current.industry || "Gewerbe"}</span><h1>{current.company}</h1><p>{place(current) || current.city || "Region Brandenburg"}</p></div>
            </div>
            <div className="nx-swipe-content">
              <div className="nx-company-meta"><a href={`tel:${current.phone}`}><Phone size={17}/><span>{current.phone}</span></a>{currentWebsite && <a href={currentWebsite} target="_blank" rel="noreferrer"><Globe2 size={17}/><span>Website</span></a>}</div>
              {isCarryover && <div className="nx-carryover-pill">Offen seit {current.batch_date.split("-").reverse().join(".")} · bleibt erhalten</div>}
              <div className="nx-opener-box"><div><span className="eyebrow">DEIN EINSTIEG</span><button type="button" onClick={event => { event.stopPropagation(); setOpenerOffset(value => value + 1); }}><Shuffle size={15}/> wechseln</button></div><p>„{openerFor(current, openerOffset)}“</p><details><summary>Übergang zu Infos senden</summary><p>„{bridge}“</p></details></div>
              <label className="nx-call-email-field nx-call-email-mode" onPointerDown={event => event.stopPropagation()}><span><Mail size={15}/> Mailadresse nach ausdrücklicher Versandfreigabe</span><input type="email" value={draftEmails[current.id] || ""} disabled={!!busy || currentAutomation?.status === "active"} onChange={event => setDraftEmails(values => ({ ...values, [current.id]: event.target.value }))} placeholder="kunde@unternehmen.de" /></label>
              {currentAutomation && <div className="nx-call-funnel-state"><strong>{currentAutomation.status === "active" ? "✓ neXaro Funnel aktiv" : `Funnel: ${currentAutomation.status}`}</strong><span>{phaseLabel[currentAutomation.phase]}{currentAutomation.next_action_at ? ` · nächste Aktion ${formatDateTime(currentAutomation.next_action_at)}` : ""}</span></div>}
            </div>
          </article>
        </main>
        <div className="nx-swipe-actions"><button className="lost" disabled={!!busy} onClick={() => void actionAndAdvance("lost")}><XCircle/><span>Kein Interesse</span></button><a className="call" href={`tel:${current.phone}`}><Phone/><span>Anrufen</span></a><button className="info" disabled={!!busy || currentAutomation?.status === "active"} onClick={() => void actionAndAdvance("info")}><Mail/><span>Infos senden</span></button></div>
        <div className="nx-swipe-secondary"><button disabled={!!busy} onClick={() => void actionAndAdvance("callback")}><CalendarClock size={17}/> Rückruf</button><button disabled={!!busy} onClick={() => void actionAndAdvance("appointment")}><CheckCircle2 size={17}/> Termin</button></div>
        <footer className="nx-swipe-hints"><span>← Kein Interesse</span><span>↑ Rückruf</span><span>Infos senden →</span></footer>
        {(notice || error) && <div className={"nx-call-mode-toast " + (error ? "error" : "")}>{error || notice}</div>}
      </>}
    </div>
  </>;
}
