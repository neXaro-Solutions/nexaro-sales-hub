import { useState } from "react";
import { useStore } from "../lib/store";
import { Customers } from "./Customers";
import { Tasks } from "./Tasks";
import { VapeCatalog } from "./VapeCatalog";
import { Metric } from "../components/UI";
import { dayKey, today } from "../lib/calculations";
export function Dealers() {
  const { data, demo } = useStore();
  const [tab, setTab] = useState("contacts");
  const ids = new Set(
    data.opportunities
      .filter((o) => o.division === "vape")
      .map((o) => o.customer_id),
  );
  const tasks = data.tasks.filter(
    (t) =>
      !t.done &&
      (t.division === "vape" ||
        (!t.division && t.customer_id && ids.has(t.customer_id))),
  );
  return (
    <>
      <div className="section-intro">
        <div>
          <span className="eyebrow">KONTAKTE. TERMINE. UNTERLAGEN.</span>
          <h1>Händlerverwaltung</h1>
          <p>
            Deine bekannten Händler betreuen – getrennte Kontaktansicht,
            gemeinsame Zentrale.
          </p>
        </div>
      </div>
      <div className="metrics">
        <Metric
          label="Händlerkontakte"
          value={ids.size}
          detail="Verknüpft mit der zentralen Kundenakte"
        />
        <Metric
          label="Offene Wiedervorlagen"
          value={tasks.length}
          detail="In diesem Bereich und zentral zugeordnet"
        />
        <Metric
          label="Heute & überfällig"
          value={tasks.filter((t) => dayKey(t.due_at) <= today()).length}
          detail="Nächste Kontakte im Blick"
        />
      </div>
      <div className="tabs">
        <button
          className={tab === "contacts" ? "active" : ""}
          onClick={() => setTab("contacts")}
        >
          Kontakte & Dokumente
        </button>
        <button className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}>
          Produktkatalog
        </button>
        <button
          className={tab === "tasks" ? "active" : ""}
          onClick={() => setTab("tasks")}
        >
          Termine & Wiedervorlagen
        </button>
      </div>
      {tab === "contacts" ? (
        <Customers division="vape" />
      ) : tab === "catalog" ? (
        <VapeCatalog demo={demo} />
      ) : (
        <Tasks division="vape" />
      )}
    </>
  );
}
