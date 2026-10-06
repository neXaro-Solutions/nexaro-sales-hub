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
type FeeProfileId = "standard" | "plus" | "campaign-099" | "campaign-139" | "campaign-129" | "campaign-119" | "campaign-105" | "campaign-089" | "campaign-085" | "custom";

type FeeProfile = {
  id: FeeProfileId;
  label: string;
  domestic: number;
  international: number;
  cnp: number;
  monthlyFee: number;
  source: "public" | "fee-campaign" | "custom";
  badge?: string;
};

const feeProfiles: FeeProfile[] = [
  { id: "standard", label: "Standard · 1,39 %", domestic: 1.39, international: 1.39, cnp: 2.50, monthlyFee: 0, source: "public" },
  { id: "plus", label: "Zahlungen Plus · 0,79 %", domestic: 0.79, international: 1.39, cnp: 2.50, monthlyFee: 19, source: "public" },
  { id: "campaign-099", label: "Fee Campaign · 0,99 % Domestic", domestic: 0.99, international: 1.99, cnp: 2.50, monthlyFee: 0, source: "fee-campaign", badge: "Empfohlen im Campaign-Screen" },
  { id: "campaign-139", label: "Fee Campaign · 1,39 % Domestic", domestic: 1.39, international: 1.39, cnp: 2.50, monthlyFee: 0, source: "fee-campaign" },
  { id: "campaign-129", label: "Fee Campaign · 1,29 % Domestic", domestic: 1.29, international: 1.99, cnp: 2.50, monthlyFee: 0, source: "fee-campaign" },
  { id: "campaign-119", label: "Fee Campaign · 1,19 % Domestic", domestic: 1.19, international: 1.99, cnp: 2.50, monthlyFee: 0, source: "fee-campaign" },
  { id: "campaign-105", label: "Fee Campaign · 1,05 % Domestic", domestic: 1.05, international: 1.99, cnp: 2.50, monthlyFee: 0, source: "fee-campaign" },
  { id: "campaign-089", label: "Fee Campaign · 0,89 % Domestic", domestic: 0.89, international: 1.99, cnp: 2.50, monthlyFee: 0, source: "fee-campaign" },
  { id: "campaign-085", label: "Fee Campaign · 0,85 % Domestic", domestic: 0.85, international: 1.99, cnp: 2.50, monthlyFee: 0, source: "fee-campaign", badge: "Niedrigste sichtbare Stufe" },
  { id: "custom", label: "Manuelle Sonderkondition", domestic: 0.99, international: 1.99, cnp: 2.50, monthlyFee: 0, source: "custom" },
];

const availableHardware = hardwareCatalog.filter(h => ["tap", "lite", "solo", "terminal", "pos"].includes(h.id));

function recommendedHardware(useCase: NewUseCase, needsReceipt: boolean, withoutPhone: boolean) {
  if (useCase === "pos") return "pos";
  if (needsReceipt || useCase === "busy") return "terminal";
  if (withoutPhone || useCase === "counter") return "solo";
  if (useCase === "mobile") return withoutPhone ? "solo" : "tap";
  return "lite";
}

