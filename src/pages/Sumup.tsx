import {
  StatementCapture,
  type StatementReview,
} from "../components/StatementCapture";
import {
  defaultNeeds,
  recommendHardware,
  type HardwareNeeds,
} from "../lib/payment-advisor";
import { useState } from "react";
import { ArrowRight, Save, FileText, CheckCircle2 } from "lucide-react";
import { useStore } from "../lib/store";
import {
  Card,
  Field,
  Metric,
  External,
  DivisionBadge,
  Badge,
} from "../components/UI";
import {
  paymentAnalysis,
  money,
  type PaymentInput,
  dateLabel,
} from "../lib/calculations";
import {
  solutions,
  checkedAt,
  pricingSource,
  hardwareSource,
  guide,
} from "../lib/sumup";
import { OfferForm, type OfferDraft } from "./Offers";
import { SalesStudio } from "./SalesStudio";
import { Customers } from "./Customers";
const initialPayment: PaymentInput = {
  volume: 5000,
  eligibleShare: 80,
  freeShare: 0,
  onlineVolume: 0,
  transactions: 200,
  currentRate: 1.5,
  currentFixed: 15,
  currentPerTransaction: 0,
  hardware: solutions[2].price,
  targetVolume: 7000,
};
export function Sumup() {
  const { data, save } = useStore();
  const [capture, setCapture] = useState(false),
    [needs, setNeeds] = useState<HardwareNeeds>(defaultNeeds),
    [statement, setStatement] = useState<StatementReview | null>(null),
    [mixConfirmed, setMixConfirmed] = useState(false);
  const hardwareAdvice = recommendHardware(needs);
  const [tab, setTab] = useState("studio"),
    [customer, setCustomer] = useState(""),
    [solution, setSolution] = useState(2),
    [step, setStep] = useState(0),
    [notes, setNotes] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<OfferDraft | null>(null);
  const [p, setP] = useState<PaymentInput>(initialPayment);
  let analysis: ReturnType<typeof paymentAnalysis> | null = null,
    error = "";
  try {
    analysis = paymentAnalysis(p, needs.annual);
  } catch (e) {
    error = (e as Error).message;
  }
  const update = (key: keyof PaymentInput, n: number) => {
    setP((v) => ({ ...v, [key]: n }));
    if (key === "eligibleShare" || key === "freeShare") setMixConfirmed(false);
    if (
      ["currentTotal", "volume", "onlineVolume", "transactions"].includes(key)
    )
      setStatement(null);
  };
  const selectedOpportunity = data.opportunities.find(
    (o) => o.customer_id === customer && o.division === "sumup",
  );
  async function persist() {
    if (!selectedOpportunity || !analysis) return;
    setBusy(true);
    setMessage("");
    try {
      await save("opportunities", {
        ...selectedOpportunity,
        potential: p.targetVolume,
        details: {
          ...selectedOpportunity.details,
          payment: {
            input: p,
            result: analysis,
            solution: solutions[solution].name,
            checkedAt,
            source: pricingSource,
            needs,
            statement,
            mixConfirmed,
          },
          conversation: notes,
        },
      });
      setMessage("Analyse und Gesprächsnotiz gespeichert.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-intro">
        <div>
          <DivisionBadge division="sumup" />
          <h1>Payment, das sich rechnet.</h1>
          <p>Vom ersten Gespräch zur passenden Lösung für den Standort.</p>
        </div>
        <External href={pricingSource}>Offizielle Konditionen</External>
      </div>
      <div className="tabs">
        {[
          ["studio", "Vertriebsstudio"],
          ["analysis", "Analyse & Foto"],
          ["solutions", "Lösungen"],
          ["guide", "Gesprächsleitfaden"],
          ["leads", "Händler & Leads"],
        ].map(([k, v]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {v}
          </button>
        ))}
      </div>
      {tab === "leads" ? (
        <Customers division="sumup" />
      ) : (
        <>
          <div className="context-bar">
            <Field label="Analyse einer Kundenakte zuordnen">
              <select
                value={customer}
                onChange={(e) => {
                  const id = e.target.value;
                  setCustomer(id);
                  setMessage("");
                  const o = data.opportunities.find(
                    (o) => o.customer_id === id && o.division === "sumup",
                  );
                  const stored = o?.details.payment as
                    | {
                        input?: PaymentInput;
                        solution?: string;
                        needs?: HardwareNeeds;
                        statement?: StatementReview;
                        mixConfirmed?: boolean;
                      }
                    | undefined;
                  setNeeds(stored?.needs ?? defaultNeeds);
                  setStatement(stored?.statement ?? null);
                  setMixConfirmed(stored?.mixConfirmed ?? false);
                  if (stored?.input) {
                    setP(stored.input);
                    const idx = solutions.findIndex(
                      (s) => s.name === stored.solution,
                    );
                    setSolution(idx >= 0 ? idx : 2);
                  } else {
                    setP(initialPayment);
                    setSolution(2);
                  }
                  setNotes(String(o?.details.conversation || ""));
                }}
              >
                <option value="">
                  Freie Berechnung · noch nicht gespeichert
                </option>
                {data.customers
                  .filter((c) =>
                    data.opportunities.some(
                      (o) => o.customer_id === c.id && o.division === "sumup",
                    ),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company}
                    </option>
                  ))}
              </select>
            </Field>
            <span className="muted">Referenzstand {dateLabel(checkedAt)}</span>
          </div>
          {capture && (
            <StatementCapture
              onClose={() => setCapture(false)}
              onApply={(values, review) => {
                setP((v) => ({
                  ...v,
                  ...values,
                  currentRate: 0,
                  currentFixed: 0,
                  currentPerTransaction: 0,
                  eligibleShare: 0,
                  freeShare: 0,
                  targetVolume: values.volume ?? v.targetVolume,
                }));
                setStatement(review);
                setMixConfirmed(false);
              }}
            />
          )}
          {tab === "studio" && (
            <SalesStudio customerId={customer} onOffer={setDraft} />
          )}
          {tab === "analysis" && (
            <>
              <Card
                title="Vom Abrechnungsfoto zum Vorschlag"
                eyebrow="ABRECHNUNG & BEDARF"
              >
                <p>
                  Foto erfassen, erkannte Beträge prüfen und deinen
                  Hardwarebedarf bestätigen. Der günstigste verfügbare
                  Standardtarif wird aus den Monatswerten berechnet.
                </p>
                <button className="primary" onClick={() => setCapture(true)}>
                  <FileText size={16} /> Abrechnung fotografieren / hochladen
                </button>
                {statement && (
                  <p className="hint">
                    Geprüfter Beleg übernommen · {statement.months} Monat(e),
                    auf einen Monat umgerechnet. Die Ist-Kosten stammen direkt
                    aus dem Beleg.
                  </p>
                )}
                <div className="form-grid advisor-needs">
                  {(
                    [
                      ["smartphone", "Kompatibles Smartphone vorhanden"],
                      ["chip", "Chip-Kartenzahlungen erforderlich"],
                      ["standalone", "Ohne Smartphone kassieren"],
                      ["paper", "Gedruckte Belege erforderlich"],
                      ["catalog", "Artikelkatalog am Terminal benötigt"],
                      [
                        "advancedPos",
                        "Erweiterte Kasse / TSE / Integrationen benötigt",
                      ],
                      [
                        "annual",
                        "12 Monate Jahresabo berücksichtigen (199 € vorab)",
                      ],
                    ] as [keyof HardwareNeeds, string][]
                  ).map(([key, label]) => (
                    <label className="checkbox-field" key={key}>
                      <input
                        type="checkbox"
                        checked={needs[key]}
                        onChange={(e) =>
                          setNeeds((v) => ({ ...v, [key]: e.target.checked }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="recommendation">
                  <Badge>Hardwarevorschlag nach deinen Anforderungen</Badge>
                  <h3>
                    {hardwareAdvice.best.name} ·{" "}
                    {money(hardwareAdvice.best.price)} netto
                  </h3>
                  <p>{hardwareAdvice.reasons.join(" ")}</p>
                  {hardwareAdvice.warning && (
                    <p className="notice">{hardwareAdvice.warning}</p>
                  )}
                  <button
                    className="secondary"
                    onClick={() => {
                      setSolution(hardwareAdvice.best.index);
                      update("hardware", hardwareAdvice.best.price);
                    }}
                  >
                    Hardwarevorschlag übernehmen
                  </button>
                </div>
              </Card>
              <div className="analysis-grid">
                <Card title="Deine Ausgangslage" eyebrow="IST-SITUATION">
                  {p.currentTotal !== undefined && (
                    <div className="notice">
                      <Field label="Geprüfte Ist-Gesamtkosten / Monat (€)">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={p.currentTotal}
                          onChange={(e) =>
                            update("currentTotal", +e.target.value)
                          }
                        />
                      </Field>
                      <p>
                        Dieser Betrag ersetzt die bisherige Gebührenformel
                        vollständig.
                      </p>
                      <button
                        className="text-link"
                        onClick={() => {
                          setP(({ currentTotal, ...rest }) => rest);
                          setStatement(null);
                        }}
                      >
                        Zur Gebührenformel wechseln
                      </button>
                    </div>
                  )}
                  <div className="form-grid">
                    {(
                      [
                        ["volume", "Kartenumsatz vor Ort / Monat (€)"],
                        ["transactions", "Transaktionen gesamt / Monat"],
                        ["currentRate", "Bisherige Gebühr (%)"],
                        ["currentFixed", "Bisherige Fixkosten / Monat (€)"],
                        ["currentPerTransaction", "Bisherige Stückgebühr (€)"],
                        ["onlineVolume", "Online-Umsatz / Monat (€)"],
                      ] as [keyof PaymentInput, string][]
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <input
                          disabled={
                            p.currentTotal !== undefined &&
                            key.startsWith("current")
                          }
                          type="number"
                          min="0"
                          max={key === "currentRate" ? 100 : 1000000000}
                          step={key === "transactions" ? 1 : 0.01}
                          value={p[key]}
                          onChange={(e) => update(key, Number(e.target.value))}
                        />
                      </Field>
                    ))}
                  </div>
                  <h3>Kartenmix vor Ort</h3>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={mixConfirmed}
                      onChange={(e) => setMixConfirmed(e.target.checked)}
                    />
                    Kartenmix anhand des Belegs oder mit dem Händler bestätigt
                  </label>
                  {!mixConfirmed && (
                    <p className="notice">
                      Vorläufige Empfehlung: Der Kartenmix ist noch unbestätigt.
                      Beim Fotoimport wird zunächst konservativ mit 0 %
                      rabattfähigen Karten gerechnet. Ein hoher geeigneter
                      Anteil kann Zahlungen Plus günstiger machen.
                    </p>
                  )}
                  <Field
                    label={`Für 0,79 % geeignete Karten: ${p.eligibleShare} %`}
                  >
                    <input
                      aria-label="Plus-Kartenanteil"
                      type="range"
                      min="0"
                      max="100"
                      value={p.eligibleShare}
                      onChange={(e) => update("eligibleShare", +e.target.value)}
                    />
                  </Field>
                  <Field label="Anteil SumUp-Karten (gebührenfrei, %)">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={p.freeShare}
                      onChange={(e) => update("freeShare", +e.target.value)}
                    />
                  </Field>
                  <p className="hint">
                    Reduzierte Plus-Gebühr nur für geeignete Karten. Premium-,
                    internationale Karten und Amex separat berücksichtigen. Im
                    Zweifel Anteil anhand der Abrechnung prüfen.
                  </p>
                  <Field label="Erwarteter Kartenumsatz / Monat (€)">
                    <input
                      type="number"
                      min="0"
                      value={p.targetVolume}
                      onChange={(e) => update("targetVolume", +e.target.value)}
                    />
                  </Field>
                </Card>
                <div>
                  <Card
                    title="Dein Kostenvergleich"
                    eyebrow="MONATLICHE ZAHLUNGSGEBÜHREN"
                    className="comparison"
                  >
                    {error ? (
                      <p className="error" role="alert">
                        {error}
                      </p>
                    ) : (
                      analysis && (
                        <>
                          <div className="cost-row">
                            <span>Bisheriger Anbieter</span>
                            <strong>{money(analysis.current)}</strong>
                          </div>
                          <div className="cost-row">
                            <span>
                              SumUp · Umsatzbasiert
                              <small>1,39 % · 0 € Grundgebühr</small>
                            </span>
                            <strong>{money(analysis.standard)}</strong>
                          </div>
                          <div className="cost-row">
                            <span>
                              SumUp · Zahlungen Plus
                              <small>0,79 / 1,39 % · 19 € monatlich</small>
                            </span>
                            <strong>{money(analysis.plus)}</strong>
                          </div>
                          {needs.annual && (
                            <div className="cost-row">
                              <span>
                                SumUp · Plus Jahresabo
                                <small>199 € vorab · Monatsdurchschnitt</small>
                              </span>
                              <strong>{money(analysis.plusAnnual)}</strong>
                            </div>
                          )}
                          <div className="recommendation">
                            <Badge kind="positive">
                              {mixConfirmed
                                ? "Günstigster hinterlegter Tarif"
                                : "Vorläufig bei diesem Kartenmix"}
                            </Badge>
                            <h2>{analysis.recommended}</h2>
                            {analysis.annualSelected && (
                              <p>
                                12 Monate Bindung. Erstmonat inkl. Hardware und
                                Jahresgrundgebühr: {money(analysis.firstMonth)}.
                              </p>
                            )}
                            <strong>
                              {money(analysis.savings)}
                              <small> Differenz pro Monat zum Ist</small>
                            </strong>
                            <p>
                              {analysis.savings >= 0
                                ? "Mögliche Gebührenersparnis bei unverändertem Umsatz."
                                : "Der bisherige Anbieter ist bei diesen Angaben günstiger."}
                            </p>
                          </div>
                          <div className="mini-stats">
                            <div>
                              <span>1. Jahr inkl. Hardware</span>
                              <b>{money(analysis.firstYear)}</b>
                            </div>
                            <div>
                              <span>Jahresersparnis nach Hardware</span>
                              <b>{money(analysis.annualSavings)}</b>
                            </div>
                            <div>
                              <span>Plus-Monatsabo lohnt sich ab</span>
                              <b>
                                {analysis.breakEven
                                  ? money(analysis.breakEven) + " / Monat"
                                  : "Nicht bei diesem Kartenmix"}
                              </b>
                            </div>
                            <div>
                              <span>Zusätzliches Kartenpotenzial</span>
                              <b>{money(analysis.extraVolume)} / Monat</b>
                            </div>
                          </div>
                          {analysis.custom && (
                            <p className="notice">
                              Ab 10.000 € monatlichem Volumen individuelle
                              SumUp-Konditionen anfragen. Dafür ist hier kein
                              Preis hinterlegt.
                            </p>
                          )}
                        </>
                      )
                    )}
                  </Card>
                  <Card title="Hardware berücksichtigen">
                    <Field label="Lösung">
                      <select
                        value={solution}
                        onChange={(e) => {
                          const i = +e.target.value;
                          setSolution(i);
                          update("hardware", solutions[i].price);
                        }}
                      >
                        {solutions.map((s, i) => (
                          <option key={s.name} value={i}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Einmalige Hardwarekosten netto (€)">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={p.hardware}
                        onChange={(e) => update("hardware", +e.target.value)}
                      />
                    </Field>
                    <p className="hint">
                      Aktionspreise vom {dateLabel(checkedAt)}, zzgl. MwSt.
                      Konditionen vor einem Angebot prüfen. Optionale
                      Kassen-Abos und weitere Leistungen separat ergänzen.
                    </p>
                  </Card>
                </div>
              </div>
              <div className="button-row">
                <button
                  className="primary"
                  disabled={!customer || !analysis || busy}
                  onClick={() => void persist()}
                >
                  <Save size={16} /> Analyse speichern
                </button>
                <button
                  className="secondary"
                  disabled={!analysis}
                  onClick={() =>
                    setDraft({
                      division: "sumup",
                      customer_id: customer,
                      lines: [
                        {
                          name: "SumUp " + solutions[solution].name,
                          quantity: 1,
                          price: p.hardware,
                          vat: 19,
                        },
                      ],
                      notes: `Beratungsgrundlage: öffentliche SumUp-Konditionen vom ${dateLabel(checkedAt)}. Gebühren werden von SumUp gemäß gewähltem Tarif erhoben und sind keine Position dieses Angebots. Hardwarepreis vor Bestellung bestätigen.`,
                      snapshot: {
                        analysis,
                        paymentInput: p,
                        source: pricingSource,
                        needs,
                        statement,
                        mixConfirmed,
                        checkedAt,
                      },
                    })
                  }
                >
                  <FileText size={16} /> Angebot vorbereiten
                </button>
              </div>
              <p className="hint">
                Modellrechnung bei unverändertem Umsatz und Kartenmix.
                Ist-Kosten stammen aus dem geprüften Beleg oder der eingegebenen
                Gebührenformel. Online-Zahlungen kosten in allen hinterlegten
                SumUp-Tarifen 2,5 %. Hardware netto; weitere Kassen-Abos,
                Steuern und individuelle Sonderkonditionen separat prüfen.
              </p>
            </>
          )}
          {tab === "solutions" && (
            <>
              <div className="solutions-grid">
                {solutions.map((s, i) => (
                  <Card key={s.name}>
                    <span className="solution-number">0{i + 1}</span>
                    <Badge>{s.tag}</Badge>
                    <h2>{s.name}</h2>
                    <p>{s.use}</p>
                    <div className="solution-price">
                      {money(s.price)}
                      {s.regular > s.price && <del>{money(s.regular)}</del>}
                      <small>netto · Referenzpreis</small>
                    </div>
                    <ul>
                      <li>{s.connection}</li>
                      <li>Belege: {s.receipt}</li>
                    </ul>
                    <button
                      className="secondary"
                      onClick={() => {
                        setSolution(i);
                        update("hardware", s.price);
                        setTab("analysis");
                      }}
                    >
                      In Vergleich übernehmen <ArrowRight size={16} />
                    </button>
                  </Card>
                ))}
              </div>
              <p className="hint">
                Öffentliche Aktionspreise, geprüft am {dateLabel(checkedAt)}.
                Verfügbarkeit und Konditionen können sich ändern.
              </p>
              <External href={hardwareSource}>
                Aktuelle Hardwarepreise prüfen
              </External>
            </>
          )}
          {tab === "guide" && (
            <div className="analysis-grid">
              <Card title="Ein Gespräch mit Richtung">
                <div className="guide-steps">
                  {guide.map((g, i) => (
                    <button
                      key={g.title}
                      className={i === step ? "active" : ""}
                      onClick={() => setStep(i)}
                    >
                      <span>{i + 1}</span>
                      {g.title}
                    </button>
                  ))}
                </div>
              </Card>
              <Card
                title={guide[step].title}
                eyebrow={`SCHRITT ${step + 1} VON 6`}
              >
                <blockquote>{guide[step].prompt}</blockquote>
                <p>{guide[step].fields}</p>
                <Field label="Gesprächsnotiz für diese Kundenakte">
                  <textarea
                    rows={6}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={3000}
                  />
                </Field>
                <div className="button-row">
                  <button
                    className="primary"
                    disabled={!customer || busy}
                    onClick={() => void persist()}
                  >
                    <Save size={16} /> Speichern
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setStep((step + 1) % 6)}
                  >
                    Weiter <ArrowRight size={16} />
                  </button>
                </div>
              </Card>
            </div>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
        </>
      )}
      {draft && <OfferForm draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
}
