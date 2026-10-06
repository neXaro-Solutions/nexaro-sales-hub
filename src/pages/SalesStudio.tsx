import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Save } from "lucide-react";
import { SalesStudio as ExistingSalesStudio } from "./SalesStudioLegacy";
import type { PaymentInput } from "../lib/calculations";
import { money, round } from "../lib/calculations";
import type { IncomingSumupInquiry } from "../lib/incomingSumupInquiry";
import type { StatementReview } from "../components/StatementCapture";
import type { OfferDraft } from "./Offers";
import { Card, Field, External } from "../components/UI";
import { RangeNumber } from "../components/RangeNumber";
import { useStore } from "../lib/store";
import { catalogCheckedAt, catalogHardwareSource, catalogSource, hardwareCatalog } from "../lib/sumup-sales";

type Props = {
  inquiry: IncomingSumupInquiry | null;
  customerId: string;
  photoInput: PaymentInput;
  photoAvailable: boolean;
  photoReview: StatementReview | null;
  onCapture: () => void;
  onOffer: (draft: OfferDraft) => void;
  step: 1 | 2 | 3;
  setStep: (step: 1 | 2 | 3) => void;
};
type EntryMode = "existing" | "new";
type NewUseCase = "simple" | "mobile" | "counter" | "busy" | "pos";

const availableHardware = hardwareCatalog.filter(h => ["tap", "lite", "solo", "terminal", "pos"].includes(h.id));

function recommendedHardware(useCase: NewUseCase, needsReceipt: boolean, withoutPhone: boolean) {
  if (useCase === "pos") return "pos";
  if (needsReceipt || useCase === "busy") return "terminal";
  if (withoutPhone || useCase === "counter") return "solo";
  if (useCase === "mobile") return withoutPhone ? "solo" : "tap";
  return "lite";
}

