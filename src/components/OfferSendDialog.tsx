import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { client } from "../lib/client";
import { useStore } from "../lib/store";
import type { Offer } from "../lib/types";
import { Field, Modal } from "./UI";

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export function OfferSendDialog({ offer, onClose, onSent }: {
  offer: Offer; onClose: () => void; onSent: () => void;
}) {
  const { data, demo } = useStore();
  const customer = data.customers.find(c => c.id === offer.customer_id);
  const [to, setTo] = useState(customer?.email || "");
  const [salutation, setSalutation] = useState<"neutral" | "herr" | "frau">("neutral");
  const [recipientName, setRecipientName] = useState(customer?.contact?.trim().split(/\s+/).at(-1) || "");
  const greeting = salutation === "herr" && recipientName.trim() ? "Guten Tag Herr " + recipientName.trim() + "," : salutation === "frau" && recipientName.trim() ? "Guten Tag Frau " + recipientName.trim() + "," : "Guten Tag,";
  const [message, setMessage] = useState(
    "vielen Dank für Ihr Interesse. Anbei erhalten Sie unser Angebot " + offer.number +
    " als PDF. Bei Fragen stehe ich Ihnen gerne persönlich zur Verfügung."
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loggingWarning, setLoggingWarning] = useState("");
  async function send() {
    if (sending || success || demo || !offer.customer_id || !validEmail(to)) return;
    setSending(true); setError("");
    try {
      const { data: result, error: invokeError } = await client.functions.invoke("nx-send-offer", {
        body: { action: "send", offerId: offer.id, to: to.trim(), message: greeting + "\n\n" + message.trim() }
      });
      if (invokeError || !result?.sent) {
        let diagnostic: {error?: string; phase?: string; code?: string; smtpStatus?: number; detail?: string} | undefined = result;
        let reason = diagnostic?.error;
        if (!reason && invokeError && "context" in invokeError) {
          try { diagnostic = await (invokeError.context as Response).json(); reason = diagnostic?.error; } catch { /* non-JSON upstream response */ }
        }
        const phase = diagnostic?.phase === "pdf" ? "PDF-Erstellung" : diagnostic?.phase === "smtp" ? "E-Mail-Server" : diagnostic?.phase === "documentation" ? "CRM-Dokumentation" : "";
        const code = diagnostic?.code && diagnostic.code !== "UNKNOWN" ? " (" + diagnostic.code + ")" : "";
        throw Error([reason || "Versand konnte nicht bestätigt werden. Bitte vor erneutem Senden die Kundenhistorie prüfen.", phase && "Schritt: " + phase + code, diagnostic?.detail].filter(Boolean).join(" "));
      }
      setSuccess(true);
      if (!result.logged || !result.statusUpdated) setLoggingWarning("E-Mail wurde vom Versandserver angenommen, aber die CRM-Dokumentation konnte nicht vollständig abgeschlossen werden. Bitte Kundenhistorie prüfen.");
      try { await onSent(); } catch { setLoggingWarning("E-Mail an Versandserver übergeben; aktuelle CRM-Daten konnten noch nicht neu geladen werden."); }
    } catch (err) { setError(err instanceof Error ? err.message : "Versand nicht möglich."); }
    finally { setSending(false); }
  }
  return <Modal title={"Angebot " + offer.number + " per E-Mail versenden"} onClose={onClose}>
    <div className="form-grid">
      <Field label="Absender"><input value="kontakt@nexaro-solutions.de" disabled /></Field>
      <Field label="Empfänger *"><input type="email" autoComplete="email" value={to} onChange={e=>setTo(e.target.value)} maxLength={254} disabled={sending || success} /></Field>
    </div>
    <div className="form-grid">
      <Field label="Anrede"><select value={salutation} disabled={sending || success} onChange={e=>setSalutation(e.target.value as "neutral" | "herr" | "frau")}><option value="neutral">Neutral · Guten Tag</option><option value="herr">Herr</option><option value="frau">Frau</option></select></Field>
      <Field label="Nachname für die Anrede"><input value={recipientName} onChange={e=>setRecipientName(e.target.value)} maxLength={160} disabled={sending || success || salutation === "neutral"} placeholder="Nachname" /></Field>
    </div>
    <p className="hint"><Mail size={15}/> Betreff: Ihr Angebot {offer.number} | neXaro Solutions</p>
    <p className="hint" role="status">Anrede in der E-Mail: <strong>{greeting}</strong></p>
    <Field label="Persönliche Nachricht (nach der Anrede)"><textarea rows={6} maxLength={3000} value={message} onChange={e=>setMessage(e.target.value)} disabled={sending || success}/></Field>
    <p className="notice">Das gespeicherte Angebot wird als PDF automatisch angehängt. Ein Versand erfolgt nur nach Klick auf „Jetzt senden“. Die Übergabe an den Versandserver wird in der Kundenhistorie dokumentiert; der Empfang beim Kunden ist damit noch nicht bestätigt.</p>
    {!offer.customer_id && <p className="error">Bitte zuerst einen Kunden zum Angebot speichern.</p>}
    {demo && <p className="notice">Demo-Modus: E-Mails werden nicht versendet.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {success && <p className="notice" role="status">E-Mail an Versandserver übergeben. Die Zustellung beim Empfänger ist noch nicht bestätigt.</p>}
    {loggingWarning && <p className="error" role="alert">{loggingWarning}</p>}
    <div className="button-row">
      <button type="button" className="secondary" onClick={onClose}>{success ? "Schließen" : "Abbrechen"}</button>
      <button type="button" className="primary" disabled={sending || success || demo || !offer.customer_id || !validEmail(to) || !message.trim() || (salutation !== "neutral" && !recipientName.trim())} onClick={()=>void send()}>
        <Send size={16}/>{sending ? "Wird gesendet …" : success ? "Übergeben" : "Jetzt senden"}
      </button>
    </div>
  </Modal>;
}
