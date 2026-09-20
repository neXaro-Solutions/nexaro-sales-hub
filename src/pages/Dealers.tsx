import { useState } from "react";
import { useStore } from "../lib/store";
import { Customers } from "./Customers";
import { Tasks } from "./Tasks";
import { VapeShop } from "./VapeShop";
import { OfferForm, type OfferDraft } from "./Offers";
import { VapeReviewCatalog } from "./VapeReviewCatalog";
import { Metric } from "../components/UI";
import { dayKey, today } from "../lib/calculations";
export function Dealers() {
  const { data, demo } = useStore();
  const [tab, setTab] = useState("shop");
  const [offer, setOffer] = useState<OfferDraft | null>(null);
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
          <span className="eyebrow">PRODUKTE. HÄNDLER. ABSCHLÜSSE.</span>
          <h1>Vape</h1>
          <p>Produkt fotografieren, im freigegebenen B2B-Katalog finden und direkt ein Angebot erstellen. Deine Kundenakte bleibt zentral.</p>
        </div>
      </div>
      <div className="metrics">
        <Metric
          label="Zentrale Kunden"
          value={data.customers.length}
          detail="Gemeinsame Kundenakte für SumUp & Vape"
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
        <button className={tab === "shop" ? "active" : ""} onClick={() => setTab("shop")}>Produkte & Foto-Suche</button>
        <button className={tab === "contacts" ? "active" : ""} onClick={() => setTab("contacts")}>Alle Kunden</button>
        <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>Artikel freigeben & Bilder verwalten</button>
        <button
          className={tab === "tasks" ? "active" : ""}
          onClick={() => setTab("tasks")}
        >
          Termine & Wiedervorlagen
        </button>
      </div>
      {tab === "shop" ? (
        <VapeShop demo={demo} onOffer={setOffer} />
      ) : tab === "contacts" ? (
        <Customers />
      ) : tab === "review" ? (
        <VapeReviewCatalog demo={demo} />
      ) : (
        <Tasks division="vape" />
      )}
      {offer && <OfferForm draft={offer} onClose={() => setOffer(null)} />}
    </>
  );
}