function NewToCardPaymentStudio({ customerId, onOffer, onBack }: { customerId: string; onOffer: (draft: OfferDraft) => void; onBack: () => void }) {
  const { data, save } = useStore();
  const opportunity = data.opportunities.find(o => o.customer_id === customerId && o.division === "sumup");
  const saved = (opportunity?.details?.salesStudio || {}) as any;
  const savedNew = saved?.newCardPayment || {};
  const [volume, setVolume] = useState<number>(Number(savedNew.volume || 3500));
  const [transactions, setTransactions] = useState<number>(Number(savedNew.transactions || 150));
  const [eligibleShare, setEligibleShare] = useState<number>(Number(savedNew.eligibleShare ?? 90));
  const [useCase, setUseCase] = useState<NewUseCase>((savedNew.useCase || "simple") as NewUseCase);
  const [needsReceipt, setNeedsReceipt] = useState<boolean>(!!savedNew.needsReceipt);
  const [withoutPhone, setWithoutPhone] = useState<boolean>(!!savedNew.withoutPhone);
  const [hardwareId, setHardwareId] = useState<string>(savedNew.hardwareId || recommendedHardware((savedNew.useCase || "simple") as NewUseCase, !!savedNew.needsReceipt, !!savedNew.withoutPhone));
  const [notes, setNotes] = useState<string>(savedNew.notes || "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (savedNew.hardwareId) return;
    setHardwareId(recommendedHardware(useCase, needsReceipt, withoutPhone));
  }, [useCase, needsReceipt, withoutPhone]);

  const estimate = useMemo(() => {
    const safeVolume = Number.isFinite(volume) && volume > 0 ? volume : 0;
    const safeShare = Math.min(100, Math.max(0, Number.isFinite(eligibleShare) ? eligibleShare : 0));
    const standard = round(safeVolume * 0.0139);
    const plus = round(safeVolume * safeShare / 100 * 0.0079 + safeVolume * (100 - safeShare) / 100 * 0.0139 + 19);
    const plusAnnualEquivalent = round(safeVolume * safeShare / 100 * 0.0079 + safeVolume * (100 - safeShare) / 100 * 0.0139 + 199 / 12);
    const tariff = safeVolume >= 10000 ? "individual" : safeVolume >= 3500 && plus < standard ? "plus" : "standard";
    return { standard, plus, plusAnnualEquivalent, tariff };
  }, [volume, eligibleShare]);

  const hardware = availableHardware.find(h => h.id === hardwareId) || availableHardware.find(h => h.id === "lite")!;
  const recommendation = estimate.tariff === "individual"
    ? "Ab 10.000 € monatlichem Kartenumsatz nennt SumUp individuelle Konditionen. Für das Angebot deshalb persönliche Konditionen anfragen; die Standardwerte unten dienen nur als Orientierung."
    : estimate.tariff === "plus"
      ? "Zahlungen Plus ist anhand deiner Annahmen voraussichtlich günstiger. Die tatsächliche Kartenklassifizierung und Tarifberechtigung vor Abschluss prüfen."
      : "Umsatzbasiertes Zahlen ist für diesen erwarteten Kartenumsatz die einfachere bzw. günstigere Ausgangsbasis – ohne monatliche Tarifgrundgebühr.";

  async function persist() {
    if (!customerId) { setNotice("Bitte zuerst einen Kunden auswählen."); return; }
    setSaving(true); setNotice("");
    try {
      const payload = { entryMode: "new", newCardPayment: { volume, transactions, eligibleShare, useCase, needsReceipt, withoutPhone, hardwareId: hardware.id, notes, checkedAt: catalogCheckedAt } };
      await save("opportunities", {
        ...opportunity,
        customer_id: customerId,
        division: "sumup",
        stage: opportunity?.stage || "Neu",
        potential: volume,
        details: { ...(opportunity?.details || {}), salesStudio: { ...(opportunity?.details?.salesStudio || {}), ...payload } }
      });
      setNotice("Neueinstieg-Kalkulation in der Kundenakte gespeichert.");
    } catch (e) {
      setNotice("Speichern fehlgeschlagen: " + (e instanceof Error ? e.message : "Unbekannter Fehler"));
    } finally { setSaving(false); }
  }

  function createOffer() {
    if (!customerId || volume <= 0 || transactions < 0) { setNotice("Bitte Kunde, erwarteten Kartenumsatz und Transaktionen prüfen."); return; }
    const tariffName = estimate.tariff === "individual" ? "Individuelle SumUp Konditionen anfragen" : estimate.tariff === "plus" ? "Zahlungen Plus" : "Umsatzbasiertes Zahlen";
    const monthly = estimate.tariff === "plus" ? estimate.plus : estimate.standard;
    const lines = hardware.price === null ? [] : [{ name: `SumUp ${hardware.name} · Hardware`, quantity: 1, price: hardware.price, vat: 19 }];
    onOffer({
      division: "sumup",
      customer_id: customerId,
      lines,
      notes: [
        "NEUEINSTIEG KARTENZAHLUNG – kein Bestandsanbieter und keine Ist-Gebühren vorhanden.",
        `Erwarteter Kartenumsatz: ${money(volume)} / Monat · ca. ${transactions} Transaktionen / Monat.`,
        `Planungsannahme berechtigte inländische/EWR-Verbraucherkarten für Zahlungen Plus: ${eligibleShare} %.`,
        `Orientierung Umsatzbasiertes Zahlen: ${money(estimate.standard)} / Monat bei 1,39 %.`,
        `Orientierung Zahlungen Plus (Monatsabo): ${money(estimate.plus)} / Monat bei 0,79 % auf angenommene berechtigte Zahlungen, 1,39 % sonstige Karten und 19 € / Monat.`,
        `Orientierung Zahlungen Plus (Jahresabo rechnerisch): ${money(estimate.plusAnnualEquivalent)} / Monat bei 199 € / Jahr.`,
        `Empfohlene Ausgangsbasis: ${tariffName}. Erwartete Zahlungskosten: ${money(monthly)} / Monat.`,
        `Hardware: ${hardware.name}${hardware.price !== null ? ` · ${money(hardware.price)} netto` : " · Preis vor Angebot prüfen"}.`,
        "Wichtig: Kein Ausweis einer Ersparnis gegenüber einem bisherigen Anbieter, da keine Vergleichsbasis existiert. Tatsächlicher Kartenmix, Kartenklassifizierung und verbindliche Konditionen vor Abschluss prüfen.",
        `Preisstand ${catalogCheckedAt} · ${catalogSource}`,
        notes
      ].filter(Boolean).join("\n"),
      snapshot: { salesStudio: { entryMode: "new", newCardPayment: { volume, transactions, eligibleShare, useCase, needsReceipt, withoutPhone, hardwareId: hardware.id, tariff: estimate.tariff, costs: estimate, checkedAt: catalogCheckedAt, source: catalogSource, hardwareSource: catalogHardwareSource } } }
    });
  }

  return <div className="sales-studio field-studio">
    <div className="section-intro"><div>
      <span className="eyebrow">NE X A R O · NEUEINSTIEG KARTENZAHLUNG</span>
      <h2>Ich nutze noch keine Kartenzahlung</h2>
      <p>Keine künstlichen Vergleichswerte: Wir kalkulieren erwartete Kosten, passenden Tarif und Hardware aus dem geplanten Einsatz.</p>
    </div><External href={catalogSource}>Aktuelle SumUp-Preise prüfen</External></div>

    <Card title="01 · Erwarteter Einsatz" eyebrow="PLANUNG STATT BESTANDSVERGLEICH">
      <p className="notice"><strong>Wichtig:</strong> Da noch keine Kartenzahlung genutzt wird, gibt es keine „bisherigen Gebühren“ und keine belastbare Ersparnis. Die Werte hier sind eine transparente Planung für den Einstieg.</p>
      <div className="form-grid">
        <RangeNumber label="Erwarteter Kartenumsatz / Monat" value={volume} onChange={setVolume} max={100000} step={100} unit="€" />
        <RangeNumber label="Erwartete Transaktionen / Monat" value={transactions} onChange={setTransactions} max={5000} step={1} />
        <Field label="Einsatz im Alltag"><select value={useCase} onChange={e => setUseCase(e.target.value as NewUseCase)}>
          <option value="simple">Einfach starten / gelegentliche Zahlungen</option>
          <option value="mobile">Mobil beim Kunden / unterwegs</option>
          <option value="counter">Fester Tresen / Laden</option>
          <option value="busy">Gastronomie / hoher Durchsatz</option>
          <option value="pos">Kasse mit Warenkorb / zwei Displays</option>
        </select></Field>
        <Field label="Anteil berechtigte Karten für Plus – Planungsannahme (%)"><input type="number" min="0" max="100" step="1" value={eligibleShare} onChange={e => setEligibleShare(Number(e.target.value))}/></Field>
      </div>
      <label className="checkbox-field"><input type="checkbox" checked={withoutPhone} onChange={e => setWithoutPhone(e.target.checked)}/> Kartenzahlung soll ohne gekoppeltes Smartphone funktionieren</label>
      <label className="checkbox-field"><input type="checkbox" checked={needsReceipt} onChange={e => setNeedsReceipt(e.target.checked)}/> Gedruckte Belege direkt am Gerät sind wichtig</label>
    </Card>

    <Card title="02 · Kosten & passende Ausgangsbasis" eyebrow="SUMUP · MODELLRECHNUNG">
      <div className="mini-stats">
        <div><span>Umsatzbasiert</span><b>{money(estimate.standard)} / Monat</b></div>
        <div><span>Zahlungen Plus · monatlich</span><b>{money(estimate.plus)} / Monat</b></div>
        <div><span>Zahlungen Plus · Jahresabo rechnerisch</span><b>{money(estimate.plusAnnualEquivalent)} / Monat</b></div>
      </div>
      <p className="notice"><strong>Empfehlung:</strong> {recommendation}</p>
      <p className="hint">SumUp nennt auf der zentralen Preisübersicht 1,39 % ohne monatliche Tarifgrundgebühr, Zahlungen Plus mit 0,79 % für berechtigte inländische Zahlungen plus 19 € / Monat bzw. 199 € / Jahr und individuelle Konditionen ab 10.000 € Monatsumsatz. Karten außerhalb der Plus-Berechtigung können weiterhin mit 1,39 % berechnet werden.</p>
    </Card>

    <Card title="03 · Hardware" eyebrow="PASSEND ZUM EINSATZ">
      <Field label="Empfohlene / gewählte Hardware"><select value={hardwareId} onChange={e => setHardwareId(e.target.value)}>
        {availableHardware.map(h => <option key={h.id} value={h.id}>{h.name}{h.price !== null ? ` · ${money(h.price)} netto` : " · Preis prüfen"}</option>)}
      </select></Field>
      <p className="hint">Aktuelle öffentliche Orientierung: Tap to Pay 0 €, Solo Lite 22 €, Solo 59 €, Terminal 139 €, SumUp Kasse 399 €. Aktionspreise und Verfügbarkeit vor Bestellung erneut prüfen.</p>
      <Field label="Notizen / besondere Anforderungen"><textarea rows={3} maxLength={2500} value={notes} onChange={e => setNotes(e.target.value)} placeholder="z. B. mehrere Standorte, Tischservice, Drucker, Kassenbedarf …"/></Field>
      <div className="button-row field-actions">
        <button className="secondary" type="button" onClick={onBack}><ArrowLeft size={15}/> Ausgangslage ändern</button>
        <button className="secondary" type="button" disabled={saving || !customerId} onClick={() => void persist()}><Save size={15}/>{saving ? "Speichern …" : "Planung speichern"}</button>
        <button className="primary" type="button" disabled={!customerId || volume <= 0} onClick={createOffer}><FileText size={16}/> Einstiegsangebot erstellen</button>
      </div>
      {notice && <p role="status" className="notice">{notice}</p>}
    </Card>
  </div>;
}

