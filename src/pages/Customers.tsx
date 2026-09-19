import { useState } from "react";
import {
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  ArrowUpRight,
  Pencil,
} from "lucide-react";
import { useStore } from "../lib/store";
import {
  Card,
  Empty,
  DivisionBadge,
  Modal,
  AsyncForm,
  Field,
  value,
  Badge,
  External,
} from "../components/UI";
import { CustomerForm, TaskForm } from "../components/Forms";
import { address, dateLabel, mapSearch, money } from "../lib/calculations";
import { stages, type Customer, type Division, type Stage } from "../lib/types";
export function Customers({ division }: { division?: Division }) {
  const { data, save, refresh } = useStore();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<string | null>(null),
    [edit, setEdit] = useState<Customer | true | null>(null),
    [task, setTask] = useState(false),
    [error, setError] = useState("");
  const customer = data.customers.find((c) => c.id === selected);
  const rows = data.customers.filter(
    (c) =>
      (!division ||
        data.opportunities.some(
          (o) => o.customer_id === c.id && o.division === division,
        )) &&
      [c.company, c.contact, c.city, c.zip]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        data.opportunities.some(
          (o) => o.customer_id === c.id && o.division === filter,
        )),
  );
  return (
    <>
      <div className="section-intro">
        <div>
          <h1>{division ? "Händler & Leads" : "Deine Standorte"}</h1>
          <p>Eine Kundenakte. Alle Kontakte, Chancen und nächsten Schritte.</p>
        </div>
        <button className="primary" onClick={() => setEdit(true)}>
          <Plus size={17} /> Neuer Standort
        </button>
      </div>
      <Card>
        <div className="toolbar">
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Kunden suchen"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Unternehmen, Kontakt oder Ort suchen …"
            />
          </div>
          {!division && (
            <select
              aria-label="Bereich filtern"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Alle Bereiche</option>
              <option value="sumup">SumUp</option>
              <option value="vape">Vapes</option>
            </select>
          )}
          <Badge>{rows.length} Standorte</Badge>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Unternehmen / Kontakt</th>
                  <th>Standort</th>
                  <th>Bereich & Status</th>
                  <th>Nächster Schritt</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const next = data.tasks
                    .filter((t) => t.customer_id === c.id && !t.done)
                    .sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
                  return (
                    <tr key={c.id}>
                      <td>
                        <button
                          className="customer-link"
                          onClick={() => setSelected(c.id)}
                        >
                          {c.company}
                        </button>
                        <small>
                          {c.contact || c.industry || "Kontakt ergänzen"}
                        </small>
                      </td>
                      <td>
                        {c.city}
                        <small>{c.zip}</small>
                      </td>
                      <td>
                        <div className="stack">
                          {data.opportunities
                            .filter(
                              (o) =>
                                o.customer_id === c.id &&
                                (!division || o.division === division),
                            )
                            .map((o) => (
                              <span key={o.id}>
                                <DivisionBadge division={o.division} />{" "}
                                <small className="inline">{o.stage}</small>
                              </span>
                            ))}
                        </div>
                      </td>
                      <td>
                        {next ? (
                          <>
                            <span>{next.title}</span>
                            <small>{dateLabel(next.due_at)}</small>
                          </>
                        ) : (
                          <small>Noch keine Wiedervorlage</small>
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          onClick={() => setSelected(c.id)}
                          aria-label={c.company + " öffnen"}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Dein nächster Standort wartet">
            Erfasse deinen ersten Lead oder übernimm einen Recherchetreffer.
          </Empty>
        )}
      </Card>
      {customer && (
        <Modal title={customer.company} onClose={() => setSelected(null)}>
          <div className="customer-summary">
            <p>
              <MapPin size={16} /> {address(customer) || "Adresse ergänzen"}
            </p>
            {customer.phone && (
              <p>
                <Phone size={16} />{" "}
                <a href={"tel:" + customer.phone}>{customer.phone}</a>
              </p>
            )}
            {customer.email && (
              <p>
                <Mail size={16} />{" "}
                <a href={"mailto:" + customer.email}>{customer.email}</a>
              </p>
            )}
            <External
              href={mapSearch(customer.company + " " + address(customer))}
            >
              In Google Maps öffnen
            </External>
          </div>
          <div className="button-row">
            <button className="secondary" onClick={() => setEdit(customer)}>
              <Pencil size={16} /> Bearbeiten
            </button>
            <button className="secondary" onClick={() => setTask(true)}>
              <Plus size={16} /> Wiedervorlage
            </button>
          </div>
          <p className="prewrap">{customer.notes}</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {(["sumup", "vape"] as Division[])
            .filter((d) => !division || d === division)
            .map((d) => {
              const opportunity = data.opportunities.find(
                (o) => o.customer_id === customer.id && o.division === d,
              );
              return (
                <div className="detail-block" key={d}>
                  <DivisionBadge division={d} />
                  {opportunity ? (
                    <AsyncForm
                      label="Chance aktualisieren"
                      onSubmit={async (f) => {
                        await save("opportunities", {
                          ...opportunity,
                          stage: value(f, "stage") as Stage,
                          potential: Number(f.get("potential")),
                        });
                      }}
                    >
                      <div className="form-grid">
                        <Field label="Status">
                          <select name="stage" defaultValue={opportunity.stage}>
                            {stages.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label={
                            d === "sumup"
                              ? "Kartenvolumen / Monat (€)"
                              : "Nettoumsatzpotenzial / Monat (€)"
                          }
                        >
                          <input
                            name="potential"
                            type="number"
                            min="0"
                            max="1000000000"
                            step="0.01"
                            defaultValue={opportunity.potential}
                          />
                        </Field>
                      </div>
                    </AsyncForm>
                  ) : (
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          await save("opportunities", {
                            customer_id: customer.id,
                            division: d,
                            stage: "Neu",
                            potential: 0,
                            details: {},
                          });
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Verkaufschance anlegen
                    </button>
                  )}
                </div>
              );
            })}
          <div className="detail-block">
            <h3>Gespräch dokumentieren</h3>
            <AsyncForm
              label="Notiz speichern"
              onSubmit={async (f) => {
                await save("events", {
                  customer_id: customer.id,
                  division: division || null,
                  kind: "Gespräch",
                  description: value(f, "description"),
                });
                await refresh();
              }}
            >
              <Field label="Gesprächsnotiz">
                <textarea name="description" required maxLength={3000} />
              </Field>
            </AsyncForm>
          </div>
          <h3>Kundenhistorie</h3>
          {data.events
            .filter((e) => e.customer_id === customer.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((e) => (
              <div className="history" key={e.id}>
                <small>
                  {dateLabel(e.created_at)} · {e.kind}
                </small>
                <p>{e.description}</p>
              </div>
            ))}
          <h3>Angebote</h3>
          {data.offers
            .filter((o) => o.customer_id === customer.id)
            .map((o) => (
              <p key={o.id}>
                {o.number} · {o.status} · {money(o.net)} netto
              </p>
            ))}
        </Modal>
      )}
      {edit && (
        <CustomerForm
          customer={edit === true ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}{" "}
      {task && customer && (
        <TaskForm
          customerId={customer.id}
          division={division}
          onClose={() => setTask(false)}
        />
      )}
    </>
  );
}
