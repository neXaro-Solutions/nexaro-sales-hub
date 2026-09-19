import { useState } from "react";
import { Plus, Printer, Trash2, FileText } from "lucide-react";
import { useStore } from "../lib/store";
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
  address,
} from "../lib/calculations";
import type { Offer, OfferLine, Division } from "../lib/types";
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
  const customers = data.customers.filter((c) =>
    data.opportunities.some(
      (o) => o.customer_id === c.id && o.division === division,
    ),
  );
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
                address: address(c),
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
        <p className="muted">
          Positionspreise netto. Gebührenvergleiche gehören in die
          Beratungsnotiz.
        </p>
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
              <input
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
              <input
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
              <input
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
  const [edit, setEdit] = useState<Offer | true | null>(null),
    [print, setPrint] = useState<Offer | null>(null);
  const customer = print
    ? data.customers.find((c) => c.id === print.customer_id)
    : null;
  const snapshot = print?.snapshot.customer as
    | { company?: string; contact?: string; address?: string; email?: string }
    | undefined;
  return (
    <>
      <div className="section-intro">
        <div>
          <h1>Angebote</h1>
          <p>Sauber kalkuliert. Kundengerecht aufbereitet.</p>
        </div>
        <button className="primary" onClick={() => setEdit(true)}>
          <Plus size={17} /> Neues Angebot
        </button>
      </div>
      <Card>
        {data.offers.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Angebot</th>
                  <th>Kunde</th>
                  <th>Bereich</th>
                  <th>Netto</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...data.offers]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((o) => (
                    <tr key={o.id}>
                      <td>
                        <button
                          className="customer-link"
                          onClick={() => setEdit(o)}
                        >
                          {o.number}
                        </button>
                        <small>Gültig bis {dateLabel(o.valid_until)}</small>
                      </td>
                      <td>
                        {
                          data.customers.find((c) => c.id === o.customer_id)
                            ?.company
                        }
                      </td>
                      <td>
                        <DivisionBadge division={o.division} />
                      </td>
                      <td>{money(o.net)}</td>
                      <td>{o.status}</td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={o.number + " Druckansicht"}
                          onClick={() => setPrint(o)}
                        >
                          <Printer size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Dein erstes Angebot">
            Übernimm eine SumUp-Lösung oder ausgewählte Katalogprodukte in ein
            Angebot.
          </Empty>
        )}
      </Card>
      {edit && (
        <OfferForm
          offer={edit === true ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}{" "}
      {print && (
        <Modal title="Angebotsvorschau" onClose={() => setPrint(null)}>
          <div className="print-sheet">
            <div className="print-header">
              <b>
                ne<span>X</span>aro Solutions
              </b>
              <span>Vertrieb · Payment · Trendprodukte</span>
            </div>
            <p>
              {snapshot?.company || customer?.company}
              <br />
              {snapshot?.contact || customer?.contact}
              <br />
              {snapshot?.address || (customer ? address(customer) : "")}
            </p>
            <h1>Angebot {print.number}</h1>
            <p>
              Datum: {dateLabel(print.created_at)} · Gültig bis:{" "}
              {dateLabel(print.valid_until)}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Menge</th>
                  <th>Einzel netto</th>
                  <th>Gesamt netto</th>
                </tr>
              </thead>
              <tbody>
                {print.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.name}</td>
                    <td>{l.quantity}</td>
                    <td>{money(l.price)}</td>
                    <td>{money(l.quantity * l.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="print-totals">
              <p>
                Netto <b>{money(print.net)}</b>
              </p>
              <p>
                MwSt. <b>{money(print.gross - print.net)}</b>
              </p>
              <p>
                Gesamtbetrag <b>{money(print.gross)}</b>
              </p>
            </div>
            <p className="prewrap">{print.notes}</p>
            <footer>
              neXaro Solutions · Kirchstraße 1A · 15757 Halbe
              <br />
              kontakt@nexaro-solutions.de · 0171 9098 831 ·
              www.nexaro-solutions.de
            </footer>
          </div>
          <div className="no-print form-actions">
            <button className="primary" onClick={() => window.print()}>
              <Printer size={16} /> Drucken / PDF speichern
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
