import {
  ArrowRight,
  Plus,
  Clock3,
  Target,
  Users,
  Check,
  MapPin,
  Inbox,
} from "lucide-react";
import { useState } from "react";
import { DashboardWeather } from "../components/DashboardWeather";
import { DashboardCalendar } from "../components/DashboardCalendar";
import { SmsRequests } from "../components/SmsRequests";
import { DashboardIllustration } from "../components/PageVisual";
import { useStore } from "../lib/store";
import { today, money, dateLabel, dayKey } from "../lib/calculations";
import { Card, Metric, Empty, DivisionBadge, Badge } from "../components/UI";
import type { Task } from "../lib/types";
const motivation = [
  "Jeder gute Abschluss beginnt mit einem ehrlichen Gespräch.",
  "Konsequente Nachfassaktionen machen aus Chancen Ergebnisse.",
  "Heute ist ein guter Tag, um einem Kunden echten Mehrwert zu zeigen.",
  "Nicht jeder Kontakt wird ein Abschluss – jeder Kontakt bringt Klarheit.",
  "Vertrauen entsteht, wenn du zuhörst und passende Lösungen anbietest.",
  "Ein klarer nächster Schritt ist oft wertvoller als ein perfekter Pitch.",
  "Deine beste Vertriebsstrategie: verstehen, vergleichen, verlässlich handeln.",
  "Ein gutes Angebot macht dem Kunden die Entscheidung leichter.",
];
export function Dashboard({
  navigate,
  newCustomer,
  newTask,
}: {
  navigate: (s: string) => void;
  newCustomer: () => void;
  newTask: () => void;
}) {
  const { data, save } = useStore();
  const [quote] = useState(
    () => motivation[Math.floor(Math.random() * motivation.length)],
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const now = today();
  const hunterFollowups=data.tasks.filter(t=>!t.done&&t.division==="sumup"&&(
    /Gebührenvergleich|Beratungsanfrage|Abrechnung prüfen|Neue Anfrage beantworten/i.test(t.title)
    ||t.notes?.startsWith("nx-offer-followup:")
  )).sort((a,b)=>a.due_at.localeCompare(b.due_at));
  const newInquiries=hunterFollowups.filter(t=>!t.notes?.startsWith("nx-offer-followup:"));
  const proposalFollowups=hunterFollowups.filter(t=>t.notes?.startsWith("nx-offer-followup:"));
  const overdueHunter=hunterFollowups.filter(t=>dayKey(t.due_at)<now);

  const due = data.tasks
    .filter((t) => !t.done && dayKey(t.due_at) <= now)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  const open = data.opportunities.filter(
    (o) =>
      o.division === "sumup" && !["Gewonnen", "Verloren"].includes(o.stage),
  );
  const closing = data.offers
    .filter(
      (o) =>
        o.division === "sumup" &&
        o.status === "Gesendet" &&
        o.valid_until >= now,
    )
    .sort((a, b) => a.valid_until.localeCompare(b.valid_until));
  const offerOpportunities = open.filter(
    (o) =>
      o.stage === "Angebot" &&
      !closing.some(
        (offer) =>
          offer.customer_id === o.customer_id && offer.division === o.division,
      ),
  );
  const sumup = open
      .filter((o) => o.division === "sumup")
      .reduce((n, o) => n + o.potential, 0),
    dealerCount = data.opportunities.filter(
      (o) => o.division === "vape",
    ).length;
  async function done(t: Task) {
    setBusy(t.id);
    try {
      await save("tasks", { ...t, done: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="welcome nx-dashboard-welcome">
        <div>
          <span className="eyebrow">DEIN VERTRIEB. DEIN ÜBERBLICK.</span>
          <h1>
            Starke Standorte.
            <br />
            <span>Klare nächste Schritte.</span>
          </h1>
          <p className="nx-dashboard-quote">{quote}</p>
          <button className="primary" onClick={newCustomer}>
            <Plus size={17} /> Standort erfassen
          </button>
          <button className="secondary" onClick={() => navigate("hunter")}>
            <MapPin size={16} /> Tour planen
          </button>
        </div>
        <DashboardIllustration />
      </div>
      <div className="nx-dashboard-shortcuts" aria-label="Schnellzugriffe">
        <button type="button" className="nx-dashboard-shortcut" onClick={newTask}><Plus size={18}/><span>Termin anlegen</span></button>
        <button type="button" className="nx-dashboard-shortcut" onClick={()=>navigate("customers")}><Users size={18}/><span>Kunden & Leads</span></button>
        <button type="button" className="nx-dashboard-shortcut" onClick={()=>navigate("hunter")}><MapPin size={18}/><span>Außendienst</span></button>
        <button type="button" className="nx-dashboard-shortcut" onClick={()=>navigate("offers")}><Target size={18}/><span>Angebote</span></button>
      </div>
      <div className="metrics">
        <Metric
          label="Kunden & Leads"
          onClick={() => navigate("customers")}
          value={data.customers.length}
          detail={`${open.length} offene Verkaufschancen`}
          icon={<Users size={17} />}
        />
        <Metric
          label="Heute zu erledigen"
          onClick={() => navigate("tasks")}
          value={due.length}
          detail={`${data.tasks.filter((t) => !t.done).length} Aufgaben insgesamt offen`}
          icon={<Clock3 size={17} />}
        />
        <Metric
          label="SumUp-Potenzial"
          onClick={() => navigate("sumup")}
          value={money(sumup)}
          detail="Monatliches Volumen offener Chancen"
          icon={<Target size={17} />}
        />
        <Metric
          label="Vape-Händler"
          onClick={() => navigate("vape")}
          value={dealerCount}
          detail="Neutrale Betreuung und Dokumentation"
        />
      </div>
      <div className="dashboard-grid nx-dashboard-priorities">
        <Card
          title="Dein Fokus für heute"
          eyebrow={dateLabel(now)}
          action={
            <button className="text-button" onClick={newTask}>
              <Plus size={16} /> Aufgabe
            </button>
          }
        >
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {due.length ? (
            <div className="task-list">
              {due.slice(0, 6).map((t) => (
                <div className="task-row" key={t.id}>
                  <button
                    className="check-button"
                    aria-label={t.title + " erledigen"}
                    disabled={busy === t.id}
                    onClick={() => void done(t)}
                  >
                    <Check size={15} />
                  </button>
                  <div className="grow">
                    <strong>{t.title}</strong>
                    <small>
                      {data.customers.find((c) => c.id === t.customer_id)
                        ?.company || "Allgemeine Aufgabe"}
                    </small>
                  </div>
                  {t.division && <DivisionBadge division={t.division} />}
                  <span
                    className={dayKey(t.due_at) < now ? "overdue" : "muted"}
                  >
                    {dayKey(t.due_at) < now
                      ? "Überfällig"
                      : new Date(t.due_at).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Europe/Berlin",
                        })}
                  </span>
                </div>
              ))}
            </div>
          ) : closing.length || offerOpportunities.length ? (
            <div className="task-list">
              <p className="hint">
                Keine fälligen Aufgaben. Diese Angebote und Abschlusschancen
                verdienen deine Aufmerksamkeit:
              </p>
              {closing.slice(0, 4).map((offer) => (
                <div className="task-row" key={offer.id}>
                  <Target size={17} />
                  <div className="grow">
                    <strong>
                      {data.customers.find((c) => c.id === offer.customer_id)
                        ?.company || "Kunde"}{" "}
                      · Angebot {offer.number}
                    </strong>
                    <small>
                      Gesendet · gültig bis {dateLabel(offer.valid_until)}
                    </small>
                  </div>
                  <DivisionBadge division={offer.division} />
                </div>
              ))}
              {offerOpportunities
                .slice(0, Math.max(0, 4 - closing.length))
                .map((o) => (
                  <div className="task-row" key={o.id}>
                    <Target size={17} />
                    <div className="grow">
                      <strong>
                        {data.customers.find((c) => c.id === o.customer_id)
                          ?.company || "Kunde"}
                      </strong>
                      <small>
                        Verkaufschance in Phase Angebot · Abschluss nachfassen
                      </small>
                    </div>
                    <DivisionBadge division={o.division} />
                  </div>
                ))}
              <button className="secondary" onClick={() => navigate("offers")}>
                Angebote öffnen <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <Empty title="Alles im Blick">
              Keine fälligen Aufgaben oder offenen Angebote. Plane deinen
              nächsten Kundenkontakt.
            </Empty>
          )}
          <button className="card-footer" onClick={() => navigate("tasks")}>
            Alle Aufgaben ansehen <ArrowRight size={16} />
          </button>
        </Card>
        <Card
          title="Deine Vertriebsbereiche"
          eyebrow="ZWEI BEREICHE. EINE ZENTRALE."
        >
          <button className="division-card" onClick={() => navigate("sumup")}>
            <span className="division-icon"><Target size={23} /></span>
            <div className="grow">
              <strong>SumUp Vertrieb</strong>
              <small>
                {
                  data.opportunities.filter((o) => o.division === "sumup")
                    .length
                }{" "}
                Verkaufschancen · Payment
              </small>
            </div>
            <ArrowRight size={19} />
          </button>
          <button className="division-card" onClick={() => navigate("vape")}>
            <span className="division-icon vape-icon"><Inbox size={23} /></span>
            <div className="grow">
              <strong>Händlerverwaltung</strong>
              <small>{dealerCount} Kontakte · Termine & Dokumente</small>
            </div>
            <ArrowRight size={19} />
          </button>
          <div className="quiet-box">
            <Inbox size={20} />
            <div>
              <strong>
                {
                  data.customers.filter((c) => c.source === "Kontaktformular")
                    .length
                }{" "}
                Formularanfragen
              </strong>
              <small>
                Neue Anfragen erhalten automatisch eine Wiedervorlage.
              </small>
            </div>
          </div>
        </Card>
      </div>
      <Card title="HUNTER AUTO · Nachverfolgung" eyebrow="ANFRAGEN · ABRECHNUNGEN · ANGEBOTE">
        <div className="nx-followup-metrics">
          <div><strong>{newInquiries.length}</strong><small>Offene SumUp-Anfragen und Abrechnungen</small></div>
          <div><strong>{proposalFollowups.length}</strong><small>Angebote persönlich nachfassen</small></div>
          <div><strong>{overdueHunter.length}</strong><small>Überfällige nächste Schritte</small></div>
        </div>
        {hunterFollowups.length?<div className="task-list">
          {hunterFollowups.slice(0,6).map(t=><div className="task-row" key={t.id}>
            <Clock3 size={17}/>
            <div className="grow">
              <strong>{t.title}</strong>
              <small>{data.customers.find(c=>c.id===t.customer_id)?.company||"Kundenakte prüfen"} · {dateLabel(t.due_at)}</small>
            </div>
            <span className={dayKey(t.due_at)<now?"overdue":"muted"}>
              {dayKey(t.due_at)<now?"Überfällig":"Geplant"}
            </span>
          </div>)}
        </div>:<p className="hint">Keine offenen SumUp-Anfragen oder automatischen Angebots-Wiedervorlagen.</p>}
        <div className="button-row">
          <button className="primary" onClick={()=>navigate("tasks")}>Wiedervorlagen bearbeiten <ArrowRight size={16}/></button>
          <button className="secondary" onClick={()=>navigate("customers")}>Neue Leads öffnen <ArrowRight size={16}/></button>
        </div>
      </Card>
      <details className="nx-dashboard-fold">
        <summary><span><Clock3 size={18}/> Monatskalender & Terminübersicht</span><small>Aufklappen</small></summary>
        <div className="nx-dashboard-fold-body">
      <DashboardCalendar newTask={newTask} navigate={navigate}/>
        </div>
      </details>
      <details className="nx-dashboard-fold">
        <summary><span><Inbox size={18}/> Terminbestätigungen & Nachrichten</span><small>Aufklappen</small></summary>
        <div className="nx-dashboard-fold-body">
      <SmsRequests/>
        </div>
      </details>
      <details className="nx-dashboard-fold">
        <summary><span><Target size={18}/> Auswertungen, Wetter & weitere Bereiche</span><small>Aufklappen</small></summary>
        <div className="nx-dashboard-fold-body">
      <DashboardWeather />
      <Card title="Weitere CRM-Bereiche" eyebrow="SUMUP · VAPE · DOKUMENTE">
        <div className="button-row" style={{ flexWrap: "wrap" }}>
          <button className="primary" onClick={() => navigate("sumup")}><Target size={16} /> SumUp-Beratung öffnen <ArrowRight size={15} /></button>
          <button className="secondary" onClick={() => navigate("vape")}><Inbox size={16} /> Vape-B2B-Katalog <ArrowRight size={15} /></button>
          <button className="secondary" onClick={() => navigate("offers")}><Target size={16} /> Angebote & Rechnungen <ArrowRight size={15} /></button>
          <button className="secondary" onClick={() => navigate("knowledge")}>Wissensdatenbank <ArrowRight size={15} /></button>
          <a className="secondary" href="./testabrechnung.html" target="_blank" rel="noopener noreferrer">Testabrechnung drucken</a>
        </div>
      </Card>
      <Card
        title="Vertrieb in Bewegung"
        eyebrow="PIPELINE"
        action={
          <button className="text-button" onClick={() => navigate("customers")}>
            Kunden öffnen <ArrowRight size={15} />
          </button>
        }
      >
        <div className="pipeline">
          {["Neu", "Kontaktiert", "Termin", "Angebot", "Gewonnen"].map(
            (stage, i) => {
              const count = data.opportunities.filter(
                (o) => o.division === "sumup" && o.stage === stage,
              ).length;
              return (
                <div key={stage}>
                  <div>
                    <span
                      className="pipeline-dot"
                      style={{ opacity: 0.35 + i * 0.16 }}
                    />
                    {stage}
                    <b>{count}</b>
                  </div>
                  <div className="pipeline-track">
                    <i
                      style={{
                        width: `${data.opportunities.length ? Math.max(3, (count / data.opportunities.length) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            },
          )}
        </div>
      </Card>
      <Card
        title="Letzte Aktivitäten"
        action={<Badge>Gemeinsame Kundenhistorie</Badge>}
      >
        {data.events.length ? (
          <div className="activity-list">
            {[...data.events]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 5)
              .map((e) => (
                <div key={e.id}>
                  <span className="activity-dot" />
                  <div className="grow">
                    <strong>{e.description}</strong>
                    <small>
                      {data.customers.find((c) => c.id === e.customer_id)
                        ?.company || "Vertrieb"}
                    </small>
                  </div>
                  <small>{dateLabel(e.created_at)}</small>
                </div>
              ))}
          </div>
        ) : (
          <p className="muted">
            Gesprächsnotizen und neue Formularanfragen erscheinen hier.
          </p>
        )}
      </Card>
        </div>
      </details>
    </>
  );
}
