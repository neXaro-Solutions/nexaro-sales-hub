import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react";
import type { StatementReview } from "../components/StatementCapture";
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
  mix: { ...emptyMix, domesticDebit: 4000, unknown: 1000 },
  splitConfirmed: false,
  hardware: [],
  hardwareDiscount: 0,
  subscriptions: [],
};
const num = (v: string) => Number(v);
function MultiChoiceDropdown<T extends string>({
  label, options, selected, onToggle,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <details className="multi-choice-dropdown">
      <summary aria-label={label}>
        {label} · {selected.length ? `${selected.length} ausgewählt` : "Bitte auswählen"}
      </summary>
      <div className="multi-choice-options" role="group" aria-label={label}>
        {options.map((option) => (
          <label className="checkbox-field" key={option.value}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </details>
  );
}
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
  photoReview,
  onCapture,
}: {
  customerId: string;
  onOffer: (draft: OfferDraft) => void;
  photoInput: PaymentInput;
  photoAvailable: boolean;
  photoReview: StatementReview | null;
  onCapture: () => void;
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
  const [manualMixOpen, setManualMixOpen] = useState(false);
  const [mixOrigin, setMixOrigin] = useState<"default" | "photo" | "manual">("default");
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
      ...(key === "monthlyVolume" && mixOrigin === "default"
        ? {
            mix: {
              ...emptyMix,
              domesticDebit: round((value as number) * 0.8),
              unknown: round((value as number) - round((value as number) * 0.8)),
            },
          }
        : {}),
      ...(["mix", "monthlyVolume"].includes(key)
        ? { splitConfirmed: false }
        : {}),
    }));
  useEffect(() => {
    if (!photoAvailable || !photoReview) return;
    const volume = photoInput.volume + photoInput.onlineVolume;
    const eligible = photoReview.eligibleVolume;
    const other = photoReview.otherVolume;
    const hasBreakdown = eligible !== undefined || other !== undefined;
    const knownEligible = eligible ?? 0;
    const knownOther = other ?? 0;
    const mix = hasBreakdown
      ? {
          ...emptyMix,
          domesticDebit: knownEligible,
          unknown: Math.max(0, photoInput.volume - knownEligible),
          cardNotPresent: photoInput.onlineVolume,
        }
      : {
          ...emptyMix,
          domesticDebit: round(photoInput.volume * 0.8),
          unknown: round(photoInput.volume * 0.2),
          cardNotPresent: photoInput.onlineVolume,
        };
    setInput((old) => ({
      ...old,
      monthlyVolume: volume,
      currentMode: photoInput.currentTotal !== undefined ? "total" : "formula",
      currentMonthly: photoInput.currentTotal ?? 0,
      currentFixed: photoInput.currentTotal === undefined ? photoInput.currentFixed : 0,
      currentVariablePercent: photoInput.currentTotal === undefined ? photoInput.currentRate : 0,
      currentTransactionCount: photoInput.currentTotal === undefined ? photoInput.transactions : 0,
      currentPerTransaction: photoInput.currentTotal === undefined ? photoInput.currentPerTransaction : 0,
      mix,
      splitConfirmed: hasBreakdown && eligible !== undefined && other !== undefined &&
        Math.abs(knownEligible + knownOther - photoInput.volume) <= 0.01,
    }));
    setMixOrigin("photo");
  }, [photoReview?.confirmedAt, photoAvailable]);

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
      <div className="recommendation">
        <button className="primary" onClick={onCapture}>📷 Händlerabrechnung fotografieren / hochladen</button>
        <p className="hint">Erster Schritt: Beleg erfassen, Werte prüfen und automatisch in Kartenmix und Kostenvergleich übernehmen.</p>
      </div>
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
        <MultiChoiceDropdown
          label="Produktinteresse auswählen"
          options={["POS", "Kiosk", "Bank Account", "Another Product"].map((x) => ({ value: x, label: x }))}
          selected={productInterest}
          onToggle={(value) => setProductInterest((old) =>
            old.includes(value) ? old.filter((x) => x !== value) : [...old, value]
          )}
        />
        {productInterest.map((x) => (
          <div className="recommendation" key={x}>
            <strong>{x}</strong>
            <button type="button" className="text-link"
              onClick={() => setProductInterest((old) => old.filter((y) => y !== x))}>
              Entfernen
            </button>
          </div>
        ))}
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
        </Card>
        <Card title="03 · Kartenmix" eyebrow="STANDARD 80 / 20 · BELEG HAT VORRANG">
          <button className="primary" onClick={onCapture}>
            📷 Händlerabrechnung fotografieren / hochladen
          </button>
          <p className="hint">
            Standard: 80 % für Zahlungen Plus geeignete inländische Debit-/Kreditkarten,
            20 % andere Karten (konservativ mit 1,39 %). Das ist eine Schätzung,
            keine bestätigte Händlerangabe.
          </p>
          {mixOrigin === "photo" && (
            <p className="notice" role="status">
              {input.splitConfirmed
                ? "Geprüfte Kartenanteile aus der Foto-Abrechnung übernommen."
                : "Belegumsatz übernommen. Ohne vollständige Kartenarten-Aufteilung bleibt der Kartenmix eine Schätzung bzw. ein unbekannter Anteil."}
            </p>
          )}
          <div className="mini-stats">
            <div><span>Für Zahlungen Plus geeignete Karten</span><b>{input.monthlyVolume > 0 ? round((input.mix.domesticDebit + input.mix.domesticCredit) / input.monthlyVolume * 100) : 0} %</b></div>
            <div><span>Andere / unbekannte Karten inkl. Online</span><b>{input.monthlyVolume > 0 ? round((input.monthlyVolume - input.mix.domesticDebit - input.mix.domesticCredit) / input.monthlyVolume * 100) : 0} %</b></div>
          </div>
          <details open={manualMixOpen} onToggle={(e) => setManualMixOpen(e.currentTarget.open)}>
            <summary>Manuelle Kartendaten erfassen / korrigieren</summary>
            <p className="hint">Beträge pro Monat in Euro. Die Summe darf den gesamten Kartenumsatz nicht übersteigen.</p>
            <div className="form-grid">
              {keys.map(({ key, label }) => (
                <Field key={key} label={label + " (€)"}>
                  <NumericInput min="0" step=".01" value={input.mix[key]}
                    onChange={(e) => {
                      setMixOrigin("manual");
                      update("mix", { ...input.mix, [key]: num(e.target.value) });
                    }} />
                </Field>
              ))}
            </div>
            <label className="checkbox-field">
              <input type="checkbox" checked={input.splitConfirmed}
                onChange={(e) => update("splitConfirmed", e.target.checked)} />
              Vollständigen Kartenmix anhand der Abrechnung oder Händlerangabe geprüft
            </label>
          </details>
          {result && result.missingMix > 0 && (
            <p className="notice">Noch nicht aufgeteilt: {money(result.missingMix)} des TPV.</p>
          )}
        </Card>
      </div>
      <Card title="04 · Hardware" eyebrow="REGULÄRE NETTOPREISE">
        <MultiChoiceDropdown
          label="Hardware auswählen"
          options={hardwareCatalog.map((item) => ({
            value: item.id,
            label: `${item.name} · ${item.price === null ? "Preis prüfen" : money(item.price) + " netto"}`,
          }))}
          selected={input.hardware.map((item) => item.id)}
          onToggle={toggleHardware}
        />
        {input.hardware.map((selected) => {
          const item = hardwareCatalog.find((x) => x.id === selected.id);
          return <div className="recommendation" key={selected.id}>
            <strong>{item?.name}</strong>
            <button type="button" className="text-link" onClick={() => toggleHardware(selected.id)}>Entfernen</button>
            <div className="form-grid">
              <Field label="Menge">
                <NumericInput min="1" max="100" step="1" value={selected.quantity}
                  onChange={(e) => update("hardware", input.hardware.map((x) =>
                    x.id === selected.id ? { ...x, quantity: num(e.target.value) } : x))} />
              </Field>
              <Field label="Bestätigter Stückpreis netto (€)">
                <NumericInput min="0" step=".01" value={selected.price ?? ""} placeholder="Preis prüfen"
                  onChange={(e) => update("hardware", input.hardware.map((x) =>
                    x.id === selected.id ? { ...x, price: e.target.value === "" ? null : num(e.target.value) } : x))} />
              </Field>
            </div>
          </div>;
        })}
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
        <MultiChoiceDropdown
          label="Lizenzen auswählen"
          options={subscriptions.map((item) => ({
            value: item.id,
            label: `${item.name} · ${item.monthly === null ? "Preis prüfen" : money(item.monthly) + " / Monat"}`,
          }))}
          selected={input.subscriptions.map((item) => item.id)}
          onToggle={toggleSubscription}
        />
        {input.subscriptions.map((chosen) => {
          const license = subscriptions.find((s) => s.id === chosen.id);
          return <div className="recommendation" key={chosen.id}>
            <strong>{license?.name}</strong>
            <button type="button" className="text-link" onClick={() => toggleSubscription(chosen.id)}>Entfernen</button>
            <Field label="Bestätigte Monatskosten netto (€)">
              <NumericInput min="0" step=".01" value={chosen.monthly ?? ""} placeholder="Preis prüfen"
                onChange={(e) => update("subscriptions", input.subscriptions.map((x) =>
                  x.id === chosen.id ? { ...x, monthly: e.target.value === "" ? null : num(e.target.value) } : x))} />
            </Field>
          </div>;
        })}
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
            <Field label="SumUp-Tarif auswählen">
              <select value={planId || result.best.id} onChange={(e) => setPlanId(e.target.value)}>
                {result.plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.title}{plan.id === result.best.id ? " · niedrigste 12-Monats-Kosten" : ""}</option>
                ))}
              </select>
            </Field>
            {result.plans.map((plan) => (
              <div className="cost-row" key={plan.id}>
                <span>{plan.title}</span>
                <strong>{money(plan.monthly)} / Monat<br /><small>Jahr 1 inkl. Hardware: {money(plan.year)}</small></strong>
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
