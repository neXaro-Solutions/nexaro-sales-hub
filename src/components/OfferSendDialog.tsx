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
  const [message, setMessage] = useState(
    "Guten Tag" + (customer?.contact ? " " + customer.contact : "") + ",\n\n" +
    "vielen Dank für Ihr Interesse. Anbei erhalten Sie unser Angebot " + offer.number +
    " als PDF. Bei Fragen stehe ich Ihnen gerne persönlich zur Verfügung."
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function send() {
    if (sending || success || demo || !offer.customer_id || !validEmail(to)) return;
    setSending(true); setError("");
    try {
      const { data: result, error: invokeError } = await client.functions.invoke("nx-send-offer", {
        body: { action: "send", offerId: offer.id, to: to.trim(), message: message.trim() }
      });
      if (invokeError || !result?.sent) {
        let reason = result?.error;
        if (!reason && invokeError && "context" in invokeError) {
          try { reason = (await (invokeError.context as Response).json()).error; } catch { /* non-JSON upstream response */ }
        }
        throw Error(reason || "Versand konnte nicht bestätigt werden. Bitte vor erneutem Senden die Kundenhistorie prüfen.");
      }
      setSuccess(true);
      await onSent();
    } catch (err) { setError(err instanceof Error ? err.message : "Versand nicht möglich."); }
    finally { setSending(false); }
  }
  return <Modal title={"Angebot " + offer.number + " per E-Mail versenden"} onClose={onClose}>
    <div className="form-grid">
      <Field label="Absender"><input value="kontakt@nexaro-solutions.de" disabled /></Field>
      <Field label="Empfänger *"><input type="email" autoComplete="email" value={to} onChange={e=>setTo(e.target.value)} maxLength={254} disabled={sending || success} /></Field>
    </div>
    <p className="hint"><Mail size={15}/> Betreff: Ihr Angebot {offer.number} | neXaro Solutions</p>
    <Field label="Persönliche Nachricht"><textarea rows={6} maxLength={3000} value={message} onChange={e=>setMessage(e.target.value)} disabled={sending || success}/></Field>
    <p className="notice">Das gespeicherte Angebot wird als PDF automatisch angehängt. Ein Versand erfolgt nur nach Klick auf „Jetzt senden“. Der Vorgang wird in der Kundenhistorie dokumentiert.</p>
    {!offer.customer_id && <p className="error">Bitte zuerst einen Kunden zum Angebot speichern.</p>}
    {demo && <p className="notice">Demo-Modus: E-Mails werden nicht versendet.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {success && <p className="notice" role="status">E-Mail vom Versandserver angenommen. Angebot wurde als gesendet markiert.</p>}
    <div className="button-row">
      <button type="button" className="secondary" onClick={onClose}>{success ? "Schließen" : "Abbrechen"}</button>
      <button type="button" className="primary" disabled={sending || success || demo || !offer.customer_id || !validEmail(to) || !message.trim()} onClick={()=>void send()}>
        <Send size={16}/>{sending ? "Wird gesendet …" : success ? "Versendet" : "Jetzt senden"}
      </button>
    </div>
  </Modal>;
}
