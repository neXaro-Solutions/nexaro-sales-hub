import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, Globe2, Mail, Maximize2, Minimize2, Phone, RefreshCw, Shuffle, XCircle } from "lucide-react";
import { client } from "../lib/client";
import { useStore } from "../lib/store";

type CallLead = {
  id: string; created_at: string; batch_date: string; company: string; phone: string;
  email: string | null; website: string | null; city: string | null; industry: string | null; address: string | null; source: string;
  status: "neu" | "kontaktiert" | "termin" | "angebot" | "gewonnen" | "verloren" | "nicht_verfuegbar";
  notes: string | null; customer_id: string | null; info_permission_at: string | null; info_permission_source: string | null;
  last_contact_at: string | null; callback_at: string | null;
};
type SalesAutomation = { id: string; call_lead_id: string; status: "active" | "paused" | "completed" | "stopped" | "unsubscribed"; phase: "information" | "appointment" | "offer" | "onboarding" | "manual_review" | "closed"; last_action_at: string | null; next_action_at: string | null; stop_reason: string | null; };
type ScheduleMode = "callback" | "appointment";
type ScheduleDraft = { mode: ScheduleMode; lead: CallLead };

const openers = [
  "Hallo, Sebastian Pötschke von neXaro Solutions. Wissen Sie aktuell genau, was Sie Ihre Kartenzahlungen im Monat kosten?",
  "Hallo, Sebastian Pötschke von neXaro Solutions. Ich melde mich kurz zum Thema Kartenzahlung – wann haben Sie Ihre aktuellen Kosten zuletzt wirklich verglichen?",
  "Hallo, Sebastian Pötschke von neXaro Solutions. Eine kurze Frage: Zahlen Sie für Kartenzahlung nur nach Umsatz oder kommen bei Ihnen noch feste Gebühren dazu?",
  "Hallo, Sebastian Pötschke von neXaro Solutions. Ich betreue Unternehmen hier in der Region rund um Payment. Darf ich Ihnen kurz sagen, warum sich ein aktueller Vergleich fast immer lohnt?",
  "Hallo, Sebastian Pötschke von neXaro Solutions. Ich halte es ganz kurz: Ich vergleiche gerade Payment-Lösungen für Unternehmen in Ihrer Region – kennen Sie Ihre effektiven Kartenkosten pro Monat?",
];
const bridge = "Genau deshalb rufe ich an. Ich kann Ihnen die wichtigsten Infos und einen strukturierten Vergleich per Mail schicken – wohin darf ich sie senden?";
const statusLabel: Record<CallLead["status"], string> = { neu: "Neu", kontaktiert: "Kontaktiert", termin: "Termin", angebot: "Angebot", gewonnen: "Gewonnen", verloren: "Kein Interesse", nicht_verfuegbar: "Kontakt nicht verfügbar / Nummer nicht vergeben" };
const phaseLabel: Record<SalesAutomation["phase"], string> = { information: "Informationsfolge", appointment: "Termin", offer: "Angebotsphase", onboarding: "Onboarding", manual_review: "Automatik wartet auf nächsten CRM-Schritt", closed: "Abgeschlossen" };
const isExcluded = (status: CallLead["status"]) => status === "verloren" || status === "nicht_verfuegbar";

function berlinDate(date = new Date()) { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function place(lead: CallLead) { return [lead.address, lead.city].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(" · "); }
function formatDateTime(value: string | null) { if (!value) return "–"; return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function websiteHref(value: string | null) { if (!value) return ""; try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).toString(); } catch { return ""; } }
function openerFor(lead: CallLead, offset = 0) { const seed = Array.from(lead.id).reduce((sum, char) => sum + char.charCodeAt(0), 0); return openers[(seed + offset) % openers.length]; }
function localDateTimeValue(offsetMinutes = 60) { const date = new Date(Date.now() + offsetMinutes * 60000); const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date); return parts.replace(" ", "T"); }
function addressParts(lead: CallLead) { const raw = (lead.address || "").trim(); const match = raw.match(/^(.+?),\s*(\d{5})\s+(.+)$/); if (match) return { street: match[1].trim(), zip: match[2], city: match[3].trim() }; return { street: raw, zip: "", city: (lead.city || "").trim() }; }

