import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { X, ArrowUpRight, CheckCircle2, LoaderCircle } from "lucide-react";
export function Brand() {
  return (
    <div className="brand" aria-label="neXaro Solutions">
      <div>
        ne<span>X</span>aro
      </div>
      <small>SOLUTIONS</small>
    </div>
  );
}
export function Card({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"card " + className}>
      {(title || action) && (
        <div className="card-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">＋</div>
      <h3>{title}</h3>
      <p>{children || "Hier erscheinen deine gespeicherten Einträge."}</p>
    </div>
  );
}
export function Badge({
  children,
  kind = "neutral",
}: {
  children: ReactNode;
  kind?: string;
}) {
  return <span className={"badge " + kind}>{children}</span>;
}
export function DivisionBadge({ division }: { division: string }) {
  return (
    <Badge kind={division}>{division === "sumup" ? "SumUp" : "Vapes"}</Badge>
  );
}
export function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon?: ReactNode;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        {label}
        {icon || <ArrowUpRight size={17} />}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Schließen"
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function AsyncForm({
  onSubmit,
  children,
  label = "Speichern",
}: {
  onSubmit: (data: FormData) => Promise<void>;
  children: ReactNode;
  label?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vorgang fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        {children}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="primary" type="submit">
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}{" "}
            {busy ? "Wird gespeichert …" : label}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export const value = (f: FormData, k: string) => String(f.get(k) || "").trim();
export const number = (f: FormData, k: string) => Number(f.get(k) || 0);
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function External({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      className="text-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children} <ArrowUpRight size={14} />
    </a>
  );
}
