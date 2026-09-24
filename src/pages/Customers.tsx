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
import type { Task } from "../lib/types";
import { Documents } from "../components/Documents";
import { CustomerContactPermission } from "../components/ContactCompliance";
import { appointmentLabel } from "../lib/appointments";
export function Customers({ division }: { division?: Division }) {
  const { data, save, refresh, demo } = useStore();
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [edit, setEdit] = useState<Customer | true | null>(null),
    [task, setTask] = useState<Task | true | null>(null),
    [error, setError] = useState("");
  const customer = data.customers.find((c) => c.id === selected);
  const rows = data.customers.filter(c =>
    [c.company,c.contact,c.city,c.zip,c.street].join(" ").toLowerCase()
      .includes(search.toLowerCase().trim())
  );
  return (
    <>
      <div className="section-intro">
        <div>
          <h1>
            {division === "vape"
              ? "Händlerkontakte"
              : division
                ? "Händler & Leads"
                : "Alle Kunden & Leads"}
          </h1>
          <p>
            Einmal zentral anlegen – SumUp und Vape greifen auf denselben Kunden, dieselben Notizen und Dokumente zu.
          </p>
        </div>
        <button className="primary" onClick={() => setEdit(true)}>
          <Plus size={17} /> Neuer Kunde
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
          <Badge>{rows.length} Standorte</Badge>
        </div>
        {rows.length ? (
          <div className="table-wrap nx-customers-table">
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
                                <small className="inline">
                                  {o.division === "vape"
                                    ? "Vape"
                                    : o.stage}
                                </small>
                              </span>
                            ))}
                        </div>
                      </td>
                      <td>
                        {next ? (
                          <>
                            <span>{next.title}</span>
                            <small>{appointmentLabel(next.due_at)}</small>
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
          <div className="nx-customer-mobile-list">
            {rows.map(c=>{
              const next=data.tasks.filter(t=>t.customer_id===c.id&&!t.done).sort((a,b)=>a.due_at.localeCompare(b.due_at))[0];
              return <article className="nx-customer-mobile-card" key={c.id}>
                <button className="nx-customer-mobile-title" onClick={()=>setSelected(c.id)}>{c.company} <ArrowUpRight size={17}/></button>
                <small>{c.contact||c.industry||"Kontakt ergänzen"}</small>
                <p><MapPin size={15}/> {[c.zip,c.city].filter(Boolean).join(" ")||"Standort ergänzen"}</p>
                <div className="nx-customer-mobile-divisions">{data.opportunities.filter(o=>o.customer_id===c.id).map(o=>
                  <span key={o.id}><DivisionBadge division={o.division}/> <small>{o.stage}</small></span>
                )}</div>
                <p className="nx-customer-mobile-next">{next?"Nächster Schritt: "+next.title+" · "+appointmentLabel(next.due_at):"Noch keine Wiedervorlage"}</p>
                <button className="secondary" onClick={()=>setSelected(c.id)}>Kundenakte öffnen</button>
              </article>;
            })}
          </div>
        ) : (
          <Empty title="Dein nächster Standort wartet">
            Erfasse deinen ersten Lead oder übernimm einen Recherchetreffer.
          </Empty>
        )}
      </Card>
      {customer && (
        <Modal
          title={customer.company}
          onClose={() => {
            setSelected(null);
            setTask(null);
            setError("");
          }}
        >
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
            {customer.website && <p><a href={/^https?:\/\//i.test(customer.website)?customer.website:"https://"+customer.website} target="_blank" rel="noopener noreferrer">{customer.website} ↗</a></p>}
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
                  {d === "vape" ? (
                    opportunity ? (
                      <p>
                        Händlerkontakt · allgemeine Betreuung und Dokumentation.
                      </p>
                    ) : (
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            await save("opportunities", {
                              customer_id: customer.id,
                              division: "vape",
                              stage: "Neu",
                              potential: 0,
                              details: {},
                            });
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Vape-Verkaufschance anlegen
                      </button>
                    )
                  ) : opportunity ? (
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
              resetOnSuccess
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
          <CustomerContactPermission key={customer.id} customer={customer} demo={demo}/>
          <h3>Kundenhistorie</h3>
          {data.events
            .filter(
              (e) =>
                e.customer_id === customer.id &&
                (!division || !e.division || e.division === division),
            )
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((e) => (
              <div className="history" key={e.id}>
                <small>
                  {dateLabel(e.created_at)} · {e.kind}
                </small>
                <p>{e.description}</p>
              </div>
            ))}
          <h3>Termine & Wiedervorlagen</h3>
          {data.tasks
            .filter(
              (t) =>
                t.customer_id === customer.id &&
                !t.done &&
                (!division || !t.division || t.division === division),
            )
            .sort((a, b) => a.due_at.localeCompare(b.due_at))
            .map((t) => (
              <div className="history" key={t.id}>
                <strong>{t.title}</strong>
                <small>
                  {appointmentLabel(t.due_at)} · {t.kind || "Aufgabe"}
                </small>
                {t.notes && <p className="prewrap">{t.notes}</p>}
                <button
                  className="text-button"
                  onClick={() => setTask(t)}
                  aria-label={t.title + " bearbeiten"}
                >
                  Bearbeiten
                </button>
              </div>
            ))}
          <h3>Angebote & Rechnungen</h3>
          {data.offers.filter((o) => o.customer_id === customer.id &&
            (!division || o.division === division)).map((o) => (
            <p key={o.id}>Angebot {o.number} · {o.status} · {money(o.gross)} brutto</p>
          ))}
          {data.invoices.filter((i) => i.customer_id === customer.id &&
            (!division || i.division === division)).map((i) => (
            <p key={i.id}>Rechnung {i.number} · {i.status} · {money(i.gross)} brutto</p>
          ))}
          <Documents key={customer.id} customerId={customer.id} />

        </Modal>
      )}
      {edit && (
        <CustomerForm
          division={division}
          customer={edit === true ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}{" "}
      {task && customer && (
        <TaskForm
          task={task === true ? undefined : task}
          customerId={customer.id}
          division={division}
          onClose={() => setTask(null)}
        />
      )}
    </>
  );
}