function clampRate(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

function NewToCardPaymentStudio({ customerId, onOffer, onBack }: { customerId: string; onOffer: (draft: OfferDraft) => void; onBack: () => void }) {
  const { data, save } = useStore();
  const opportunity = data.opportunities.find(o => o.customer_id === customerId && o.division === "sumup");
  const saved = (opportunity?.details?.salesStudio || {}) as any;
  const savedNew = saved?.newCardPayment || {};
  const [volume, setVolume] = useState<number>(Number(savedNew.volume || 3500));
  const [transactions, setTransactions] = useState<number>(Number(savedNew.transactions || 150));
  const [useCase, setUseCase] = useState<NewUseCase>((savedNew.useCase || "simple") as NewUseCase);
  const [needsReceipt, setNeedsReceipt] = useState<boolean>(!!savedNew.needsReceipt);
  const [withoutPhone, setWithoutPhone] = useState<boolean>(!!savedNew.withoutPhone);
  const [hardwareId, setHardwareId] = useState<string>(savedNew.hardwareId || recommendedHardware((savedNew.useCase || "simple") as NewUseCase, !!savedNew.needsReceipt, !!savedNew.withoutPhone));
  const defaultProfile: FeeProfileId = (savedNew.feeProfileId as FeeProfileId) || (Number(savedNew.volume || 3500) >= 3500 ? "plus" : "standard");
  const [feeProfileId, setFeeProfileId] = useState<FeeProfileId>(defaultProfile);
  const initialProfile = feeProfiles.find(p => p.id === defaultProfile) || feeProfiles[0];
  const [customDomestic, setCustomDomestic] = useState<number>(Number(savedNew.fees?.domestic ?? initialProfile.domestic));
  const [customInternational, setCustomInternational] = useState<number>(Number(savedNew.fees?.international ?? initialProfile.international));
  const [customCnp] = useState<number>(2.50);
  const [notes, setNotes] = useState<string>(savedNew.notes || "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (savedNew.hardwareId) return;
    setHardwareId(recommendedHardware(useCase, needsReceipt, withoutPhone));
  }, [useCase, needsReceipt, withoutPhone]);

  useEffect(() => {
    if (savedNew.feeProfileId || feeProfileId === "custom" || feeProfileId.startsWith("campaign-")) return;
    setFeeProfileId(volume >= 3500 ? "plus" : "standard");
  }, [volume]);

  const selectedProfile = feeProfiles.find(p => p.id === feeProfileId) || feeProfiles[0];
  const fees = useMemo(() => {
    if (feeProfileId !== "custom") return selectedProfile;
    return {
      ...selectedProfile,
      domestic: clampRate(customDomestic, 0.79, 1.39),
      international: clampRate(customInternational, 1.39, 1.99),
      cnp: customCnp,
    };
  }, [feeProfileId, selectedProfile, customDomestic, customInternational, customCnp]);

  const estimate = useMemo(() => {
    const safeVolume = Number.isFinite(volume) && volume > 0 ? volume : 0;
    const standard = round(safeVolume * 0.0139);
    const plus = round(safeVolume * 0.0079 + 19);
    const selectedDomestic = round(safeVolume * (fees.domestic / 100) + fees.monthlyFee);
    const tariff = feeProfileId === "custom" || feeProfileId.startsWith("campaign-") ? "campaign" : feeProfileId;
    return { standard, plus, selectedDomestic, tariff };
  }, [volume, fees, feeProfileId]);

  const hardware = availableHardware.find(h => h.id === hardwareId) || availableHardware.find(h => h.id === "lite")!;
  const recommendation = volume >= 10000
    ? "Ab 10.000 € monatlichem Kartenumsatz nennt SumUp öffentlich individuelle Konditionen. Fee-Campaign-Sätze nur verwenden, wenn sie im aktuellen SumUp-Angebotsprozess für den Händler tatsächlich auswählbar bzw. freigegeben sind."
    : feeProfileId.startsWith("campaign-") || feeProfileId === "custom"
      ? "Vertriebs-/Kampagnenkondition aktiv. Domestic, International/Premium/Corporate und Karte-nicht-anwesend werden getrennt dokumentiert. Die SumUp-Angebotsmaske bleibt die verbindliche Freigabeinstanz."
      : feeProfileId === "plus"
        ? "Zahlungen Plus ist ab 3.500 € erwartetem Kartenumsatz eine sinnvolle Ausgangsbasis. 0,79 % gelten für geeignete EWR-Verbraucherkarten; Nicht-EWR-, Firmen- und Premiumkarten werden öffentlich mit 1,39 % geführt."
        : "Umsatzbasiertes Zahlen mit 1,39 % ist die öffentliche Standardbasis ohne monatliche Tarifgrundgebühr.";

  function chooseFeeProfile(id: FeeProfileId) {
    setFeeProfileId(id);
    const profile = feeProfiles.find(p => p.id === id);
    if (profile && id !== "custom") {
      setCustomDomestic(profile.domestic);
      setCustomInternational(profile.international);
    }
  }

  async function persist() {
    if (!customerId) { setNotice("Bitte zuerst einen Kunden auswählen."); return; }
    setSaving(true); setNotice("");
    try {
      const payload = {
        entryMode: "new",
        newCardPayment: {
          volume, transactions, useCase, needsReceipt, withoutPhone, hardwareId: hardware.id,
          tariff: estimate.tariff, feeProfileId, fees: { domestic: fees.domestic, international: fees.international, cnp: fees.cnp, monthlyFee: fees.monthlyFee },
          notes, checkedAt: catalogCheckedAt
        }
      };
      await save("opportunities", {
        ...opportunity,
        customer_id: customerId,
        division: "sumup",
        stage: opportunity?.stage || "Neu",
        potential: volume,
        details: { ...(opportunity?.details || {}), salesStudio: { ...(opportunity?.details?.salesStudio || {}), ...payload } }
      });
      setNotice("Neueinstieg-Kalkulation inklusive Gebührenprofil in der Kundenakte gespeichert.");
    } catch (e) {
      setNotice("Speichern fehlgeschlagen: " + (e instanceof Error ? e.message : "Unbekannter Fehler"));
    } finally { setSaving(false); }
  }

  function createOffer() {
    if (!customerId || volume <= 0 || transactions < 0) { setNotice("Bitte Kunde, erwarteten Kartenumsatz und Transaktionen prüfen."); return; }
    const lines = hardware.price === null ? [] : [{ name: `SumUp ${hardware.name} · Hardware`, quantity: 1, price: hardware.price, vat: 19 }];
    onOffer({
      division: "sumup",
      customer_id: customerId,
      lines,
      notes: [
        "NEUEINSTIEG KARTENZAHLUNG – kein Bestandsanbieter und keine Ist-Gebühren vorhanden.",
        `Erwarteter Kartenumsatz: ${money(volume)} / Monat · ca. ${transactions} Transaktionen / Monat.`,
        `Gewähltes Gebührenprofil: ${selectedProfile.label}.`,
        `Domestic / EWR-Verbraucherkarten: ${fees.domestic.toFixed(2).replace(".", ",")} %.`,
        `International / Premium / Corporate: ${fees.international.toFixed(2).replace(".", ",")} %.`,
        `Karte nicht anwesend / Online: ${fees.cnp.toFixed(2).replace(".", ",")} %.`,
        fees.monthlyFee ? `Zusätzliche Tarifgebühr: ${money(fees.monthlyFee)} / Monat.` : "Keine zusätzliche monatliche Tarifgebühr in dieser CRM-Kalkulation hinterlegt.",
        `Rechnerische Orientierung bei vollständig Domestic-volumen: ${money(estimate.selectedDomestic)} / Monat.`,
        `Hardware: ${hardware.name}${hardware.price !== null ? ` · ${money(hardware.price)} netto` : " · Preis vor Angebot prüfen"}.`,
        feeProfileId.startsWith("campaign-") || feeProfileId === "custom" ? "Fee-Campaign-/Sonderkondition: nur verwenden, wenn dieser Satz im aktuellen SumUp-Angebotsprozess für den Händler auswählbar bzw. freigegeben ist. Das CRM erteilt keine Konditionsfreigabe." : "Öffentliche SumUp-Tarifbasis verwendet.",
        "Wichtig: Kein Ausweis einer Ersparnis gegenüber einem bisherigen Anbieter, da keine Vergleichsbasis existiert. Tatsächliche Kartenklassifizierung und verbindliche Konditionen vor Abschluss prüfen.",
        `Preisstand ${catalogCheckedAt} · ${catalogSource}`,
        notes
      ].filter(Boolean).join("\n"),
      snapshot: { salesStudio: { entryMode: "new", newCardPayment: { volume, transactions, useCase, needsReceipt, withoutPhone, hardwareId: hardware.id, tariff: estimate.tariff, feeProfileId, fees, costs: estimate, checkedAt: catalogCheckedAt, source: catalogSource, hardwareSource: catalogHardwareSource } } }
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
      </div>
      <label className="checkbox-field"><input type="checkbox" checked={withoutPhone} onChange={e => setWithoutPhone(e.target.checked)}/> Kartenzahlung soll ohne gekoppeltes Smartphone funktionieren</label>
      <label className="checkbox-field"><input type="checkbox" checked={needsReceipt} onChange={e => setNeedsReceipt(e.target.checked)}/> Gedruckte Belege direkt am Gerät sind wichtig</label>
    </Card>

    <Card title="02 · Gebühren & passende Ausgangsbasis" eyebrow="SUMUP · TARIF / FEE CAMPAIGN">
      <Field label="Gebührenprofil"><select value={feeProfileId} onChange={e => chooseFeeProfile(e.target.value as FeeProfileId)}>
        <optgroup label="Öffentliche SumUp-Tarife">
          {feeProfiles.filter(p => p.source === "public").map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </optgroup>
        <optgroup label="Fee Campaign · laut aktuellem SumUp-Angebotsscreen">
          {feeProfiles.filter(p => p.source === "fee-campaign").map(p => <option key={p.id} value={p.id}>{p.label}{p.badge ? ` · ${p.badge}` : ""}</option>)}
        </optgroup>
        <option value="custom">Manuelle Sonderkondition</option>
      </select></Field>

      <div className="mini-stats">
        <div className="is-recommended"><span>Domestic / EWR-Verbraucher</span><b>{fees.domestic.toFixed(2).replace(".", ",")} %</b></div>
        <div><span>International / Premium / Corporate</span><b>{fees.international.toFixed(2).replace(".", ",")} %</b></div>
        <div><span>Karte nicht anwesend / Online</span><b>{fees.cnp.toFixed(2).replace(".", ",")} %</b></div>
      </div>

      {feeProfileId === "custom" && <div className="form-grid">
        <Field label="Domestic (%)"><input type="number" min="0.79" max="1.39" step="0.01" value={customDomestic} onChange={e => setCustomDomestic(Number(e.target.value))}/></Field>
        <Field label="International / Premium / Corporate (%)"><input type="number" min="1.39" max="1.99" step="0.01" value={customInternational} onChange={e => setCustomInternational(Number(e.target.value))}/></Field>
        <Field label="Karte nicht anwesend / Online (%)"><input type="number" value={customCnp} disabled /></Field>
      </div>}

      <p className="notice"><strong>Einordnung:</strong> {recommendation}</p>
      <p className="hint">Fee-Campaign-Stufen aus dem aktuellen SumUp-Angebotsscreen: Domestic 1,39 / 1,29 / 1,19 / 1,05 / 0,99 / 0,89 / 0,85 %. Bei den gezeigten reduzierten Domestic-Stufen wird International/Premium/Corporate mit 1,99 % ausgewiesen; beim 1,39-%-Profil mit 1,39 %. Karte nicht anwesend bleibt im gezeigten Screen bei 2,50 %. Öffentliche Standard-/Plus-Sätze können davon abweichen. Sonderkonditionen immer im SumUp-Prozess final bestätigen.</p>
      <p className="hint"><strong>Rechnerische Orientierung:</strong> Bei vollständig Domestic-volumen wären es mit dem gewählten Profil ca. {money(estimate.selectedDomestic)} / Monat{fees.monthlyFee ? ` inkl. ${money(fees.monthlyFee)} Tarifgebühr` : ""}.</p>
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