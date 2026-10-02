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

function berlinDate() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function place(lead: CallLead) {
  return [lead.address, lead.city].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(" · ");
}

export function CallLeads() {
  const [rows, setRows] = useState<CallLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [batchDate, setBatchDate] = useState(berlinDate());

  async function load() {
    setLoading(true); setError(""); setNotice("");
    try {
      const today = berlinDate();
      let result = await client.from("nx_daily_call_leads")
        .select("id,created_at,batch_date,company,phone,email,website,city,industry,address,source,status,notes")
        .eq("batch_date", today)
        .order("created_at", { ascending: true });
      if (result.error) throw result.error;
      let data = (result.data || []) as CallLead[];
      let shownDate = today;
      if (!data.length) {
        const fallback = await client.from("nx_daily_call_leads")
          .select("id,created_at,batch_date,company,phone,email,website,city,industry,address,source,status,notes")
          .order("batch_date", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(30);
        if (fallback.error) throw fallback.error;
        const all = (fallback.data || []) as CallLead[];
        shownDate = all[0]?.batch_date || today;
        data = all.filter(row => row.batch_date === shownDate);
        if (data.length) setNotice("Für heute ist noch keine neue 10er-Liste vorhanden. Angezeigt wird der letzte verfügbare Telefonlead-Tag.");
      }
      setRows(data); setBatchDate(shownDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Telefonleads konnten nicht geladen werden.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function setStatus(lead: CallLead, status: CallLead["status"], note?: string) {
    if (busy) return;
    setBusy(lead.id); setError(""); setNotice("");
    const stamp = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(new Date());
    const notes = [lead.notes?.trim(), note ? `${stamp}: ${note}` : ""].filter(Boolean).join("\n").slice(0, 5000) || null;
    try {
      const { data, error } = await client.from("nx_daily_call_leads")
        .update({ status, notes })
        .eq("id", lead.id)
        .select("id,created_at,batch_date,company,phone,email,website,city,industry,address,source,status,notes")
        .single();
      if (error) throw error;
      setRows(current => current.map(row => row.id === lead.id ? data as CallLead : row));
      setNotice(`${lead.company}: ${statusLabel[status]} gespeichert.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status konnte nicht gespeichert werden.");
    } finally { setBusy(""); }
  }

  async function markInfoPermission(lead: CallLead) {
    if (!lead.email) {
      setNotice(`${lead.company}: Bitte im Gespräch zuerst die geschäftliche E-Mail-Adresse erfassen. Der automatische Versand wird erst nach dokumentierter Versandfreigabe gestartet.`);
      return;
    }
    await setStatus(lead, "kontaktiert", `Versandfreigabe im Telefongespräch dokumentiert für ${lead.email}. „Infos senden“ ausgewählt; noch kein automatischer E-Mail-Versand ausgelöst.`);
    setNotice(`${lead.company}: Versandfreigabe dokumentiert. Der automatische neXaro-Mailfunnel ist in dieser Ansicht noch nicht aktiviert – es wurde keine E-Mail versendet.`);
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
        <p>Deine tägliche 10er-Liste – anrufen, Ergebnis festhalten, nächster Lead.</p>
      </div>
      <button className="secondary" type="button" disabled={loading || !!busy} onClick={() => void load()}><RefreshCw size={16}/> Aktualisieren</button>
    </div>

    <div className="metrics nx-call-metrics">
      <div className="card"><strong>{stats.total}</strong><p>Leads · {batchDate.split("-").reverse().join(".")}</p></div>
      <div className="card"><strong>{stats.open}</strong><p>Noch offen</p></div>
      <div className="card"><strong>{stats.contacted}</strong><p>Kontaktiert</p></div>
      <div className="card"><strong>{stats.done}</strong><p>Entschieden</p></div>
    </div>

    {notice && <p className="notice" role="status">{notice}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <div className="loading">Telefonleads werden geladen …</div> : !rows.length ? <div className="card"><h2>Noch keine Telefonleads</h2><p>Für den aktuellen oder letzten verfügbaren Tag wurden keine Einträge gefunden.</p></div> :
      <div className="nx-call-list">
        {rows.map((lead, index) => <article className={"card nx-call-card " + (lead.status !== "neu" ? "is-processed" : "")} key={lead.id}>
          <div className="nx-call-head">
            <div>
              <span className="eyebrow">LEAD {index + 1} VON {rows.length}</span>
              <h2>{lead.company}</h2>
              <p>{[lead.industry, place(lead)].filter(Boolean).join(" · ") || "Unternehmensdaten prüfen"}</p>
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

          {lead.email && <p className="nx-call-contact"><Mail size={15}/> {lead.email}</p>}

          <div className="nx-call-actions">
            <button className="primary" type="button" disabled={!!busy || lead.status === "verloren"} onClick={() => void markInfoPermission(lead)}><Mail size={16}/> Infos senden</button>
            <button className="secondary" type="button" disabled={!!busy} onClick={() => void setStatus(lead, "kontaktiert", "Rückruf vereinbart / erforderlich.")}><CalendarClock size={16}/> Rückruf</button>
            <button className="secondary" type="button" disabled={!!busy} onClick={() => void setStatus(lead, "termin", "Termin aus Telefongespräch vorgemerkt; Terminangaben anschließend im Kalender erfassen.")}><CheckCircle2 size={16}/> Termin</button>
            <button className="secondary" type="button" disabled={!!busy || lead.status === "verloren"} onClick={() => void setStatus(lead, "verloren", "Kein Interesse im Telefongespräch dokumentiert.")}><XCircle size={16}/> Kein Interesse</button>
          </div>
        </article>)}
      </div>}
  </section>;
}
