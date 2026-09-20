import { useEffect, useRef, useState } from "react";
import { Modal, Field } from "./UI";
import {
  extractStatement,
  normalizeStatement,
  statementLabels,
  type StatementField,
} from "../lib/statement";
import { recognizeStatement } from "../lib/ocr";
import type { PaymentInput } from "../lib/calculations";
export type StatementReview = {
  confirmedAt: string;
  months: number;
  source: "photo" | "text";
  confidence: number | null;
  eligibleVolume?: number;
  otherVolume?: number;
};
export function StatementCapture({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (p: Partial<PaymentInput>, review: StatementReview) => void;
}) {
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(""),
    [confidence, setConfidence] = useState<number | null>(null),
    [source, setSource] = useState<"photo" | "text">("text"),
    [months, setMonths] = useState(1),
    [eligibleAmount, setEligibleAmount] = useState(""),
    [otherAmount, setOtherAmount] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [parsed, setParsed] = useState<ReturnType<typeof extractStatement> | null>(
      null,
    );
  const [values, setValues] = useState<Record<StatementField, string>>({
    volume: "",
    onlineVolume: "",
    transactions: "",
    costs: "",
  });
  const abortRef = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function parse(raw: string) {
    setParsed(null);
    setReviewed(false);
    setEligibleAmount("");
    setOtherAmount("");
    try {
      const result = extractStatement(raw);
      setParsed(result);
      // Only explicitly labelled card categories qualify; totals are never guessed.
      const categoryAmount = (label: RegExp) => {
        const candidates = raw.split(/\r?\n/).filter((line) => label.test(line));
        if (candidates.length !== 1) return "";
        const matches = candidates[0].match(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g);
        if (!matches || matches.length !== 1) return "";
        return String(Number(matches[0].replace(/\./g, "").replace(",", ".")));
      };
      setEligibleAmount(categoryAmount(/(?:geeignete\s+karten|inl[aä]ndische\s+(?:debit|kredit)karten|domestic\s+(?:debit|credit))/i));
      setOtherAmount(categoryAmount(/(?:sonstige\s+karten|andere\s+karten|nicht\s+geeignete\s+karten)/i));
      setValues(
        Object.fromEntries(
          Object.entries(result).map(([k, v]) => [
            k,
            v.length === 1 ? String(v[0].value) : "",
          ]),
        ) as Record<StatementField, string>,
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function handleFile(file: File | undefined) {
    if (!file) return;
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            setError("");
            setBusy(true);
            setParsed(null);
            setReviewed(false);
            setText("");
            setConfidence(null);
            setSource("photo");
            setProgress(0);
            if (
              ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
              file.size <= 15_000_000
            )
              setPreview(URL.createObjectURL(file));
            else setPreview("");
            try {
              const result = await recognizeStatement(
                file,
                controller.signal,
                (value) => {
                  if (
                    abortRef.current === controller &&
                    !controller.signal.aborted
                  )
                    setProgress(value);
                },
              );
              if (!controller.signal.aborted) {
                setText(result.text);
                setConfidence(result.confidence);
                parse(result.text);
              }
            } catch (e) {
              if (!controller.signal.aborted) setError((e as Error).message);
            } finally {
              if (abortRef.current === controller) setBusy(false);
            }
  }
  return (
    <Modal title="Händlerabrechnung erfassen" onClose={onClose}>
      <p>
        Foto oder Kameraaufnahme wählen. Die Texterkennung läuft auf deinem
        Gerät. Das Foto und der vollständige Belegtext werden nicht im CRM
        gespeichert.
      </p>
      <p className="hint">Zwei getrennte Wege: Datei aus dem Gerätespeicher auswählen oder Kamera direkt öffnen. Die ursprüngliche Schaltfläche erzwang auf manchen Smartphones die Kamera.</p>
      <Field label="Abrechnung aus Dateien / Galerie auswählen (JPG, PNG, WebP)">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
        />
      </Field>
      <Field label="Neues Foto mit der Kamera aufnehmen">
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
          disabled={busy} aria-label="Kamera für Abrechnung öffnen"
          onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      </Field>
      {preview && (
        <img
          className="statement-preview"
          src={preview}
          alt="Ausgewählte Händlerabrechnung zur Prüfung"
        />
      )}
      {busy && (
        <div role="status">
          <p>
            {progress
              ? `Text wird erkannt: ${progress} %`
              : "Texterkennung wird geladen … Beim ersten Foto werden die Sprachdateien heruntergeladen."}
          </p>
          <progress max="100" value={progress} />
          <button
            className="secondary"
            onClick={() => {
              abortRef.current?.abort();
              setBusy(false);
              setError("Texterkennung abgebrochen.");
            }}
          >
            Abbrechen
          </button>
        </div>
      )}
      <Field label="Erkannter Belegtext / Text manuell einfügen">
        <textarea
          rows={6}
          maxLength={100000}
          value={text}
          disabled={busy}
          onChange={(e) => {
            setText(e.target.value);
            setParsed(null);
            setReviewed(false);
            setSource("text");
            setConfidence(null);
          }}
        />
      </Field>
      <button
        className="secondary"
        disabled={busy || !text.trim()}
        onClick={() => parse(text)}
      >
        Werte aus Text erkennen
      </button>
      {confidence !== null && (
        <p className="hint">
          OCR-Zeichensicherheit: {Math.round(confidence)} %. Das ist keine
          Bestätigung der Beträge. Scharfe, gerade Fotos liefern bessere
          Ergebnisse.
        </p>
      )}
      {parsed && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              if (!reviewed)
                throw Error("Bitte Belegwerte und Zeitraum bestätigen.");
              const p = normalizeStatement(values, months);
              const eligible = eligibleAmount.trim() === "" ? undefined : Number(eligibleAmount);
              const other = otherAmount.trim() === "" ? undefined : Number(otherAmount);
              if ([eligible, other].some((n) => n !== undefined && (!Number.isFinite(n) || n < 0)))
                throw Error("Kartenanteile müssen gültige, nichtnegative Beträge sein.");
              if ((eligible ?? 0) + (other ?? 0) > Number(values.volume) + 0.01)
                throw Error("Die Kartenarten dürfen den Vor-Ort-Umsatz nicht überschreiten.");
              onApply(p, {
                confirmedAt: new Date().toISOString(),
                months,
                source,
                confidence,
                eligibleVolume: eligible === undefined ? undefined : Math.round(eligible / months * 100) / 100,
                otherVolume: other === undefined ? undefined : Math.round(other / months * 100) / 100,
              });
              onClose();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <h3>Belegwerte prüfen</h3>
          <p className="notice">
            Alle Werte beziehen sich auf denselben Zeitraum. Auszahlungsbetrag
            ist kein Umsatz. Online-Umsatz nicht doppelt zählen. Kosten netto
            ohne Einmalkäufe vergleichen. Fehlende Werte ergänzen; 0
            ausdrücklich bestätigen.
          </p>
          <Field label="Abgedeckte Monate">
            <input
              required
              type="number"
              min="0.05"
              max="24"
              step="0.01"
              value={months}
              onChange={(e) => {
                setMonths(+e.target.value);
                setReviewed(false);
              }}
            />
          </Field>
          <div className="form-grid">
            {(Object.keys(values) as StatementField[]).map((k) => (
              <div key={k}>
                <Field label={statementLabels[k]}>
                  <input
                    required
                    type="number"
                    min="0"
                    max="1000000000"
                    step={k === "transactions" ? 1 : 0.01}
                    value={values[k]}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [k]: e.target.value }));
                      setReviewed(false);
                    }}
                  />
                </Field>
                {parsed[k].length === 0 ? (
                  <small>Nicht eindeutig erkannt – ergänzen.</small>
                ) : (
                  parsed[k].map((c) => (
                    <button
                      type="button"
                      className="ocr-evidence"
                      key={c.value}
                      onClick={() => {
                        setValues((v) => ({ ...v, [k]: String(c.value) }));
                        setReviewed(false);
                      }}
                    >
                      {c.evidence}
                    </button>
                  ))
                )}
              </div>
            ))}
          </div>
          <details>
            <summary>Kartenarten aus der Abrechnung prüfen (optional)</summary>
            <p className="hint">Nur auf dem Beleg ausgewiesene Beträge eintragen. Ohne Aufschlüsselung verwendet das Vertriebsstudio weiterhin die unbestätigte 80/20-Schätzung. Werte für den gesamten Abrechnungszeitraum, ohne Online-Umsatz.</p>
            <div className="form-grid">
              <Field label="Für Zahlungen Plus geeignete inländische Karten (€)">
                <input type="number" min="0" step="0.01" value={eligibleAmount} onChange={(e) => { setEligibleAmount(e.target.value); setReviewed(false); }} />
              </Field>
              <Field label="Andere / nicht geeignete Karten (€)">
                <input type="number" min="0" step="0.01" value={otherAmount} onChange={(e) => { setOtherAmount(e.target.value); setReviewed(false); }} />
              </Field>
            </div>
          </details>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            Ich habe Beträge, Nettobasis, Zeitraum und Umsatzaufteilung mit dem
            Beleg abgeglichen.
          </label>
          <button className="primary" disabled={!reviewed}>
            Geprüfte Werte übernehmen
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </Modal>
  );
}
