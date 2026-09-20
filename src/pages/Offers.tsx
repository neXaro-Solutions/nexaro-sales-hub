import { useState } from "react";
import { EditableNumberInput } from "../components/EditableNumberInput";
import { Plus, Printer, Trash2, FileText, Receipt, ArrowRight } from "lucide-react";
import { InvoiceForm, DocumentPreview, customerSnapshot } from "../components/BusinessDocuments";
import { useStore } from "../lib/store";
import { VapeOfferPicker } from "../components/VapeOfferPicker";
import { SumupOfferComparison } from "../components/SumupOfferComparison";
import {
  Card,
  Empty,
  DivisionBadge,
  Modal,
  AsyncForm,
  Field,
  value,
} from "../components/UI";
import {
  today,
  offerTotals,
  money,
  dateLabel,
} from "../lib/calculations";
import type { Offer, OfferLine, Division, Invoice } from "../lib/types";
export type OfferDraft = {
  division: Division;
  customer_id?: string;
  lines?: OfferLine[];
  notes?: string;
  snapshot?: Record<string, unknown>;
};
export function OfferForm({
  offer,
  draft,
  onClose,
}: {
  offer?: Offer;
  draft?: OfferDraft;
  onClose: () => void;
}) {
  const { data, save } = useStore();
  const [division, setDivision] = useState<Division>(
    offer?.division || draft?.division || "sumup",
  );
  const [lines, setLines] = useState<OfferLine[]>(
    offer?.lines ||
      draft?.lines || [{ name: "", quantity: 1, price: 0, vat: 19 }],
  );
  const customers = data.customers;
  let total = { net: 0, gross: 0, vat: 0 };
  try {
    total = offerTotals(lines);
  } catch {
    /* native form validation blocks invalid submissions */
  }
  const update = (i: number, key: keyof OfferLine, v: string | number) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [key]: v } : l)));
  return (
    <Modal
      title={offer ? "Angebot bearbeiten" : "Angebot vorbereiten"}
      onClose={onClose}
    >
      <AsyncForm
        label="Angebot speichern"
        onSubmit={async (f) => {
          const customer_id = value(f, "customer_id");
          const c = data.customers.find((c) => c.id === customer_id);
          offerTotals(lines);
          if (!c)
            throw Error(
              "Bitte zuerst einen Kunden im gewählten Bereich anlegen.",
            );
          if (!data.opportunities.some((o) => o.customer_id === customer_id && o.division === division)) {
            await save("opportunities", { customer_id, division, stage: "Neu", potential: 0, details: {} });
          }
          await save("offers", {
            ...offer,
            division,
            customer_id,
            status: value(f, "status") as Offer["status"],
            valid_until: value(f, "valid_until"),
            lines,
            notes: value(f, "notes"),
            snapshot: offer?.snapshot || {
              ...draft?.snapshot,
              customer: {
                company: c.company,
                contact: c.contact,
                address: customerSnapshot(c).address,
                email: c.email,
              },
            },
          });
          onClose();
        }}
      >
        <div className="form-grid">
          <Field label="Vertriebsbereich">
            <select
              value={division}
              disabled={!!offer || !!draft}
              onChange={(e) => setDivision(e.target.value as Division)}
            >
              <option value="sumup">SumUp</option>
              <option value="vape">Vapes & Trendartikel</option>
            </select>
          </Field>
          <Field label="Kunde *">
            <select
              name="customer_id"
              required
              defaultValue={offer?.customer_id || draft?.customer_id || ""}
              disabled={!!offer}
            >
              <option value="">Kunde auswählen</option>
              {customers.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.company}
                </option>
              ))}
            </select>
            {offer && (
              <input
                name="customer_id"
                type="hidden"
                value={offer.customer_id}
              />
            )}
          </Field>
          <Field label="Gültig bis *">
            <input
              type="date"
              required
              name="valid_until"
              defaultValue={
                offer?.valid_until ||
                new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
              }
            />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={offer?.status || "Entwurf"}>
              {["Entwurf", "Gesendet", "Angenommen", "Abgelehnt"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        {division === "vape" && <VapeOfferPicker onAdd={line => setLines(current => {
          const blank = current.length === 1 && !current[0].name.trim() && current[0].price === 0;
          const next = blank ? [line] : [...current, line];
          return next.length > 100 ? current : next;
        })} />}
        {division === "sumup" && <SumupOfferComparison
          snapshot={offer?.snapshot || draft?.snapshot} compact />}
        <p className="muted">Positionspreise netto. SumUp-Zahlungsgebühren erscheinen beim Vergleich separat
          und werden nicht als Rechnungspositionen von neXaro berechnet.</p>
        {lines.map((l, i) => (
          <div className="offer-line" key={i}>
            <Field label="Bezeichnung *">
              <input
                required
                maxLength={300}
                value={l.name}
                onChange={(e) => update(i, "name", e.target.value)}
              />
            </Field>
            <Field label="Menge">
              <EditableNumberInput
                type="number"
                required
                min="1"
                max="1000000"
                step="1"
                value={l.quantity}
                onChange={(e) => update(i, "quantity", Number(e.target.value))}
              />
            </Field>
            <Field label="Netto (€)">
              <EditableNumberInput
                type="number"
                required
                min="0"
                max="1000000000"
                step="0.01"
                value={l.price}
                onChange={(e) => update(i, "price", Number(e.target.value))}
              />
            </Field>
            <Field label="MwSt. %">
              <EditableNumberInput
                type="number"
                required
                min="0"
                max="100"
                step="0.01"
                value={l.vat}
                onChange={(e) => update(i, "vat", Number(e.target.value))}
              />
            </Field>
            <button
              type="button"
              disabled={lines.length === 1}
              className="icon-button"
              aria-label={"Position " + (i + 1) + " entfernen"}
              onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-button"
          disabled={lines.length >= 100}
          onClick={() =>
            setLines((ls) => [
              ...ls,
              { name: "", quantity: 1, price: 0, vat: 19 },
            ])
          }
        >
          <Plus size={16} /> Position hinzufügen
        </button>
        <div className="total-strip">
          <span>
            Netto <b>{money(total.net)}</b>
          </span>
          <span>
            MwSt. <b>{money(total.vat)}</b>
          </span>
          <span>
            Gesamt <b>{money(total.gross)}</b>
          </span>
        </div>
        <Field label="Beratungsnotiz / Angebotsbedingungen">
          <textarea
            maxLength={5000}
            name="notes"
            defaultValue={offer?.notes || draft?.notes || ""}
          />
        </Field>
      </AsyncForm>
    </Modal>
  );
}
export function Offers() {
  const { data } = useStore();
  const [edit, setEdit] = useState<Offer | true | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<{invoice?: Invoice; offer?: Offer} | null>(null);
  const [print, setPrint] = useState<Offer | Invoice | null>(null);
  const [tab, setTab] = useState<"offers" | "invoices">("offers");
  return <>
    <div className="section-intro">
      <div><h1>Angebote & Rechnungen</h1><p>Individuell erstellen · automatisch nummerieren · als PDF ausgeben.</p></div>
      <div className="button-row">
        <button className="primary" onClick={() => { setTab("offers"); setEdit(true); }}><Plus size={17}/> Angebot erstellen</button>
        <button className="secondary" onClick={() => { setTab("invoices"); setInvoiceForm({}); }}><Receipt size={17}/> Rechnung erstellen</button>
      </div>
    </div>
    <div className="button-row document-tabs">
      <button className={tab === "offers" ? "primary" : "secondary"} onClick={() => setTab("offers")}>Angebote ({data.offers.length})</button>
      <button className={tab === "invoices" ? "primary" : "secondary"} onClick={() => setTab("invoices")}>Rechnungen ({data.invoices.length})</button>
    </div>
    <Card>
      {tab === "offers" ? data.offers.length ? <div className="table-wrap"><table>
        <thead><tr><th>Angebot</th><th>Kunde</th><th>Bereich</th><th>Netto</th><th>Status</th><th>Aktionen</th></tr></thead>
        <tbody>{[...data.offers].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map((o)=><tr key={o.id}>
          <td><button className="customer-link" onClick={() => setEdit(o)}>{o.number}</button><small>Gültig bis {dateLabel(o.valid_until)}</small></td>
          <td>{data.customers.find((c)=>c.id===o.customer_id)?.company || String((o.snapshot.customer as {company?: string}|undefined)?.company || "")}</td>
          <td><DivisionBadge division={o.division}/></td><td>{money(o.net)}</td><td>{o.status}</td>
          <td><div className="button-row">
            <button className="secondary" aria-label={o.number+" PDF ansehen"} onClick={()=>setPrint(o)}><Printer size={16}/> PDF</button>
            <button className="secondary" aria-label={o.number+" in Rechnung umwandeln"} onClick={()=>{setInvoiceForm({offer:o});setTab("invoices");}}><ArrowRight size={16}/> Rechnung</button>
          </div></td>
        </tr>)}</tbody>
      </table></div> : <Empty title="Noch keine Angebote">Erstelle dein erstes Angebot manuell oder über den SumUp-Vergleich.</Empty>
      : data.invoices.length ? <div className="table-wrap"><table>
        <thead><tr><th>Rechnung</th><th>Kunde</th><th>Rechnungsdatum</th><th>Brutto</th><th>Status</th><th>Aktionen</th></tr></thead>
        <tbody>{[...data.invoices].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map((i)=><tr key={i.id}>
          <td>{i.status==="Entwurf" ? <button className="customer-link" onClick={()=>setInvoiceForm({invoice:i})}>{i.number}</button> : <strong>{i.number}</strong>}<small>Fällig {dateLabel(i.due_date)}</small></td>
          <td>{data.customers.find((c)=>c.id===i.customer_id)?.company || String((i.snapshot.customer as {company?: string}|undefined)?.company || "")}</td>
          <td>{dateLabel(i.issue_date)}</td><td>{money(i.gross)}</td><td>{i.status}</td>
          <td><button className="secondary" aria-label={i.number+" PDF ansehen"} onClick={()=>setPrint(i)}><Printer size={16}/> PDF</button></td>
        </tr>)}</tbody>
      </table></div> : <Empty title="Noch keine Rechnungen">Erstelle eine Rechnung frei oder wandle ein bestehendes Angebot um.</Empty>}
    </Card>
    {edit && <OfferForm offer={edit===true?undefined:edit} onClose={()=>setEdit(null)}/>}
    {invoiceForm && <InvoiceForm invoice={invoiceForm.invoice} offer={invoiceForm.offer}
      onClose={()=>setInvoiceForm(null)} onSaved={(invoice)=>{setTab("invoices");setPrint(invoice);}}/>}
    {print && <DocumentPreview document={print} onClose={()=>setPrint(null)}/>}
  </>;
}