export function CallLeads() {
  const { data: crmData, save } = useStore();
  const [rows, setRows] = useState<CallLead[]>([]); const [queueTotal, setQueueTotal] = useState(0); const [automations, setAutomations] = useState<Record<string, SalesAutomation>>({}); const [draftEmails, setDraftEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [callMode, setCallMode] = useState(false); const [currentIndex, setCurrentIndex] = useState(0); const [openerOffset, setOpenerOffset] = useState(0); const [dragX, setDragX] = useState(0); const [dragY, setDragY] = useState(0); const [dragging, setDragging] = useState(false); const [schedule, setSchedule] = useState<ScheduleDraft | null>(null); const [scheduleAt, setScheduleAt] = useState("");
  const pointerStart = useRef<{x:number;y:number}|null>(null); const modeRef = useRef<HTMLDivElement>(null); const today = berlinDate();

  async function load(preserveNotice = false) {
    setLoading(true); setError(""); if (!preserveNotice) setNotice("");
    try {
      const result = await client.from("nx_daily_call_leads").select("id,created_at,batch_date,company,phone,email,website,city,industry,address,source,status,notes,customer_id,info_permission_at,info_permission_source,last_contact_at,callback_at").order("batch_date", { ascending: true }).order("created_at", { ascending: true }).limit(250);
      if (result.error) throw result.error;
      const all = (result.data || []) as CallLead[]; const open = all.filter(row => row.status === "neu");
      const processedToday = all.filter(row => !isExcluded(row.status) && row.last_contact_at && berlinDate(new Date(row.last_contact_at)) === today);
      const chosen: CallLead[] = [];
      for (const row of processedToday) if (!chosen.some(item => item.id === row.id)) chosen.push(row);
      for (const row of open) { if (chosen.length >= 10) break; if (!chosen.some(item => item.id === row.id)) chosen.push(row); }
      setRows(chosen); setCurrentIndex(index => Math.min(index, Math.max(0, chosen.length - 1))); setQueueTotal(open.length);
      setDraftEmails(current => { const next = { ...current }; for (const row of chosen) if (next[row.id] === undefined) next[row.id] = row.email || ""; return next; });
      if (chosen.length) { const autoResult = await client.from("nx_sales_automations").select("id,call_lead_id,status,phase,last_action_at,next_action_at,stop_reason").in("call_lead_id", chosen.map(row => row.id)); if (autoResult.error) throw autoResult.error; const map: Record<string, SalesAutomation> = {}; for (const item of (autoResult.data || []) as SalesAutomation[]) map[item.call_lead_id] = item; setAutomations(map); } else setAutomations({});
    } catch (e) { setError(e instanceof Error ? e.message : "Telefonleads konnten nicht geladen werden."); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { const onFullscreen = () => { if (!document.fullscreenElement && callMode && !schedule) setCallMode(false); }; document.addEventListener("fullscreenchange", onFullscreen); return () => document.removeEventListener("fullscreenchange", onFullscreen); }, [callMode, schedule]);

  async function setStatus(lead: CallLead, status: CallLead["status"], note?: string) {
    if (busy) return false; setBusy(lead.id); setError(""); setNotice("");
    const now = new Date(); const stamp = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(now); const notes = [lead.notes?.trim(), note ? `${stamp}: ${note}` : ""].filter(Boolean).join("\n").slice(0, 5000) || null;
    try {
      const { data, error } = await client.from("nx_daily_call_leads").update({ status, notes, last_contact_at: now.toISOString() }).eq("id", lead.id).select("id,created_at,batch_date,company,phone,email,website,city,industry,address,source,status,notes,customer_id,info_permission_at,info_permission_source,last_contact_at,callback_at").single();
      if (error) throw error;
      if (isExcluded(status)) { setRows(current => current.filter(row => row.id !== lead.id)); setQueueTotal(total => Math.max(0, total - (lead.status === "neu" ? 1 : 0))); setCurrentIndex(index => Math.max(0, Math.min(index, rows.length - 2))); }
      else setRows(current => current.map(row => row.id === lead.id ? data as CallLead : row));
      setNotice(`${lead.company}: ${statusLabel[status]} gespeichert.`); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Status konnte nicht gespeichert werden."); return false; } finally { setBusy(""); }
  }

  async function startInfoFunnel(lead: CallLead) {
    if (busy) return false; const email = (draftEmails[lead.id] || "").trim().toLowerCase(); if (!validEmail(email)) { setNotice(`${lead.company}: Bitte zuerst die geschäftliche E-Mail-Adresse eintragen, die im Gespräch ausdrücklich für den Versand genannt wurde.`); return false; }
    setBusy(lead.id); setError(""); setNotice("");
    try { if (email !== (lead.email || "").trim().toLowerCase()) { const saved = await client.from("nx_daily_call_leads").update({ email }).eq("id", lead.id).select("id").single(); if (saved.error) throw saved.error; } const { data, error } = await client.functions.invoke("nx-sales-funnel-web", { body: { action: "start", leadId: lead.id, consentConfirmed: true } }); if (error || !data?.ok) { let detail = data?.error || "Der neXaro-Mailfunnel konnte nicht gestartet werden."; try { if (!data?.error && error && "context" in error) detail = (await (error as any).context.json())?.error || detail; } catch {} throw new Error(detail); } await load(true); if (data.alreadyActive) setNotice(`${lead.company}: Funnel bereits aktiv.`); else if (data.initialSent) setNotice(`${lead.company}: Erste neXaro-Mail versendet. Die Folge läuft automatisch.`); else setNotice(`${lead.company}: Funnel aktiv. Der erste Versand wird serverseitig automatisch erneut versucht.`); return true; } catch (e) { setError(e instanceof Error ? e.message : "Funnel konnte nicht gestartet werden."); return false; } finally { setBusy(""); }
  }

  function resetSwipe() { setDragX(0); setDragY(0); setOpenerOffset(0); }
  function nextCard() { resetSwipe(); setCurrentIndex(index => rows.length ? (index + 1) % rows.length : 0); }
  function previousCard() { resetSwipe(); setCurrentIndex(index => rows.length ? (index - 1 + rows.length) % rows.length : 0); }
  async function actionAndAdvance(action: "info" | "lost" | "unavailable") { const lead = rows[currentIndex]; if (!lead || busy) return; if (action === "info") { const ok = await startInfoFunnel(lead); if (ok) nextCard(); return; } if (action === "lost") await setStatus(lead, "verloren", "Kein Interesse im Telefongespräch dokumentiert. Dauerhaft aus dem aktiven Call-Pool ausgeschlossen."); if (action === "unavailable") await setStatus(lead, "nicht_verfuegbar", "Kontakt nicht verfügbar / Nummer nicht vergeben. Dauerhaft aus dem aktiven Call-Pool ausgeschlossen."); resetSwipe(); }
  function openSchedule(mode: ScheduleMode) { const lead = rows[currentIndex]; if (!lead || busy) return; setError(""); setNotice(""); setSchedule({ mode, lead }); setScheduleAt(localDateTimeValue(mode === "callback" ? 60 : 24 * 60)); }

  async function ensureCustomer(lead: CallLead) {
    if (lead.customer_id) return lead.customer_id; const email = (draftEmails[lead.id] || lead.email || "").trim().toLowerCase(); const phone = (lead.phone || "").trim();
    const existing = crmData.customers.find(customer => (email && customer.email.trim().toLowerCase() === email) || (phone && customer.phone.trim() === phone) || customer.company.trim().toLowerCase() === lead.company.trim().toLowerCase()); if (existing) return existing.id;
    const addr = addressParts(lead); const customer = await save("customers", { company: lead.company, contact: "", email, phone, website: lead.website || "", street: addr.street, zip: addr.zip, city: addr.city || lead.city || "", industry: lead.industry || "", source: "Telefonlead", acquisition_source: "Telefonakquise", notes: "Automatisch aus dem neXaro Call Hunter übernommen.", lat: null, lng: null, interests: ["sumup"], lead_status: "Kontaktiert", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "", gclid: "", landing_page: "", conversion_value: 0 }); return customer.id;
  }

  async function saveSchedule() {
    if (!schedule || busy || !scheduleAt) return; const { lead, mode } = schedule; setBusy(lead.id); setError(""); setNotice("");
    try { const customerId = await ensureCustomer(lead); const email = (draftEmails[lead.id] || lead.email || "").trim().toLowerCase(); const due = new Date(scheduleAt); if (Number.isNaN(due.getTime())) throw new Error("Bitte Datum und Uhrzeit prüfen."); const dueAt = due.toISOString(); const address = place(lead);
      const task = await save("tasks", { customer_id: customerId, division: "sumup", due_at: dueAt, kind: mode === "appointment" ? "Termin" : "Wiedervorlage", title: `${mode === "appointment" ? "Kundentermin" : "Rückruf"} · ${lead.company}`, notes: [`Terminart: ${mode === "appointment" ? "Kundentermin vor Ort" : "Rückruf"}`, `Telefon: ${lead.phone}`, email ? `E-Mail: ${email}` : "", address ? `Adresse: ${address}` : "", `Quelle: neXaro Call Hunter · Telefonlead ${lead.id}`].filter(Boolean).join("\n"), done: false });
      const now = new Date().toISOString(); const stamp = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(new Date()); const notes = [lead.notes?.trim(), `${stamp}: ${mode === "appointment" ? "Kundentermin" : "Rückruf"} im CRM-Kalender angelegt.`].filter(Boolean).join("\n").slice(0, 5000) || null;
      const update = await client.from("nx_daily_call_leads").update({ status: mode === "appointment" ? "termin" : "kontaktiert", customer_id: customerId, email: email || lead.email, callback_at: mode === "callback" ? dueAt : lead.callback_at, last_contact_at: now, notes }).eq("id", lead.id).select("id,created_at,batch_date,company,phone,email,website,city,industry,address,source,status,notes,customer_id,info_permission_at,info_permission_source,last_contact_at,callback_at").single(); if (update.error) throw update.error;
      setRows(currentRows => currentRows.map(row => row.id === lead.id ? update.data as CallLead : row)); setSchedule(null); setNotice(`${mode === "appointment" ? "Termin" : "Rückruf"} gespeichert: ${task.title}.`); setCallMode(false); if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch {} } window.setTimeout(() => { const calendarButton = Array.from(document.querySelectorAll<HTMLButtonElement>("aside nav button")).find(button => button.textContent?.includes("Kalender")); calendarButton?.click(); }, 0);
    } catch (e) { setError(e instanceof Error ? e.message : "Kalendereintrag konnte nicht angelegt werden."); } finally { setBusy(""); }
  }

  async function openMetric(kind: "all" | "open" | "contacted" | "backlog") { if (!rows.length) return; let index = 0; if (kind === "open") index = rows.findIndex(row => row.status === "neu"); if (kind === "contacted") index = rows.findIndex(row => row.status === "kontaktiert" || automations[row.id]?.status === "active"); if (kind === "backlog") index = rows.findIndex(row => row.status === "neu" && row.batch_date < today); if (index < 0) { setNotice("In diesem Bereich gibt es aktuell keinen passenden Lead."); return; } setCallMode(true); setCurrentIndex(index); resetSwipe(); try { await modeRef.current?.requestFullscreen?.(); } catch {} }
  async function startCallMode() { const firstOpen = rows.findIndex(row => row.status === "neu"); setCallMode(true); setCurrentIndex(firstOpen >= 0 ? firstOpen : 0); resetSwipe(); try { await modeRef.current?.requestFullscreen?.(); } catch {} }
  async function stopCallMode() { setSchedule(null); setCallMode(false); if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch {} } }
  function onPointerDown(event: React.PointerEvent) { if (busy || schedule) return; pointerStart.current = { x: event.clientX, y: event.clientY }; setDragging(true); event.currentTarget.setPointerCapture?.(event.pointerId); }
  function onPointerMove(event: React.PointerEvent) { if (!pointerStart.current || !dragging) return; setDragX(event.clientX - pointerStart.current.x); setDragY(event.clientY - pointerStart.current.y); }
  function onPointerUp() { if (!pointerStart.current) return; const x = dragX, y = dragY; pointerStart.current = null; setDragging(false); setDragX(0); setDragY(0); if (Math.abs(x) > 95 && Math.abs(x) > Math.abs(y)) { if (x > 0) nextCard(); else previousCard(); } }

  const stats = useMemo(() => ({ total: rows.length, open: rows.filter(row => row.status === "neu").length, contacted: rows.filter(row => row.status === "kontaktiert" || automations[row.id]?.status === "active").length, done: rows.filter(row => ["termin", "angebot", "gewonnen"].includes(row.status)).length }), [rows, automations]);
  const current = rows[currentIndex] || rows[0]; const currentAutomation = current ? automations[current.id] : undefined; const currentWebsite = current ? websiteHref(current.website) : ""; const isCarryover = current ? current.batch_date < today && current.status === "neu" : false; const rotation = Math.max(-9, Math.min(9, dragX / 18));

  return <>
    <section className="nx-call-leads">
      <div className="section-intro"><div><span className="eyebrow">AUSSENDIENST · TELEFONAKQUISE</span><h1>📞 Telefonleads</h1><p>10er-Arbeitsliste mit Vollbild-Call-Modus. Offene Anrufe bleiben erhalten, bis du sie bearbeitet hast.</p></div><div className="nx-call-top-actions"><button className="secondary" type="button" disabled={loading || !!busy} onClick={() => void load()}><RefreshCw size={16}/> Aktualisieren</button><button className="primary" type="button" disabled={loading || !rows.length} onClick={() => void startCallMode()}><Maximize2 size={17}/> Call-Modus starten</button></div></div>
      <div className="metrics nx-call-metrics"><button className="card nx-call-metric-card" type="button" onClick={() => void openMetric("all")}><strong>{stats.total}</strong><p>Arbeitsliste</p></button><button className="card nx-call-metric-card" type="button" onClick={() => void openMetric("open")}><strong>{stats.open}</strong><p>Noch offen</p></button><button className="card nx-call-metric-card" type="button" onClick={() => void openMetric("contacted")}><strong>{stats.contacted}</strong><p>Funnel / Kontakt</p></button><button className="card nx-call-metric-card" type="button" onClick={() => void openMetric("backlog")}><strong>{queueTotal}</strong><p>Rückstand gesamt</p></button></div>
      {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}
      {!loading && rows.length > 0 && <div className="card nx-call-preview"><div><span className="eyebrow">MOBILE CALL EXPERIENCE</span><h2>Ein Lead. Ein Gespräch. Eine Entscheidung.</h2><p>Im Call-Modus bekommst du jede Firma einzeln als Swipe-Karte – ohne CRM-Ablenkung.</p></div><button className="primary" onClick={() => void startCallMode()}><Phone size={18}/> Jetzt starten</button></div>}
      {loading && <div className="loading">Telefonleads werden geladen …</div>}{!loading && !rows.length && <div className="card"><h2>Keine offenen Telefonleads</h2><p>Aktuell ist keine offene Arbeitsliste vorhanden.</p></div>}
    </section>
    <div ref={modeRef} className={"nx-call-mode " + (callMode ? "is-open" : "")} aria-hidden={!callMode}>
      {callMode && current && <>
        <header className="nx-call-mode-header"><div><strong>ne<span>X</span>aro</strong><small>CALL HUNTER</small></div><div className="nx-call-progress"><b>{Math.min(currentIndex + 1, rows.length)}</b><span>/ {rows.length}</span></div><button onClick={() => void stopCallMode()} aria-label="Call-Modus schließen"><Minimize2 size={21}/></button></header>
        <main className="nx-swipe-stage"><div className="nx-swipe-card nx-swipe-card-back" aria-hidden="true" /><article className={"nx-swipe-card " + (dragging ? "is-dragging" : "")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { pointerStart.current = null; setDragging(false); setDragX(0); setDragY(0); }} style={{ transform: `translate3d(${dragX}px, ${dragY}px, 0) rotate(${rotation}deg)` }}>
          {dragX > 45 && <div className="nx-swipe-stamp nx-swipe-stamp-right">WEITER</div>}{dragX < -45 && <div className="nx-swipe-stamp nx-swipe-stamp-left">ZURÜCK</div>}
          <div className="nx-company-visual"><div className="nx-company-overlay"><span>{current.industry || "Gewerbe"}</span><h1>{current.company}</h1><p>{place(current) || current.city || "Region Brandenburg"}</p></div></div>
          <div className="nx-swipe-content"><div className="nx-company-meta"><a href={`tel:${current.phone}`}><Phone size={17}/><span>{current.phone}</span></a>{currentWebsite && <a href={currentWebsite} target="_blank" rel="noreferrer"><Globe2 size={17}/><span>Website</span></a>}</div>{isCarryover && <div className="nx-carryover-pill">Offen seit {current.batch_date.split("-").reverse().join(".")} · bleibt erhalten</div>}<div className="nx-opener-box"><div><span className="eyebrow">DEIN EINSTIEG</span><button type="button" onClick={event => { event.stopPropagation(); setOpenerOffset(value => value + 1); }}><Shuffle size={15}/> wechseln</button></div><p>„{openerFor(current, openerOffset)}“</p><details><summary>Übergang zu Infos senden</summary><p>„{bridge}“</p></details></div><label className="nx-call-email-field nx-call-email-mode" onPointerDown={event => event.stopPropagation()}><span><Mail size={15}/> Mailadresse nach ausdrücklicher Versandfreigabe</span><input type="email" value={draftEmails[current.id] || ""} disabled={!!busy || currentAutomation?.status === "active"} onChange={event => setDraftEmails(values => ({ ...values, [current.id]: event.target.value }))} placeholder="kunde@unternehmen.de" /></label>{currentAutomation && <div className="nx-call-funnel-state"><strong>{currentAutomation.status === "active" ? "✓ neXaro Funnel aktiv" : `Funnel: ${currentAutomation.status}`}</strong><span>{phaseLabel[currentAutomation.phase]}{currentAutomation.next_action_at ? ` · nächste Aktion ${formatDateTime(currentAutomation.next_action_at)}` : ""}</span></div>}</div>
        </article></main>
        <div className="nx-swipe-actions"><button className="lost" disabled={!!busy} onClick={() => void actionAndAdvance("lost")}><XCircle/><span>Kein Interesse</span></button><a className="call" href={`tel:${current.phone}`}><Phone/><span>Anrufen</span></a><button className="info" disabled={!!busy || currentAutomation?.status === "active"} onClick={() => void actionAndAdvance("info")}><Mail/><span>Infos senden</span></button></div>
        <div className="nx-swipe-secondary"><button disabled={!!busy} onClick={() => void actionAndAdvance("unavailable")}><XCircle size={17}/> Kontakt nicht verfügbar / Nummer nicht vergeben</button><button disabled={!!busy} onClick={() => openSchedule("callback")}><CalendarClock size={17}/> Rückruf</button><button disabled={!!busy} onClick={() => openSchedule("appointment")}><CheckCircle2 size={17}/> Termin</button></div>
        <footer className="nx-swipe-hints"><span>← Vorheriger Kontakt</span><span>Aktion per Button</span><span>Nächster Kontakt →</span></footer>{(notice || error) && <div className={"nx-call-mode-toast " + (error ? "error" : "")}>{error || notice}</div>}
        {schedule && <div className="nx-call-schedule-backdrop" onPointerDown={event => event.stopPropagation()}><section className="nx-call-schedule" role="dialog" aria-modal="true" aria-label={schedule.mode === "callback" ? "Rückruf planen" : "Kundentermin planen"}><span className="eyebrow">{schedule.mode === "callback" ? "RÜCKRUF" : "KUNDENTERMIN"}</span><h2>{schedule.lead.company}</h2><p>{schedule.mode === "callback" ? "Telefonischer Rückruf mit vollständigem Kundenbezug." : "Termin vor Ort mit vollständiger Firmenadresse."}</p><div className="nx-call-schedule-contact"><span>☎ {schedule.lead.phone}</span>{(draftEmails[schedule.lead.id] || schedule.lead.email) && <span>✉ {draftEmails[schedule.lead.id] || schedule.lead.email}</span>}{place(schedule.lead) && <span>⌖ {place(schedule.lead)}</span>}</div><label>Datum & Uhrzeit<input type="datetime-local" value={scheduleAt} onChange={event => setScheduleAt(event.target.value)} /></label><div className="nx-call-schedule-actions"><button type="button" className="secondary" disabled={!!busy} onClick={() => setSchedule(null)}>Abbrechen</button><button type="button" className="primary" disabled={!!busy || !scheduleAt} onClick={() => void saveSchedule()}>{busy ? "Wird angelegt …" : "Im Kalender anlegen"}</button></div></section></div>}
      </>}
    </div>
  </>;
}
