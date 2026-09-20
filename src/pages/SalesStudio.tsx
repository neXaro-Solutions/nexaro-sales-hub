import { useMemo, useState, type InputHTMLAttributes } from "react";
import { Card, Field, External } from "../components/UI";
import { money, round, type PaymentInput } from "../lib/calculations";
import {
  catalogCheckedAt,
  catalogSource,
  catalogHardwareSource,
  compareOffers,
  emptyMix,
  hardwareCatalog,
  subscriptions,
  type CardMix,
  type ComparisonInput,
  type HardwareSelection,
  type SubscriptionSelection,
} from "../lib/sumup-sales";
import type { OfferDraft } from "./Offers";
import { useStore } from "../lib/store";

const keys: { key: keyof CardMix; label: string }[] = [
  { key: "domesticDebit", label: "Domestic Debit" },
  { key: "domesticCredit", label: "Domestic Credit" },
  { key: "international", label: "International" },
  { key: "corporate", label: "Corporate" },
  { key: "premium", label: "Premium" },
  { key: "cardNotPresent", label: "Card Not Present / Online" },
  { key: "amex", label: "Amex" },
  { key: "unknown", label: "Unbekannt" },
  { key: "sumupCard", label: "Private SumUp Karten (0 %)" },
];
const initial: ComparisonInput = {
  monthlyVolume: 5000,
  currentMode: "formula",
  currentMonthly: 0,
  currentFixed: 15,
  currentVariablePercent: 1.5,
  currentTransactionCount: 0,
  currentPerTransaction: 0,
  mix: { ...emptyMix },
  splitConfirmed: false,
  hardware: [],
  hardwareDiscount: 0,
  subscriptions: [],
};
const num = (v: string) => Number(v);
/** Keep the in-progress text separate from the numeric calculation.
 * Otherwise deleting the last digit immediately renders 0 again on iOS. */
