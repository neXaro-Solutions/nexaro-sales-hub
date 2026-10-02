import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Mail, Phone, RefreshCw, XCircle } from "lucide-react";
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

const opener = "Hallo, Sebastian Pötschke von neXaro Solutions. Ich habe nur eine kurze Frage: Wissen Sie aktuell genau, was Sie Ihre Kartenzahlungen im Monat kosten?";
const bridge = "Genau deshalb rufe ich an. Ich mache für Unternehmen hier in der Region einen kurzen Vergleich. Ich kann Ihnen die Infos dazu per Mail schicken – wohin darf ich sie senden?";

const statusLabel: Record<CallLead["status"], string> = {
  neu: "Neu",
  kontaktiert: "Kontaktiert",
  termin: "Termin",
  angebot: "Angebot",
  gewonnen: "Gewonnen",
  verloren: "Kein Interesse",
};

const phaseLabel: Record<SalesAutomation["phase"], string> = {
  information: "Informationsfolge",
  appointment: "Termin",
  offer: "Angebotsphase",
  onboarding: "Onboarding",
  manual_review: "Automatik wartet auf nächsten CRM-Schritt",
  closed: "Abgeschlossen",
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

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
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
  const today = berlinDate();

  async function load() {
    setLoading(true); setError(""); setNotice("");
    try {
      const result = await client.from("nx_daily_call_leads")
        .select("id,created_at,batch_date,company,phone,email,website,city,industry,address,source,status,notes,customer_id,info_permission_at,info_permission_source,last_contact_at,callback_at")
        .order("batch_date", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(250);
      if (result.error) throw result.error;
      const all = (result.data || []) as CallLead[];
      const open = all.filter(row => row.status === "neu");
      const processedToday = all.filter(row => row.last_contact_at && berlinDate(new Date(row.last_contact_at)) === today);
      const chosen: CallLead[] = [];
      for (const row of processedToday) if (!chosen.some(item => item.id === row.id)) chosen.push(row);
      for (const row of open) {
        if (chosen.length >= 10) break;
        if (!chosen.some(item => item.id === row.id)) chosen.push(row);
      }
      setRows(chosen);
      setQueueTotal(open.length);
      setDraftEmails(current => {
        const next = { ...current };
        for (const row of chosen) if (next[row.id] === undefined) next[row.id] = row.email || "";
        return next;
      });

      if (chosen.length) {
        const ids = chosen.map(row => row.id);
        const autoResult = await client.from("nx_sales_automations")
          .select("id,call_lead_id,status,phase,last_action_at,next_action_at,stop_reason")
          .in("call_lead_id", ids);
        if (autoResult.error) throw autoResult.error;
        const map: Record<string, SalesAutomation> = {};
        for (const item of (autoResult.data || []) as SalesAutomation[]) map[item.call_lead_id] = item;
        setAutomations(map);
      } else setAutomations({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Telefonleads konnten nicht geladen werden.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function setStatus(lead: CallLead, status: CallLead["status"], note?: string) {
    if (busy) return;
    setBusy(lead.id); setError(""); setNotice("");
    const now = new Date();
    const stamp = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(now);
    const notes = [lead.notes?.trim(), note ? `${stamp}: ${note}` : ""].filter(Boolean).join("\n").slice(0, 5000) || null;
    try {
      const { data, error } = await client.from("nx_daily_call_leads")
        .update({ status, notes, last_contact_at: now.toISOString() })
        .eq("id", lead.id)
        .select("id,created_at,batch_date,company,phone,email,website,city,industry,address,source,status,notes,customer_id,info_permission_at,info_permission_source,last_contact_at,callback_at")
        .single();
      if (error) throw error;
      setRows(current => current.map(row => row.id === lead.id ? data as CallLead : row));
      setNotice(`${lead.company}: ${statusLabel[status]} gespeichert.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status konnte nicht gespeichert werden.");
    } finally { setBusy(""); }
  }

  async function startInfoFunnel(lead: CallLead) {
    if (busy) return;
    const email = (draftEmails[lead.id] || "").trim().toLowerCase();
    if (!validEmail(email)) {
      setNotice(`${lead.company}: Bitte zuerst die geschäftliche E-Mail-Adresse eintragen, die im Gespräch ausdrücklich für den Versand genannt wurde.`);
      return;
    }
    setBusy(lead.id); setError(""); setNotice("");
    try {
      if (email !== (lead.email || "").trim().toLowerCase()) {
        const saved = await client.from("nx_daily_call_leads").update({ email }).eq("id", lead.id).select("id").single();
        if (saved.error) throw saved.error;
      }
      const { data, error } = await client.functions.invoke("nx-sales-funnel", {
        body: { action: "start", leadId: lead.id, consentConfirmed: true },
      });
      if (error || !data?.ok) {
        let detail = data?.error || "Der neXaro-Mailfunnel konnte nicht gestartet werden.";
        try { if (!data?.error && error && "context" in error) detail = (await (error as any).context.json())?.error || detail; } catch { /* use fallback */ }
        throw new Error(detail);
      }
      await load();
      if (data.alreadyActive) setNotice(`${lead.company}: Der neXaro-Mailfunnel war bereits aktiv. Es wurde kein zweiter Funnel gestartet.`);
      else if (data.initialSent) setNotice(`${lead.company}: Funnel aktiv. Die erste neXaro-Mail wurde vom SMTP-Server angenommen; die weiteren Schritte laufen automatisch.`);
      else setNotice(`${lead.company}: Funnel aktiv. Der erste Versand konnte noch nicht bestätigt werden und wird serverseitig automatisch erneut versucht.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Funnel konnte nicht gestartet werden.");
    } finally { setBusy(""); }
  }

  const stats = useMemo(() => ({
    total: rows.length,
    open: rows.filter(row => row.status === "neu").length,
    contacted: rows.filter(row => row.status === "kontaktiert").length,
    done: rows.filter(row => ["termin", "angebot", "gewonnen", "verloren"].includes(row.status)).length,
  }), [rows]);

  return <section className="nx-call-leads">
    <div className="section-intro">
      <div>
        <span className="eyebrow">AUSSENDIENST · TELEFONAKQUISE</span>
        <h1>📞 Telefonleads</h1>
        <p>Deine 10er-Arbeitsliste – offene Anrufe bleiben erhalten und werden erst nach deiner Bearbeitung ersetzt.</p>
      </div>
      <button className="secondary" type="button" disabled={loading || !!busy} onClick={() => void load()}><RefreshCw size={16}/> Aktualisieren</button>
    </div>

    <div className="metrics nx-call-metrics">
      <div className="card"><strong>{stats.total}</strong><p>Heutige Arbeitsliste</p></div>
      <div className="card"><strong>{stats.open}</strong><p>Noch offen</p></div>
      <div className="card"><strong>{stats.contacted}</strong><p>Funnel / Kontakt</p></div>
      <div className="card"><strong>{queueTotal}</strong><p>Offen im Rückstand gesamt</p></div>
    </div>

    {notice && <p className="notice" role="status">{notice}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <div className="loading">Telefonleads werden geladen …</div> : !rows.length ? <div className="card"><h2>Keine offenen Telefonleads</h2><p>Aktuell ist keine offene Arbeitsliste vorhanden.</p></div> :
      <div className="nx-call-list">
        {rows.map((lead, index) => {
          const automation = automations[lead.id];
          const funnelActive = automation?.status === "active";
          const isCarryover = lead.batch_date < today && lead.status === "neu";
          return <article className={"card nx-call-card " + (lead.status !== "neu" ? "is-processed" : "")} key={lead.id}>
            <div className="nx-call-head">
              <div>
                <span className="eyebrow">LEAD {index + 1} VON {rows.length}{isCarryover ? " · ÜBERNOMMEN" : ""}</span>
                <h2>{lead.company}</h2>
                <p>{[lead.industry, place(lead)].filter(Boolean).join(" · ") || "Unternehmensdaten prüfen"}</p>
                {isCarryover && <small className="nx-call-carryover">Offen seit {lead.batch_date.split("-").reverse().join(".")} · bleibt bis zur Bearbeitung in deiner Liste.</small>}
              </div>
              <span className={"badge " + (lead.status === "neu" ? "" : lead.status === "verloren" ? "" : "positive")}>{statusLabel[lead.status]}</span>
            </div>

            <a className="primary wide nx-call-phone" href={`tel:${lead.phone}`}><Phone size={20}/> {lead.phone} anrufen</a>

            <div className="nx-call-script">
              <span className="eyebrow">GESPRÄCHSEINSTIEG</span>
              <p>„{opener}“</p>
              <details>
                <summary>Übergang zu Infos senden</summary>
                <p>„{bridge}“</p>
              </details>
            </div>

            <label className="nx-call-email-field">
              <span><Mail size={15}/> Geschäftliche E-Mail für den ausdrücklich vereinbarten Versand</span>
              <input type="email" value={draftEmails[lead.id] || ""} disabled={!!busy || funnelActive} onChange={event => setDraftEmails(current => ({ ...current, [lead.id]: event.target.value }))} placeholder="kunde@unternehmen.de" autoComplete="off" />
            </label>

            {automation && <div className="nx-call-funnel-state">
              <strong>{automation.status === "active" ? "✓ neXaro Funnel aktiv" : `Funnel: ${automation.status}`}</strong>
              <span>{phaseLabel[automation.phase]}{automation.next_action_at ? ` · nächste Aktion ${formatDateTime(automation.next_action_at)}` : ""}</span>
            </div>}

            <div className="nx-call-actions">
              <button className="primary" type="button" disabled={!!busy || lead.status === "verloren" || funnelActive} onClick={() => void startInfoFunnel(lead)}><Mail size={16}/> {funnelActive ? "Funnel aktiv" : "Infos senden"}</button>
              <button className="secondary" type="button" disabled={!!busy} onClick={() => void setStatus(lead, "kontaktiert", "Rückruf vereinbart / erforderlich.")}><CalendarClock size={16}/> Rückruf</button>
              <button className="secondary" type="button" disabled={!!busy} onClick={() => void setStatus(lead, "termin", "Termin aus Telefongespräch vorgemerkt; Terminangaben anschließend im Kalender erfassen.")}><CheckCircle2 size={16}/> Termin</button>
              <button className="secondary" type="button" disabled={!!busy || lead.status === "verloren"} onClick={() => void setStatus(lead, "verloren", "Kein Interesse im Telefongespräch dokumentiert.")}><XCircle size={16}/> Kein Interesse</button>
            </div>
          </article>;
        })}
      </div>}
  </section>;
}
