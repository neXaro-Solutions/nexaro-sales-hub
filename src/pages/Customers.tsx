import { useEffect, useState } from "react";
import { client } from "../lib/client";
import {
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  ArrowUpRight,
  Pencil,
  Trash2,
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
import { InboundStatementPanel } from "../components/InboundStatementPanel";
import { appointmentLabel } from "../lib/appointments";
type CustomerSegment = "inbound"|"lead"|"customer";
function feeRequestText(c:Customer,events:{customer_id:string|null;kind:string;description:string;created_at:string}[]){
 const entry=events.filter(e=>e.customer_id===c.id&&e.kind==="Formularanfrage"&&e.description.includes("SumUp Gebührencheck"))
  .sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
 return ["SumUp Gebührencheck","SumUp Angebotsanfrage"].includes(c.source) ? c.notes : entry?.description||"";
}
function feeFields(raw:string){
 const volume=raw.match(/Monatlicher Kartenumsatz laut Interessent:\s*([^\n]+)/)?.[1]?.trim()||"Nicht angegeben";
 const provider=raw.match(/Bisheriger Zahlungsanbieter:\s*([^\n]+)/)?.[1]?.trim()||"Nicht angegeben";
 const message=raw.split(/Bisheriger Zahlungsanbieter:[^\n]*\n/).slice(1).join("").trim();
 return {volume,provider,message:message||"Keine zusätzliche Nachricht"};
}
function segmentOf(c:Customer,tasks:Task[],events:{customer_id:string|null;kind:string;description:string}[],opportunities:{customer_id:string;stage:string}[]):CustomerSegment{
 const inbound=events.some(e=>e.customer_id===c.id&&e.kind==="Formularanfrage")||["SumUp Gebührencheck","SumUp Beratung","SumUp Angebotsanfrage","Kontaktformular"].includes(c.source);
 if(inbound&&tasks.some(t=>t.customer_id===c.id&&!t.done&&(/Gebührenvergleich|Neue Anfrage beantworten|Beratungsanfrage|Abrechnung prüfen/.test(t.title))))return "inbound";
 if(opportunities.some(o=>o.customer_id===c.id&&o.stage==="Gewonnen"))return "customer";
 return "lead";
}
const segmentLabels:Record<CustomerSegment,string>={inbound:"Neue Anfrage",lead:"Aktiver Lead",customer:"Bestandskunde"};
export function Customers({ division, onOpenSumup }: { division?: Division; onOpenSumup?:(customerId:string)=>void }) {
  const { data, save, refresh, listDocuments, demo } = useStore();
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [edit, setEdit] = useState<Customer | true | null>(null),
    [task, setTask] = useState<Task | true | null>(null),
    [error, setError] = useState("");
  const [withStatements,setWithStatements]=useState<Set<string>>(new Set());
  const [deleteCustomer,setDeleteCustomer]=useState<Customer|null>(null);
  const [deleteBusy,setDeleteBusy]=useState(false);
  const [deleteError,setDeleteError]=useState("");
  const [deleteNotice,setDeleteNotice]=useState("");
  const [linkedIntake,setLinkedIntake]=useState(false);
  const [linkedDocuments,setLinkedDocuments]=useState(false);
  const [checkingLinks,setCheckingLinks]=useState(false);
  async function requestCustomerDeletion(c:Customer){
    setDeleteError("");setLinkedIntake(false);setLinkedDocuments(false);setCheckingLinks(true);setDeleteCustomer(c);
    if(demo){try{setLinkedDocuments((await listDocuments(c.id)).length>0);}catch{setDeleteError("Dokumente konnten nicht geprüft werden.");}finally{setCheckingLinks(false);}return;}
    try{
      const [receipts,documents]=await Promise.all([client.rpc("nx_customer_has_intake",{p_customer:c.id}),listDocuments(c.id)]);
      if(receipts.error)throw Error("Verknüpfte Formularanfragen konnten nicht geprüft werden. Bitte erneut versuchen.");
      setLinkedIntake(!!receipts.data);
      setLinkedDocuments(documents.length>0);
    }catch(e){setDeleteError(e instanceof Error?e.message:"Verknüpfungen konnten nicht geprüft werden.");}
    finally{setCheckingLinks(false);}
  }
  const deleteLinks=deleteCustomer?{
    tasks:data.tasks.filter(t=>t.customer_id===deleteCustomer.id).length,
    events:data.events.filter(e=>e.customer_id===deleteCustomer.id).length,
    opportunities:data.opportunities.filter(o=>o.customer_id===deleteCustomer.id).length,
    offers:data.offers.filter(o=>o.customer_id===deleteCustomer.id).length,
    invoices:data.invoices.filter(i=>i.customer_id===deleteCustomer.id).length,
    statements:withStatements.has(deleteCustomer.id)
  }:null;

  useEffect(()=>{
    let active=true;
    if(demo)return()=>{active=false};
    void client.from("nx_inbound_statements").select("customer_id").limit(1000)
      .then(({data,error})=>{if(active&&!error)setWithStatements(new Set((data||[]).map(x=>String(x.customer_id))))});
    return()=>{active=false};
  },[data.customers.length,demo]);
  const customer = data.customers.find((c) => c.id === selected);
  const [segment,setSegment]=useState<"all"|CustomerSegment>("all");
  const sorted=[...data.customers].sort((a,b)=>{
    const rank=(c:Customer)=>({inbound:0,lead:1,customer:2})[segmentOf(c,data.tasks,data.events,data.opportunities)];
    return rank(a)-rank(b)||b.created_at.localeCompare(a.created_at);
  });
  const counts={all:data.customers.length,inbound:0,lead:0,customer:0};
  for(const c of data.customers)counts[segmentOf(c,data.tasks,data.events,data.opportunities)]++;
  const rows=sorted.filter(c=>(segment==="all"||segmentOf(c,data.tasks,data.events,data.opportunities)===segment)&&
    [c.company,c.contact,c.city,c.zip,c.street,c.source].join(" ").toLowerCase().includes(search.toLowerCase().trim())
  );
  const feeText=customer?feeRequestText(customer,data.events):"";
  const fee=feeFields(feeText);
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
          <Badge>{rows.length} Einträge</Badge>
        </div>
        <div className="nx-customer-segments" role="group" aria-label="Kunden und Anfragen filtern">
          {([["all","Alle",counts.all],["inbound","Neue Anfragen",counts.inbound],["lead","Aktive Leads",counts.lead],["customer","Bestandskunden",counts.customer]] as const).map(([id,label,count])=>
            <button key={id} type="button" className={segment===id?"active":""} aria-pressed={segment===id} onClick={()=>setSegment(id)}>{label} <span>{count}</span></button>
          )}
        </div>
        {rows.length ? (
          <>
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
                    <tr key={c.id} className={segmentOf(c,data.tasks,data.events,data.opportunities)==="inbound"?"nx-inbound-row":""}>
                      <td>
                        <button
                          className="customer-link"
                          onClick={() => setSelected(c.id)}
                        >
                          {c.company}
                        </button>
                        <small className="nx-customer-origin">{segmentLabels[segmentOf(c,data.tasks,data.events,data.opportunities)]}{feeRequestText(c,data.events)?" · SumUp-Gebührencheck":c.source==="Kontaktformular"?" · Kontaktformular":c.source==="SumUp Beratung"?" · SumUp-Beratung":c.source==="SumUp Angebotsanfrage"?" · Angebot mit Abrechnung":""}{withStatements.has(c.id)?" · ✓ Abrechnung vorhanden":""}</small>
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
              return <article className={"nx-customer-mobile-card"+(segmentOf(c,data.tasks,data.events,data.opportunities)==="inbound"?" nx-inbound-card":"")} key={c.id}>
                <span className="nx-customer-segment-badge">{segmentLabels[segmentOf(c,data.tasks,data.events,data.opportunities)]}{feeRequestText(c,data.events)?" · SumUp-Gebührencheck":c.source==="Kontaktformular"?" · Kontaktformular":""}</span>
                <button className="nx-customer-mobile-title" onClick={()=>setSelected(c.id)}>{c.company} <ArrowUpRight size={17}/></button>
                <small>{c.contact||c.industry||"Kontakt ergänzen"}</small>
                {segmentOf(c,data.tasks,data.events,data.opportunities)==="inbound"&&<small>Eingang: {new Date(c.created_at).toLocaleString("de-DE",{timeZone:"Europe/Berlin"})}</small>}
                <p><MapPin size={15}/> {[c.zip,c.city].filter(Boolean).join(" ")||"Standort ergänzen"}</p>
                <div className="nx-customer-mobile-divisions">{data.opportunities.filter(o=>o.customer_id===c.id).map(o=>
                  <span key={o.id}><DivisionBadge division={o.division}/> <small>{o.stage}</small></span>
                )}</div>
                <p className="nx-customer-mobile-next">{next?"Nächster Schritt: "+next.title+" · "+appointmentLabel(next.due_at):"Noch keine Wiedervorlage"}</p>
                <button className="secondary" onClick={()=>setSelected(c.id)}>Kundenakte öffnen</button>
                <button className="nx-delete-trigger" type="button" onClick={()=>void requestCustomerDeletion(c)}><Trash2 size={16}/> Eintrag löschen</button>

              </article>;
            })}
          </div>
          </>
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
          <div className="nx-customer-detail-head">
            <span className="nx-customer-segment-badge">{segmentLabels[segmentOf(customer,data.tasks,data.events,data.opportunities)]}</span>
            <span>Herkunft: {customer.source||"Nicht erfasst"}</span>
            <span>Erfasst: {new Date(customer.created_at).toLocaleString("de-DE",{timeZone:"Europe/Berlin"})}</span>
          </div>
          {feeText&&<section className="nx-fee-request" aria-label="Eingegangene SumUp-Gebührencheck-Anfrage">
            <span className="nx-fee-request-tag">NEUE SUMUP-ANFRAGE · GEBÜHRENCHECK</span>
            <h3>Angaben aus dem Anfrageformular</h3>
            <div className="nx-fee-request-grid">
              <div><small>Monatlicher Kartenumsatz (laut Interessent)</small><strong>{fee.volume}{fee.volume==="Nicht angegeben"?"":" €"}</strong></div>
              <div><small>Aktueller Zahlungsanbieter</small><strong>{fee.provider}</strong></div>
              <div><small>Kontaktwunsch</small><strong>Individueller Gebührenvergleich</strong></div>
            </div>
            <h4>Nachricht / Beratungswunsch</h4>
            <p className="prewrap">{fee.message}</p>
            <p className="hint">Formularangaben sind Selbstauskünfte, noch keine verifizierte Händlerabrechnung. Anfragebezogene Kontaktfreigabe ist von Werbeeinwilligung getrennt.</p>

          </section>}
          {(feeText||customer.source==="SumUp Beratung"||customer.source==="SumUp Angebotsanfrage")&&<InboundStatementPanel customerId={customer.id} demo={demo} onOpenSumup={onOpenSumup}/>}
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
            <button className="nx-delete-trigger" type="button" onClick={()=>void requestCustomerDeletion(customer)}>
              <Trash2 size={16}/> Kundenakte löschen
            </button>
          </div>
          {customer.notes&&!feeText&&<p className="prewrap">{customer.notes}</p>}
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
      {deleteNotice&&<p className="notice" role="status">{deleteNotice}</p>}
      {deleteCustomer&&<Modal title="Kundenakte und zugehörige Testeinträge löschen" onClose={()=>{if(!deleteBusy)setDeleteCustomer(null);}}>
        <div className="nx-customer-delete-confirm">
          <strong>„{deleteCustomer.company}“ einschließlich der zugehörigen CRM-Einträge endgültig löschen?</strong>
          <p>Die Kundenakte ist für SumUp und Vape gemeinsam. Die Löschung kann nicht rückgängig gemacht werden.</p>
          {checkingLinks?<p role="status">Verknüpfungen und private Dokumente werden geprüft …</p>:<>
            {deleteLinks&&<div className="nx-customer-delete-preview">
              <strong>Diese verbundenen Daten werden mitgelöscht:</strong>
              <ul>
                <li>Kundenakte und zugehörige Kontaktfreigaben</li>
                {!!deleteLinks.tasks&&<li>{deleteLinks.tasks} Termin(e) / Aufgabe(n) inklusive vorgemerkter Terminbestätigungen</li>}
                {!!deleteLinks.events&&<li>{deleteLinks.events} Historieneintrag/-einträge</li>}
                {!!deleteLinks.opportunities&&<li>{deleteLinks.opportunities} Verkaufschance(n)</li>}
                {!!deleteLinks.offers&&<li>{deleteLinks.offers} Angebotsentwurf/-entwürfe, sofern noch nicht versendet</li>}
                {linkedIntake&&<li>Öffentliche Formularanfrage(n) und deren Eingangsbestätigungsnachweise</li>}
                {(deleteLinks.statements||linkedDocuments)&&<li>Private Händlerabrechnungen und Dokumente aus dieser Kundenakte</li>}
              </ul>
            </div>}
            {deleteLinks&&deleteLinks.invoices>0||deleteLinks&&data.offers.some(o=>o.customer_id===deleteCustomer.id&&o.status!=="Entwurf")?<>
              <p className="error" role="alert">Diese Kundenakte enthält Rechnungen oder ein nicht mehr als Entwurf geführtes Angebot. Eine Gesamtlöschung ist gesperrt, damit geschäftliche Belege und ihre Dokumentation nicht unbeabsichtigt verloren gehen.</p>
            </>:<>
              <p className="notice">Mit der endgültigen Bestätigung werden alle oben genannten verbundenen CRM-Daten gelöscht. Die Datenbank prüft vor dem Löschen erneut, ob geschützte Belege vorhanden sind.</p>
              <div className="button-row">
                <button className="nx-delete-confirm-button" type="button" disabled={deleteBusy||!!deleteError||checkingLinks} onClick={async()=>{
                  if(!deleteCustomer||deleteBusy)return;
                  const target=deleteCustomer;
                  setDeleteBusy(true);setDeleteError("");
                  try{
                    const result=await client.rpc("nx_delete_customer_bundle",{p_customer:target.id});
                    if(result.error||!result.data?.deleted)throw Error(result.error?.message||"Gesamtlöschung konnte nicht bestätigt werden.");
                    const paths=Array.isArray(result.data.storage_paths)
                      ?result.data.storage_paths.filter((x:unknown):x is string=>typeof x==="string"&&x.startsWith(target.id+"/")):[];
                    let storageProblem=false;
                    for(let start=0;start<paths.length;start+=100){
                      const outcome=await client.storage.from("nx-client-documents").remove(paths.slice(start,start+100));
                      if(outcome.error||outcome.data?.length!==paths.slice(start,start+100).length)storageProblem=true;
                    }
                    await refresh();
                    if(selected===target.id)setSelected(null);
                    setDeleteCustomer(null);
                    setDeleteNotice(storageProblem
                      ?"CRM-Kundenakte gelöscht. Mindestens eine private Datei konnte nicht endgültig entfernt werden; bitte Dokumentenablage administrativ prüfen."
                      :"Kundenakte „"+target.company+"“ und zugehörige Einträge wurden endgültig gelöscht.");
                    if(!demo)void client.functions.invoke("nx-icloud-sync",{body:{action:"sync"}}).catch(()=>undefined);
                  }catch(e){setDeleteError(e instanceof Error?e.message:"Kundenakte konnte nicht gelöscht werden.")}
                  finally{setDeleteBusy(false)}
                }}><Trash2 size={16}/>{deleteBusy?"Wird gelöscht …":"Kundenakte und verknüpfte Einträge endgültig löschen"}</button>
              </div>
            </>}
          </>}
          {deleteError&&<p className="error" role="alert">{deleteError}</p>}
          <button className="secondary" type="button" disabled={deleteBusy} onClick={()=>setDeleteCustomer(null)}>Abbrechen / Schließen</button>
        </div>
      </Modal>}
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
