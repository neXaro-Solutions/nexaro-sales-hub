import { EditableNumberInput } from "./EditableNumberInput";
import { useState } from "react";
import { Plus, Printer, Trash2 } from "lucide-react";
import { AsyncForm, Field, Modal } from "../components/UI";
import { useStore } from "../lib/store";
import { seller, invoiceTerms } from "../lib/branding";
import { address, dateLabel, money, offerTotals, today } from "../lib/calculations";
import type { Customer, Invoice, Offer, OfferLine, Division } from "../lib/types";

export function customerSnapshot(c: Customer) {
  return { company: c.company, contact: c.contact, address: address(c), email: c.email };
}
const plusDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
export function InvoiceForm({
  invoice, offer, onClose, onSaved,
}: {
  invoice?: Invoice;
  offer?: Offer;
  onClose: () => void;
  onSaved: (invoice: Invoice) => void;
}) {
  const { data, save } = useStore();
  const [division, setDivision] = useState<Division>(invoice?.division || offer?.division || "sumup");
  const [lines, setLines] = useState<OfferLine[]>(invoice?.lines || offer?.lines || [{ name: "", quantity: 1, price: 0, vat: 19 }]);
  const [customerId, setCustomerId] = useState(invoice?.customer_id || offer?.customer_id || "");
  const [issueDate, setIssueDate] = useState(invoice?.issue_date || today());
  const [serviceDate, setServiceDate] = useState(invoice?.service_date || today());
  const [dueDate, setDueDate] = useState(invoice?.due_date || plusDays(14));
  let total = { net: 0, vat: 0, gross: 0 };
  try { total = offerTotals(lines); } catch { /* show validation after submit */ }
  const update = (i: number, key: keyof OfferLine, v: string | number) =>
    setLines((ls) => ls.map((l, j) => i === j ? { ...l, [key]: v } : l));
  return (
    <Modal title={invoice ? "Rechnungsentwurf bearbeiten" : offer ? "Angebot in Rechnung übernehmen" : "Rechnung manuell erstellen"} onClose={onClose}>
      <AsyncForm label={invoice ? "Rechnung speichern" : "Rechnung mit Nummer anlegen"} onSubmit={async (f) => {
        const customer = data.customers.find((c) => c.id === customerId);
        if (!customer) throw Error("Bitte eine Kundenakte auswählen.");
        offerTotals(lines);
        if (dueDate < issueDate) throw Error("Fälligkeitsdatum darf nicht vor dem Rechnungsdatum liegen.");
        const customerData = invoice?.snapshot.customer || offer?.snapshot.customer || customerSnapshot(customer);
        const saved = await save("invoices", {
          ...invoice,
          customer_id: customerId,
          offer_id: invoice?.offer_id || offer?.id || null,
          division,
          status: (String(f.get("status") || "Entwurf")) as Invoice["status"],
          issue_date: issueDate,
          service_date: serviceDate,
          due_date: dueDate,
          lines,
          notes: String(f.get("notes") || "").trim(),
          snapshot: invoice?.snapshot || { customer: customerData, seller: { ...seller } },
        });
        onSaved(saved);
        onClose();
      }}>
        <p className="hint">Alle Positionen werden netto erfasst. 19 % MwSt. sind vorbelegt. Die Rechnungsnummer wird beim ersten Speichern vom Server vergeben.</p>
        <div className="form-grid">
          <Field label="Vertriebsbereich"><select value={division} disabled={!!offer || !!invoice} onChange={(e) => setDivision(e.target.value as Division)}>
            <option value="sumup">SumUp</option><option value="vape">Vapes & Trendartikel</option>
          </select></Field>
          <Field label="Kunde *"><select required value={customerId} disabled={!!offer || !!invoice} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Kundenakte auswählen</option>
            {data.customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select></Field>
          <Field label="Rechnungsdatum *"><input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
          <Field label="Leistungs-/Lieferdatum *"><input type="date" required value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} /></Field>
          <Field label="Zahlbar bis *"><input type="date" required min={issueDate} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Field label="Status"><select name="status" defaultValue={invoice?.status || "Entwurf"}>
            {["Entwurf", "Offen", "Bezahlt", "Storniert"].map((s) => <option key={s}>{s}</option>)}
          </select></Field>
        </div>
        {lines.map((l, i) => <div className="offer-line" key={i}>
          <Field label="Position *"><input required maxLength={300} value={l.name} onChange={(e) => update(i, "name", e.target.value)} /></Field>
          <Field label="Menge"><EditableNumberInput required min="1" max="1000000" step="1" value={l.quantity} onChange={(e) => update(i, "quantity", Number(e.target.value))} /></Field>
          <Field label="Einzelpreis netto (€)"><EditableNumberInput required min="0" max="1000000000" step=".01" value={l.price} onChange={(e) => update(i, "price", Number(e.target.value))} /></Field>
          <Field label="MwSt. (%)"><select value={l.vat} onChange={(e) => update(i, "vat", Number(e.target.value))}><option value={19}>19 %</option><option value={7}>7 %</option><option value={0}>0 %</option></select></Field>
          <button type="button" className="icon-button" aria-label={`Position ${i+1} entfernen`} disabled={lines.length === 1} onClick={() => setLines((v) => v.filter((_, j) => j !== i))}><Trash2 size={16}/></button>
        </div>)}
        <button type="button" className="text-button" disabled={lines.length >= 100} onClick={() => setLines((v) => [...v, { name: "", quantity: 1, price: 0, vat: 19 }])}><Plus size={16}/> Position hinzufügen</button>
        <div className="total-strip"><span>Netto <b>{money(total.net)}</b></span><span>MwSt. <b>{money(total.vat)}</b></span><span>Gesamt <b>{money(total.gross)}</b></span></div>
        <Field label="Zusätzliche Hinweise"><textarea name="notes" maxLength={5000} defaultValue={invoice?.notes || offer?.notes || invoiceTerms} rows={4}/></Field>
      </AsyncForm>
    </Modal>
  );
}