export function SalesStudio(props: Props) {
  const { data } = useStore();
  const opportunity = data.opportunities.find(o => o.customer_id === props.customerId && o.division === "sumup");
  const studio = (opportunity?.details?.salesStudio || {}) as any;
  const inferred: EntryMode | null = studio.entryMode === "new" ? "new" : (studio.current || studio.provider || studio.competitorHardware ? "existing" : null);
  const [mode, setMode] = useState<EntryMode | null>(inferred);

  useEffect(() => { setMode(inferred); }, [props.customerId]);

  if (mode === "existing") return <ExistingSalesStudio {...props} />;
  if (mode === "new") return <NewToCardPaymentStudio customerId={props.customerId} onOffer={props.onOffer} onBack={() => setMode(null)} />;

  return <div className="sales-studio field-studio">
    <div className="section-intro"><div>
      <span className="eyebrow">NE X A R O · AUSGANGSLAGE</span>
      <h2>Wie nimmt der Kunde heute Zahlungen an?</h2>
      <p>Die Auswahl entscheidet bewusst über zwei unterschiedliche Logiken: Bestandsvergleich oder Neueinstieg-Kalkulation.</p>
    </div></div>
    <div className="cards" style={{gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))"}}>
      <Card title="Ich nutze bereits Kartenzahlung" eyebrow="BESTANDSVERGLEICH">
        <p>Abrechnung bzw. aktuelle Konditionen prüfen, Ist-Kosten erfassen und daraus ein nachvollziehbares Vergleichsangebot erstellen.</p>
        <button className="primary" type="button" onClick={() => setMode("existing")}>Bestehende Lösung vergleichen →</button>
      </Card>
      <Card title="Ich nutze noch keine Kartenzahlung" eyebrow="NEUEINSTIEG">
        <p>Erwarteten Kartenumsatz, Transaktionen und Einsatzbedarf erfassen. Danach werden voraussichtliche SumUp-Kosten und passende Hardware kalkuliert – ohne erfundene Vergleichswerte.</p>
        <button className="primary" type="button" onClick={() => { props.setStep(2); setMode("new"); }}>Kosten & Lösung berechnen →</button>
      </Card>
    </div>
  </div>;
}
