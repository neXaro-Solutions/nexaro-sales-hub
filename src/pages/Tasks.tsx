import { useState } from "react";
import { Plus, Check, Pencil } from "lucide-react";
import { useStore } from "../lib/store";
import { Card, DivisionBadge, Empty } from "../components/UI";
import { TaskForm } from "../components/Forms";
import { dateLabel, today, dayKey } from "../lib/calculations";
import type { Task, Division } from "../lib/types";
import { appointmentLabel } from "../lib/appointments";
export function Tasks({ division }: { division?: Division }) {
  const { data, save } = useStore();
  const [filter, setFilter] = useState("open"),
    [edit, setEdit] = useState<Task | true | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const rows = data.tasks
    .filter(
      (t) =>
        !division ||
        t.division === division ||
        (!t.division &&
          data.opportunities.some(
            (o) => o.customer_id === t.customer_id && o.division === division,
          )),
    )
    .filter(
      (t) =>
        filter === "all" ||
        (filter === "done"
          ? t.done
          : !t.done && (filter !== "today" || dayKey(t.due_at) <= today())),
    )
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  return (
    <>
      <div className="section-intro">
        <div>
          <h1>Termine & Wiedervorlagen</h1>
          <p>Aus jedem Kontakt wird ein konkreter nächster Schritt.</p>
        </div>
        <button className="primary" onClick={() => setEdit(true)}>
          <Plus size={17} /> Neue Aufgabe
        </button>
      </div>
      <div className="tabs">
        {[
          ["open", "Offen"],
          ["today", "Heute & überfällig"],
          ["done", "Erledigt"],
          ["all", "Alle"],
        ].map(([k, v]) => (
          <button
            className={filter === k ? "active" : ""}
            key={k}
            onClick={() => setFilter(k)}
          >
            {v}
          </button>
        ))}
      </div>
      <Card>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {rows.length ? (
          rows.map((t) => (
            <div className="task-row" key={t.id}>
              <button
                disabled={busy === t.id}
                className={"check-button " + (t.done ? "checked" : "")}
                aria-label={
                  t.title + (t.done ? " wieder öffnen" : " erledigen")
                }
                onClick={async () => {
                  setBusy(t.id);
                  try {
                    await save("tasks", { ...t, done: !t.done });
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy("");
                  }
                }}
              >
                <Check size={17} />
              </button>
              <div className="grow">
                <strong>{t.title}</strong>
                <small>
                  {data.customers.find((c) => c.id === t.customer_id)
                    ?.company || "Allgemein"}{" "}
                  · {appointmentLabel(t.due_at)} · {t.kind || "Aufgabe"}
                </small>
                {t.notes && <p className="prewrap">{t.notes}</p>}
              </div>
              {t.division && <DivisionBadge division={t.division} />}
              <button
                className="icon-button"
                aria-label={t.title + " bearbeiten"}
                onClick={() => setEdit(t)}
              >
                <Pencil size={17} />
              </button>
            </div>
          ))
        ) : (
          <Empty title="Keine Aufgaben in dieser Ansicht" />
        )}
      </Card>
      {edit && (
        <TaskForm
          task={edit === true ? undefined : edit}
          division={division}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