type Party = {company?: string; contact?: string; address?: string; email?: string};
export function DocumentPreview({ document, onClose }: { document: Offer | Invoice; onClose: () => void }) {
  const { data } = useStore();
  const invoice = "issue_date" in document;
  const customer = data.customers.find((c) => c.id === document.customer_id);
  const saved = document.snapshot.customer as Party | undefined;
  const recipient: Party = saved || (customer ? customerSnapshot(customer) : {});
  const issuer = (document.snapshot.seller as typeof seller | undefined) || seller;
  const vatGroups = [...new Set(document.lines.map((l) => l.vat))].sort((a,b) => b-a);
  return <Modal title={invoice ? "Rechnung · PDF-Vorschau" : "Angebot · PDF-Vorschau"} onClose={onClose}>
    <div className="print-sheet nx-document">
      <div className="nx-document-band" />
      <div className="nx-document-top">
        <div className="nx-document-brand">ne<span>X</span>aro <small>Solutions</small></div>
        <div className="nx-document-topright">PEOPLE · PAYMENT · PRODUCTS<br/><b>{issuer.name}</b></div>
      </div>
      <div className="nx-document-address">
        <div><small>{issuer.name} · {issuer.street} · {issuer.city}</small>
          <p className="nx-recipient"><strong>{recipient.company || "Kunde"}</strong><br/>{recipient.contact && <>{recipient.contact}<br/></>}{recipient.address}</p>
        </div>
        <div className="nx-document-label"><small>GESCHÄFTSDOKUMENT</small><h1>{invoice ? "RECHNUNG" : "ANGEBOT"}</h1><b>{document.number}</b></div>
      </div>
      <div className="nx-document-meta">
        <div><span>{invoice ? "Rechnungsdatum" : "Angebotsdatum"}</span><strong>{dateLabel(invoice ? document.issue_date : document.created_at)}</strong></div>
        <div><span>{invoice ? "Leistungsdatum" : "Gültig bis"}</span><strong>{dateLabel(invoice ? document.service_date : document.valid_until)}</strong></div>
        {invoice && <div><span>Zahlbar bis</span><strong>{dateLabel(document.due_date)}</strong></div>}
        <div><span>Status</span><strong>{document.status}</strong></div>
      </div>
      <h2 className="nx-document-greeting">{invoice ? "Vielen Dank für Ihren Auftrag." : "Vielen Dank für Ihr Interesse."}</h2>
      <p className="nx-document-subtitle">{invoice ? "Wir berechnen Ihnen folgende Leistungen und Produkte:" : "Gerne bieten wir Ihnen die folgenden Leistungen und Produkte an:"}</p>
      <table className="nx-document-table"><thead><tr><th>Pos.</th><th>Beschreibung</th><th>Menge</th><th>Einzel netto</th><th>Gesamt netto</th></tr></thead>
        <tbody>{document.lines.map((l,i)=><tr key={i}><td>{String(i+1).padStart(2,"0")}</td><td><strong>{l.name}</strong><small>{l.vat} % MwSt.</small></td><td>{l.quantity}</td><td>{money(l.price)}</td><td>{money(Math.round(l.quantity*l.price*100)/100)}</td></tr>)}</tbody>
      </table>
      <div className="nx-document-summary">
        <div><span>Zwischensumme netto</span><b>{money(document.net)}</b></div>
        {vatGroups.map((rate) => <div key={rate}><span>Umsatzsteuer {rate} %</span><b>{money(document.lines.filter((l)=>l.vat===rate).reduce((sum,l)=>{const net=Math.round(l.quantity*l.price*100)/100;return sum+Math.round(net*rate)/100;},0))}</b></div>)}
        <div className="nx-document-grand"><span>Gesamtbetrag</span><strong>{money(document.gross)}</strong></div>
      </div>
      {invoice && <div className="nx-document-payment"><b>Zahlungsinformationen</b><p>{invoiceTerms}<br/>Bank: {issuer.bank} · IBAN: {issuer.iban}<br/>Verwendungszweck: {document.number}</p></div>}
      {document.notes && <div className="nx-document-notes"><b>Hinweise</b><p className="prewrap">{document.notes}</p></div>}
      <footer className="nx-document-footer">
        <div><b>{issuer.name}</b><br/>{issuer.owner}<br/>{issuer.street}<br/>{issuer.city}</div>
        <div><b>Kontakt</b><br/>{issuer.email}<br/>{issuer.web}</div>
        <div><b>Steuerangaben</b><br/>USt.-ID: {issuer.vatId}<br/>Steuer-Nr.: {issuer.taxNumber}<br/>{issuer.taxOffice}</div>
        <div><b>Bankverbindung</b><br/>{issuer.bank}<br/>IBAN: {issuer.iban}</div>
      </footer>
    </div>
    <div className="no-print form-actions"><button className="primary" onClick={() => window.print()}><Printer size={16}/> Drucken / als PDF speichern</button><p className="hint">Im Druckdialog „Als PDF sichern“ wählen. Bitte Anschrift, Steuersatz und Leistungsdatum vor dem Versand prüfen.</p></div>
  </Modal>;
}
