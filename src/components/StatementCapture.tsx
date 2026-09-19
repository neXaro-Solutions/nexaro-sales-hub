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
    try {
      const result = extractStatement(raw);
      setParsed(result);
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
  return (
    <Modal title="Händlerabrechnung erfassen" onClose={onClose}>
      <p>
        Foto oder Kameraaufnahme wählen. Die Texterkennung läuft auf deinem
        Gerät. Das Foto und der vollständige Belegtext werden nicht im CRM
        gespeichert.
      </p>
      <Field label="Abrechnungsfoto (JPG / PNG / WebP)">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
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
                setProgress,
              );
              if (!controller.signal.aborted) {
                setText(result.text);
                setConfidence(result.confidence);
                parse(result.text);
              }
            } catch (e) {
              if (!controller.signal.aborted) setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
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
              onApply(p, {
                confirmedAt: new Date().toISOString(),
                months,
                source,
                confidence,
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