function NumericInput({
  value,
  onChange,
  onFocus,
  onBlur,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & {
  value: number | string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      {...props}
      type="number"
      value={draft ?? value}
      onFocus={(e) => {
        setDraft(Number(value) === 0 ? "" : String(value));
        onFocus?.(e);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange?.(e);
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
export function SalesStudio({
  customerId,
  onOffer,
  photoInput,
  photoAvailable,
}: {
  customerId: string;
  onOffer: (draft: OfferDraft) => void;
  photoInput: PaymentInput;
  photoAvailable: boolean;
}) {
  const { data, save } = useStore();
  const opportunity = data.opportunities.find(
    (o) => o.customer_id === customerId && o.division === "sumup",
  );
  const saved = opportunity?.details.salesStudio as
    | {
        input?: ComparisonInput;
        provider?: string;
        start?: string;
        productInterest?: string[];
        payout?: string;
        planId?: string;
        notes?: string;
      }
    | undefined;
  const [input, setInput] = useState<ComparisonInput>(saved?.input || initial);
  const [provider, setProvider] = useState(saved?.provider || "");
  const [start, setStart] = useState(saved?.start || "");
  const [productInterest, setProductInterest] = useState<string[]>(
    saved?.productInterest || [],
  );
  const [payout, setPayout] = useState(saved?.payout || "");
  const [planId, setPlanId] = useState(saved?.planId || "");
  const [notes, setNotes] = useState(saved?.notes || "");
  const [saveMessage, setSaveMessage] = useState(""),
    [saving, setSaving] = useState(false);
  const calculation = useMemo(() => {
    try {
      return { result: compareOffers(input), error: "" };
    } catch (e) {
      return { result: null, error: (e as Error).message };
    }
  }, [input]);
  const update = <K extends keyof ComparisonInput>(
    key: K,
    value: ComparisonInput[K],
  ) =>
    setInput((old) => ({
      ...old,
      [key]: value,
      ...(["mix", "monthlyVolume"].includes(key)
        ? { splitConfirmed: false }
        : {}),
    }));
  const toggleHardware = (id: HardwareSelection["id"]) => {
    setInput((old) => ({
      ...old,
      hardware: old.hardware.some((x) => x.id === id)
        ? old.hardware.filter((x) => x.id !== id)
        : [
            ...old.hardware,
            {
              id,
              quantity: 1,
              price: hardwareCatalog.find((x) => x.id === id)?.price ?? null,
            },
          ],
    }));
  };
  const toggleSubscription = (id: string) =>
    setInput((old) => ({
      ...old,
      subscriptions: old.subscriptions.some((s) => s.id === id)
        ? old.subscriptions.filter((s) => s.id !== id)
        : [
            ...old.subscriptions,
            {
              id,
              monthly:
                id === "accountplus"
                  ? null
                  : (subscriptions.find((x) => x.id === id)?.monthly ?? null),
            },
          ],
    }));
  const result = calculation.result;
  const totalMode =
    input.currentMode === "total" ||
    (input.currentMode === undefined && input.currentMonthly > 0);
  const selected = result?.plans.find(
    (p) => p.id === (planId || result.best.id),
  );
  const offerReady = Boolean(
    customerId &&
    result &&
    selected &&
    !result.warning &&
    input.hardware.length,
  );
  return (
    <div className="sales-studio">
      <div className="section-intro">
        <div>
          <h2>SumUp · Vertriebsstudio</h2>
          <p>
            Ist-Situation erfassen → Produkt wählen → Gebühren vergleichen →
            Angebot vorbereiten.
          </p>
        </div>
        <External href={catalogSource}>SumUp Konditionen</External>
      </div>
      <p className="hint">
        Reguläre Referenzpreise für Deutschland · Stand {catalogCheckedAt}.
        Keine Aktionspreise oder individuellen Gebühren als reguläre Konditionen
        ausgewiesen. Hardware netto; Preis und Verfügbarkeit vor Versand des
        Angebots verifizieren.
      </p>
      <Card title="01 · Händler und Bedarf" eyebrow="QUALIFIZIERUNG">
        <div className="form-grid">
          <Field label="Erwartetes Startdatum (optional)">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Aktueller Anbieter (optional)">
            <input
              placeholder="Name des Anbieters"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </Field>
          <Field label="Voraussichtliches monatliches TPV (€)">
            <NumericInput
              min="0"
              step=".01"
              value={input.monthlyVolume}
              onChange={(e) => update("monthlyVolume", num(e.target.value))}
            />
          </Field>
          <Field label="Auszahlungsfrequenz">
            <select value={payout} onChange={(e) => setPayout(e.target.value)}>
              <option value="">Bitte auswählen</option>
              <option>SumUp Geschäftskonto · Folgetag</option>
              <option>Externes Auszahlungskonto · abhängig vom Bankweg</option>
            </select>
          </Field>
        </div>
        <h3>Produktinteresse</h3>
        <div className="form-grid">
          {["POS", "Kiosk", "Bank Account", "Another Product"].map((x) => (
            <label className="checkbox-field" key={x}>
              <input
                type="checkbox"
                checked={productInterest.includes(x)}
                onChange={(e) =>
                  setProductInterest((old) =>
                    e.target.checked ? [...old, x] : old.filter((y) => y !== x),
                  )
                }
              />
              {x}
            </label>
          ))}
        </div>
        <Field label="Gesprächsnotizen / offener Bedarf">
          <textarea
            value={notes}
            rows={3}
            maxLength={3000}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </Card>
      <div className="analysis-grid">
        <Card title="02 · Bestand" eyebrow="IST-KOSTEN PRO MONAT">
          <Field label="Ist-Kosten verwenden">
            <select
              value={
                input.currentMode ||
                (input.currentMonthly > 0 ? "total" : "formula")
              }
              onChange={(e) =>
                update("currentMode", e.target.value as "formula" | "total")
              }
            >
              <option value="formula">Aus Gebührenformel berechnen</option>
              <option value="total">Geprüfte Gesamtkosten (auch 0 €)</option>
            </select>
          </Field>
          <p className="hint">
            Entweder die vollständigen monatlichen Ist-Kosten eingeben oder aus
            den einzelnen Konditionen berechnen lassen. Nicht doppelt erfassen.
          </p>
          <div className="form-grid">
            <Field label="Ist-Gesamtkosten / Monat (€)">
              <NumericInput
                min="0"
                step=".01"
                disabled={!totalMode}
                value={input.currentMonthly}
                onChange={(e) => update("currentMonthly", num(e.target.value))}
              />
            </Field>
            <Field label="Monatliche Fixkosten (€)">
              <NumericInput
                min="0"
                step=".01"
                value={input.currentFixed}
                disabled={totalMode}
                onChange={(e) => update("currentFixed", num(e.target.value))}
              />
            </Field>
            <Field label="Bestandsgebühr (%)">
              <NumericInput
                min="0"
                max="100"
                step=".01"
                value={input.currentVariablePercent}
                disabled={totalMode}
                onChange={(e) =>
                  update("currentVariablePercent", num(e.target.value))
                }
              />
            </Field>
            <Field label="Transaktionen / Monat">
              <NumericInput
                min="0"
                step="1"
                value={input.currentTransactionCount}
                disabled={totalMode}
                onChange={(e) =>
                  update("currentTransactionCount", num(e.target.value))
                }
              />
            </Field>
            <Field label="Kosten je Transaktion (€)">
              <NumericInput
                min="0"
                step=".01"
                value={input.currentPerTransaction}
                disabled={totalMode}
                onChange={(e) =>
                  update("currentPerTransaction", num(e.target.value))
                }
              />
            </Field>
          </div>
          <p className="hint">
            📷 Abrechnung im Reiter „Analyse & Foto“ fotografieren und prüfen.
            Anschließend hier übernehmen.
          </p>
          <button
            className="secondary"
            disabled={!photoAvailable}
            onClick={() =>
              setInput((old) => ({
                ...old,
                monthlyVolume: photoInput.volume + photoInput.onlineVolume,
                currentMode:
                  photoInput.currentTotal !== undefined ? "total" : "formula",
                currentMonthly: photoInput.currentTotal ?? 0,
                currentFixed:
                  photoInput.currentTotal === undefined
                    ? photoInput.currentFixed
                    : 0,
                currentVariablePercent:
                  photoInput.currentTotal === undefined
                    ? photoInput.currentRate
                    : 0,
                currentTransactionCount:
                  photoInput.currentTotal === undefined
                    ? photoInput.transactions
                    : 0,
                currentPerTransaction:
                  photoInput.currentTotal === undefined
                    ? photoInput.currentPerTransaction
                    : 0,
                mix: { ...emptyMix, cardNotPresent: photoInput.onlineVolume },
                splitConfirmed: false,
              }))
            }
          >
            Geprüfte Foto-Abrechnung übernehmen
          </button>
        </Card>
        <Card title="03 · Kartenmix" eyebrow="TPV JE KARTENART">
          <p className="hint">
            Beträge pro Monat eingeben. Nicht erfasster Umsatz wird mit 1,39 %
            kalkuliert, niemals stillschweigend als vergünstigte Karte.
          </p>
          <div className="form-grid">
            {keys.map(({ key, label }) => (
              <Field key={key} label={label + " (€)"}>
                <NumericInput
                  min="0"
                  step=".01"
                  value={input.mix[key]}
                  onChange={(e) =>
                    update("mix", { ...input.mix, [key]: num(e.target.value) })
                  }
                />
              </Field>
            ))}
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={input.splitConfirmed}
              onChange={(e) => update("splitConfirmed", e.target.checked)}
            />
            Kartenmix anhand einer Abrechnung oder Händlerangabe geprüft
          </label>
          {result && result.missingMix > 0 && (
            <p className="notice">
              Noch nicht aufgeteilt: {money(result.missingMix)} des TPV.
            </p>
          )}
        </Card>
      </div>
      <Card title="04 · Hardware" eyebrow="REGULÄRE NETTOPREISE">
        <div className="solutions-grid">
          {hardwareCatalog.map((item) => {
            const selected = input.hardware.find((x) => x.id === item.id);
            return (
              <div key={item.id} className="recommendation">
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={Boolean(selected)}
                    onChange={() => toggleHardware(item.id)}
                  />{" "}
                  <strong>{item.name}</strong>
                </label>
                <small>
                  {item.price === null
                    ? "Regulärpreis noch nicht öffentlich verifiziert"
                    : money(item.price) + " netto / Stück"}
                </small>
                {selected && (
                  <div className="form-grid">
                    <Field label="Menge">
                      <NumericInput
                        min="1"
                        max="100"
                        step="1"
                        value={selected.quantity}
                        onChange={(e) =>
                          update(
                            "hardware",
                            input.hardware.map((x) =>
                              x.id === item.id
                                ? { ...x, quantity: num(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Bestätigter Stückpreis netto (€)">
                      <NumericInput
                        min="0"
                        step=".01"
                        value={selected.price ?? ""}
                        placeholder="Preis prüfen"
                        onChange={(e) =>
                          update(
                            "hardware",
                            input.hardware.map((x) =>
                              x.id === item.id
                                ? {
                                    ...x,
                                    price:
                                      e.target.value === ""
                                        ? null
                                        : num(e.target.value),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Field label={`Hardware-Rabatt: ${input.hardwareDiscount} % (0–25 %)`}>
          <input
            type="range"
            min="0"
            max="25"
            step="1"
            value={input.hardwareDiscount}
            onChange={(e) => update("hardwareDiscount", num(e.target.value))}
          />
        </Field>
        <External href={catalogHardwareSource}>
          Hardware-Preise nachprüfen
        </External>
        {result && (
          <div className="mini-stats">
            <div>
              <span>Rabattbetrag</span>
              <b>{money(result.hardwareSaving)}</b>
            </div>
            <div>
              <span>Hardware einmalig netto</span>
              <b>{money(result.hardwareNet)}</b>
            </div>
          </div>
        )}
      </Card>
      <Card
        title="05 · Lizenzen"
        eyebrow="WIEDERKEHRENDE NETTOKOSTEN, SOWEIT AUSGEWIESEN"
      >
        <div className="solutions-grid">
          {subscriptions.map((s) => {
            const chosen = input.subscriptions.find((x) => x.id === s.id);
            return (
              <div className="recommendation" key={s.id}>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={Boolean(chosen)}
                    onChange={() => toggleSubscription(s.id)}
                  />{" "}
                  <strong>{s.name}</strong>
                </label>
                <small>
                  {s.monthly === null
                    ? "Preis auf Anfrage / nicht verifiziert"
                    : money(s.monthly) + " monatlich"}
                </small>
                {chosen && (
                  <Field label="Bestätigte Monatskosten netto (€)">
                    <NumericInput
                      min="0"
                      step=".01"
                      value={chosen.monthly ?? ""}
                      placeholder="Preis prüfen"
                      onChange={(e) =>
                        update(
                          "subscriptions",
                          input.subscriptions.map((x) =>
                            x.id === s.id
                              ? {
                                  ...x,
                                  monthly:
                                    e.target.value === ""
                                      ? null
                                      : num(e.target.value),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                )}
              </div>
            );
          })}
        </div>
        <p className="hint">
          Geschäftskonto Plus ist öffentlich mit 25 € inkl. MwSt. ausgewiesen;
          vor einem Netto-Angebot steuerliche Behandlung gesondert prüfen.
          Jahres-, KDS- und Beauty-Preise nur nach Bestätigung eintragen.
        </p>
      </Card>
      <Card
        title="06 · Konditionen und Ergebnis"
        eyebrow="TRANSPARENTER 12-MONATS-VERGLEICH"
      >
        {calculation.error && (
          <p className="error" role="alert">
            {calculation.error}
          </p>
        )}
        {result && (
          <>
            {result.warning && (
              <p className="notice">
                Vorläufige Modellrechnung: Kartenmix nicht vollständig und
                bestätigt. Vor einer verbindlichen Einsparungszusage
                aufschlüsseln.
              </p>
            )}
            {result.customOffer && (
              <p className="notice">
                Ab 10.000 € TPV monatlich kann ein individuelles SumUp-Angebot
                angefragt werden; nicht in den Standardtarifen berechnet.
              </p>
            )}
            <div className="cost-row">
              <span>Bestand inkl. monatlicher Kosten</span>
              <strong>{money(result.current)} / Monat</strong>
            </div>
            <div className="cost-row">
              <span>Zusätzliche SumUp Lizenzen</span>
              <strong>{money(result.fixedSubs)} / Monat</strong>
            </div>
            {result.plans.map((plan) => (
              <div className="cost-row" key={plan.id}>
                <label className="checkbox-field">
                  <input
                    type="radio"
                    name="sales-plan"
                    checked={(planId || result.best.id) === plan.id}
                    onChange={() => setPlanId(plan.id)}
                  />
                  {plan.title}
                  {plan.id === result.best.id && (
                    <small> · niedrigste berechnete 12-Monats-Kosten</small>
                  )}
                </label>
                <strong>
                  {money(plan.monthly)} / Monat
                  <br />
                  <small>Jahr 1 inkl. Hardware: {money(plan.year)}</small>
                </strong>
              </div>
            ))}
            {selected && (
              <div className="recommendation">
                <h3>{selected.title}</h3>
                <div className="mini-stats">
                  <div>
                    <span>Monatliche Differenz zum Bestand</span>
                    <b>{money(selected.savingsMonthly)}</b>
                  </div>
                  <div>
                    <span>Jährliche Differenz inkl. Hardware</span>
                    <b>{money(selected.savingsYear)}</b>
                  </div>
                  <div>
                    <span>
                      Erster Monat inkl. Einmalkosten und Jahresabo ggf. vorab
                    </span>
                    <b>{money(selected.firstMonth)}</b>
                  </div>
                </div>
                <p>
                  Gebühren nach erfasstem Karteneinsatz, keine Zusage über
                  künftige Umsatz- oder Kostenentwicklung. Jahresabo: 199 €
                  vorab, für Vergleich auf zwölf Monate verteilt.
                </p>
              </div>
            )}
            <div className="button-row">
              <button
                className="secondary"
                disabled={!opportunity || !result || saving}
                onClick={async () => {
                  if (!opportunity || !result) return;
                  setSaving(true);
                  setSaveMessage("");
                  try {
                    await save("opportunities", {
                      ...opportunity,
                      details: {
                        ...opportunity.details,
                        salesStudio: {
                          input,
                          provider,
                          start,
                          productInterest,
                          payout,
                          planId,
                          notes,
                          checkedAt: catalogCheckedAt,
                        },
                      },
                    });
                    setSaveMessage(
                      "Vertriebsstudio in der Kundenakte gespeichert.",
                    );
                  } catch (e) {
                    setSaveMessage((e as Error).message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Vertriebsstudio speichern
              </button>
              <button
                className="primary"
                disabled={!offerReady}
                onClick={() => {
                  if (!selected) return;
                  onOffer({
                    division: "sumup",
                    customer_id: customerId,
                    lines: input.hardware.map((h) => ({
                      name:
                        hardwareCatalog.find((x) => x.id === h.id)?.name ||
                        h.id,
                      quantity: h.quantity,
                      price: round(
                        (h.price || 0) * (1 - input.hardwareDiscount / 100),
                      ),
                      vat: 19,
                    })),
                    notes: `Unverbindliche Modellrechnung vom ${catalogCheckedAt}. Tarif: ${selected.title}. Gebühren ${money(selected.monthly)}/Monat inkl. gewählter Lizenzen; Zahlungskosten werden von SumUp erhoben und nicht als einmalige Angebotsposition berechnet. Startdatum: ${start || "offen"}. Anbieter: ${provider || "nicht angegeben"}. Auszahlung: ${payout || "offen"}. Interesse: ${productInterest.join(", ") || "nicht angegeben"}. ${notes}`,
                    snapshot: {
                      studio: input,
                      comparison: result,
                      plan: selected.id,
                      provider,
                      start,
                      productInterest,
                      payout,
                      checkedAt: catalogCheckedAt,
                      sources: [catalogSource, catalogHardwareSource],
                    },
                  });
                }}
              >
                Angebot vorbereiten
              </button>
            </div>
            {!customerId && (
              <p className="hint">
                Zum Erstellen zuerst oben eine Kundenakte auswählen.
              </p>
            )}
            {!input.hardware.length && (
              <p className="hint">
                Für ein Hardwareangebot mindestens eine Hardwareposition
                auswählen. Eine reine Tarifberatung kannst du in der Kundenakte
                speichern.
              </p>
            )}
            {saveMessage && (
              <p role="status" className="notice">
                {saveMessage}
              </p>
            )}
            {result.warning && (
              <p className="hint">
                Für ein Angebot zuerst den Kartenmix vollständig aufteilen und
                bestätigen.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
