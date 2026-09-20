import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { dateLabel } from "../lib/calculations";
import type { ClientDocument } from "../lib/documents";
import { Field } from "./UI";

export function Documents({ customerId }: { customerId: string }) {
  const {
    listDocuments,
    uploadDocument,
    downloadDocument,
    removeDocument,
    demo,
  } = useStore();
  const [files, setFiles] = useState<ClientDocument[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [selected, setSelected] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const mounted = useRef(false);
  const loader = useRef(listDocuments);
  loader.current = listDocuments;
  useEffect(() => {
    mounted.current = true;
    let active = true;
    loader
      .current(customerId)
      .then((rows) => {
        if (active) setFiles(rows);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [customerId]);
  async function action(job: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await job();
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="detail-block" aria-label="Private Dokumentenablage">
      <h3>Dokumentenablage</h3>
      <p className="hint">
        Kontaktunterlagen und Gesprächsprotokolle · nur für dein Konto. PDF,
        JPG, PNG, WebP oder TXT, maximal 10 MB. Keine öffentliche Freigabe.
        Dateien vor dem Hochladen auf Schadsoftware prüfen; ein Virenscanner ist
        nicht integriert.
      </p>
      {demo && (
        <p className="notice">
          Demo: Dateien bleiben im Arbeitsspeicher und verschwinden beim
          Neuladen.
        </p>
      )}
      <Field label="Dokument auswählen">
        <input
          ref={input}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
          disabled={busy}
          onChange={(e) => setSelected(e.target.files?.[0] || null)}
        />
      </Field>
      <button
        className="secondary"
        disabled={busy || !selected}
        onClick={() =>
          void action(async () => {
            if (!selected) return;
            const document = await uploadDocument(customerId, selected);
            if (!mounted.current) return;
            setFiles((rows) => [document, ...rows]);
            setSelected(null);
            if (input.current) input.current.value = "";
            setMessage("Dokument gespeichert.");
          })
        }
      >
        {busy ? "Dateivorgang läuft …" : "Dokument hochladen"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {
        <p className="muted">
          {!files.length && "Noch keine Dokumente geladen. "}
          <button
            className="text-link"
            disabled={busy}
            onClick={() =>
              void action(async () => setFiles(await listDocuments(customerId)))
            }
          >
            Liste neu laden
          </button>
        </p>
      }
      {files.map((file) => (
        <div className="document-row" key={file.path}>
          <div className="grow">
            <strong>{file.name}</strong>
            <small>
              {dateLabel(file.created_at)} · {Math.ceil(file.size / 1024)} KB
            </small>
          </div>
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              aria-label={file.name + " herunterladen"}
              onClick={() =>
                void action(async () => {
                  const blob = await downloadDocument(customerId, file.path);
                  const url = URL.createObjectURL(blob),
                    a = document.createElement("a");
                  a.href = url;
                  a.download = file.name;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                })
              }
            >
              Herunterladen
            </button>
            <button
              className="text-button"
              disabled={busy}
              aria-label={file.name + " löschen"}
              onClick={() => {
                if (
                  !window.confirm(
                    `„${file.name}“ endgültig löschen? Die Datei kann im CRM nicht wiederhergestellt werden.`,
                  )
                )
                  return;
                void action(async () => {
                  await removeDocument(customerId, file.path);
                  if (mounted.current) {
                    setFiles((rows) =>
                      rows.filter((r) => r.path !== file.path),
                    );
                    setMessage("Dokument endgültig gelöscht.");
                  }
                });
              }}
            >
              Löschen
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
