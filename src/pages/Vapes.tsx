import { useState } from "react";
import {
  Plus,
  Upload,
  Search,
  FileText,
  Package,
  Download,
  Save,
} from "lucide-react";
import { useStore } from "../lib/store";
import {
  Card,
  Metric,
  Empty,
  Modal,
  AsyncForm,
  Field,
  value,
  number,
  DivisionBadge,
  External,
  Badge,
} from "../components/UI";
import { margin, money, today, dateLabel, round } from "../lib/calculations";
import { parseCsv, mapProducts, aliases, type ColumnMap } from "../lib/import";
import type { Product, Supplier } from "../lib/types";
import { OfferForm, type OfferDraft } from "./Offers";
import { Customers } from "./Customers";
function SupplierForm({
  supplier,
  onClose,
}: {
  supplier?: Supplier;
  onClose: () => void;
}) {
  const { save } = useStore();
  return (
    <Modal
      title={supplier ? "Lieferant bearbeiten" : "Großhandel hinzufügen"}
      onClose={onClose}
    >
      <AsyncForm
        onSubmit={async (f) => {
          await save("suppliers", {
            ...supplier,
            name: value(f, "name"),
            website: value(f, "website"),
            terms: value(f, "terms"),
            shipping_net: number(f, "shipping_net"),
            min_order: number(f, "min_order"),
            lead_days: number(f, "lead_days"),
          });
          onClose();
        }}
      >
        <div className="form-grid">
          <Field label="Name *">
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={supplier?.name}
            />
          </Field>
          <Field label="Händlerportal (https://)">
            <input
              name="website"
              type="url"
              pattern="https://.*"
              defaultValue={supplier?.website}
              placeholder="https://…"
            />
          </Field>
          <Field label="Versand netto (€)">
            <input
              name="shipping_net"
              type="number"
              min="0"
              step="0.01"
              defaultValue={supplier?.shipping_net || 0}
            />
          </Field>
          <Field label="Mindestbestellwert netto (€)">
            <input
              name="min_order"
              type="number"
              min="0"
              step="0.01"
              defaultValue={supplier?.min_order || 0}
            />
          </Field>
          <Field label="Lieferzeit (Tage)">
            <input
              name="lead_days"
              type="number"
              min="0"
              max="365"
              step="1"
              defaultValue={supplier?.lead_days || 0}
            />
          </Field>
        </div>
        <Field label="Konditionen / verfügbare Exportformate">
          <textarea
            name="terms"
            maxLength={3000}
            defaultValue={supplier?.terms}
          />
        </Field>
      </AsyncForm>
    </Modal>
  );
}
function ProductForm({
  product,
  onClose,
}: {
  product?: Product;
  onClose: () => void;
}) {
  const { data, save } = useStore();
  return (
    <Modal
      title={product ? "Produkt bearbeiten" : "Produkt erfassen"}
      onClose={onClose}
    >
      <AsyncForm
        onSubmit={async (f) => {
          await save("products", {
            ...product,
            supplier_id: value(f, "supplier_id"),
            sku: value(f, "sku"),
            ean: value(f, "ean"),
            name: value(f, "name"),
            category: value(f, "category"),
            ek_net: number(f, "ek_net"),
            vk_net: number(f, "vk_net"),
            vat: number(f, "vat"),
            stock: value(f, "stock") === "" ? null : number(f, "stock"),
            pack_size: number(f, "pack_size"),
            source_date: value(f, "source_date"),
            source_url: value(f, "source_url"),
          });
          onClose();
        }}
      >
        <div className="form-grid">
          <Field label="Lieferant *">
            <select
              name="supplier_id"
              required
              defaultValue={product?.supplier_id || ""}
            >
              <option value="">Auswählen</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Artikelnummer *">
            <input
              name="sku"
              required
              maxLength={160}
              defaultValue={product?.sku}
            />
          </Field>
          <Field label="Bezeichnung *">
            <input
              name="name"
              required
              maxLength={300}
              defaultValue={product?.name}
            />
          </Field>
          <Field label="EAN / GTIN">
            <input name="ean" maxLength={40} defaultValue={product?.ean} />
          </Field>
          <Field label="Kategorie">
            <input
              name="category"
              defaultValue={product?.category || "Trendprodukte"}
            />
          </Field>
          {[
            ["ek_net", "EK netto pro Stück (€)", product?.ek_net ?? 0],
            ["vk_net", "VK netto pro Stück (€)", product?.vk_net ?? 0],
            ["vat", "MwSt. (%)", product?.vat ?? 19],
            ["pack_size", "Stück je Gebinde", product?.pack_size ?? 1],
          ].map(([k, label, v]) => (
            <Field key={k} label={String(label)}>
              <input
                name={String(k)}
                type="number"
                required
                min={k === "pack_size" ? 1 : 0}
                step={k === "pack_size" ? 1 : 0.01}
                max={k === "vat" ? 100 : 1000000000}
                defaultValue={v}
              />
            </Field>
          ))}
          <Field label="Lagerbestand (optional)">
            <input
              name="stock"
              type="number"
              min="0"
              step="1"
              defaultValue={product?.stock ?? ""}
            />
          </Field>
          <Field label="Preisstand *">
            <input
              name="source_date"
              type="date"
              required
              defaultValue={product?.source_date || today()}
            />
          </Field>
          <Field label="Produktquelle (https://)">
            <input
              name="source_url"
              type="url"
              pattern="https://.*"
              defaultValue={product?.source_url}
            />
          </Field>
        </div>
      </AsyncForm>
    </Modal>
  );
}
function ImportForm({ onClose }: { onClose: () => void }) {
  const { data, importProducts } = useStore();
  const [supplier, setSupplier] = useState(data.suppliers[0]?.id || ""),
    [csv, setCsv] = useState<ReturnType<typeof parseCsv> | null>(null),
    [mapping, setMapping] = useState<ColumnMap>({
      sku: "",
      name: "",
      ek_net: "",
      vk_net: "",
      ean: "",
      category: "",
      stock: "",
      pack_size: "",
    }),
    [error, setError] = useState("");
  let products: ReturnType<typeof mapProducts> = [];
  let validation = "";
  if (csv && supplier) {
    try {
      products = mapProducts(csv.rows, mapping, supplier);
    } catch (e) {
      validation = (e as Error).message;
    }
  }
  return (
    <Modal title="Lieferantenpreisliste importieren" onClose={onClose}>
      <p>
        CSV oder TSV aus dem Händlerportal oder aus Excel. Preise müssen{" "}
        <b>netto pro Stück</b> vorliegen. Vorschau prüfen; vorhandene Artikel
        desselben Lieferanten werden anhand der Artikelnummer aktualisiert.
      </p>
      <a className="text-link" href="./import-vorlage.csv" download>
        <Download size={16} /> CSV-Vorlage
      </a>
      <AsyncForm
        label={`${products.length} Produkte übernehmen`}
        onSubmit={async () => {
          if (!products.length || validation)
            throw Error(
              validation ||
                "Bitte eine gültige Datei und einen Lieferanten wählen.",
            );
          await importProducts(products);
          onClose();
        }}
      >
        <Field label="Lieferant *">
          <select
            required
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">Zuerst einen Lieferanten anlegen</option>
            {data.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Datei (CSV / TSV, maximal 5 MB)">
          <input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={async (e) => {
              setCsv(null);
              setError("");
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 5_000_000)
                  throw Error("Datei ist größer als 5 MB.");
                const parsed = parseCsv(await file.text());
                setCsv(parsed);
                setMapping(
                  Object.fromEntries(
                    Object.entries(aliases).map(([key, names]) => [
                      key,
                      parsed.headers.find((h) => names.includes(h)) || "",
                    ]),
                  ) as ColumnMap,
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </Field>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {csv && (
          <>
            <h3>Spalten zuordnen</h3>
            <div className="form-grid">
              {Object.keys(mapping).map((key) => (
                <Field
                  key={key}
                  label={
                    key +
                    (["sku", "name", "ek_net", "vk_net"].includes(key)
                      ? " *"
                      : "")
                  }
                >
                  <select
                    value={mapping[key as keyof ColumnMap]}
                    required={["sku", "name", "ek_net", "vk_net"].includes(key)}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [key]: e.target.value }))
                    }
                  >
                    <option value="">Nicht zugeordnet</option>
                    {csv.headers.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
            {validation ? (
              <p className="error" role="alert">
                {validation}
              </p>
            ) : (
              <>
                <h3>Vorschau · {products.length} Produkte</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Produkt</th>
                        <th>EK netto</th>
                        <th>VK netto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.slice(0, 6).map((p) => (
                        <tr key={p.sku}>
                          <td>{p.sku}</td>
                          <td>{p.name}</td>
                          <td>{money(p.ek_net)}</td>
                          <td>{money(p.vk_net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="hint">
                  19 % MwSt. als Importstandard. Fehlender Bestand bleibt
                  unbekannt. Ein fehlerhafter Import wird vollständig
                  zurückgerollt.
                </p>
              </>
            )}
          </>
        )}
      </AsyncForm>
    </Modal>
  );
}
export function Vapes() {
  const { data, save } = useStore();
  const [tab, setTab] = useState("catalog"),
    [search, setSearch] = useState(""),
    [supplier, setSupplier] = useState(""),
    [editSupplier, setEditSupplier] = useState<Supplier | true | null>(null),
    [editProduct, setEditProduct] = useState<Product | true | null>(null),
    [importing, setImporting] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [draft, setDraft] = useState<OfferDraft | null>(null),
    [calc, setCalc] = useState({
      ek: 0,
      vk: 0,
      quantity: 10,
      shipping: 0,
      monthlyUnits: 100,
      stock: 0,
    }),
    [customer, setCustomer] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const products = data.products.filter(
    (p) =>
      (!supplier || p.supplier_id === supplier) &&
      [p.name, p.sku, p.ean, p.category]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const compared = data.products.filter((p) => selected.includes(p.id));
  let result: ReturnType<typeof margin> | null = null;
  try {
    result = margin(calc.ek, calc.vk, calc.quantity, calc.shipping);
  } catch {}
  const old = data.products.filter(
    (p) => (Date.now() - new Date(p.source_date).getTime()) / 86400000 > 30,
  ).length;
  return (
    <>
      <div className="section-intro">
        <div>
          <DivisionBadge division="vape" />
          <h1>Ein Sortiment mit Potenzial.</h1>
          <p>Produkte, Lieferanten und Kalkulation an einem Ort.</p>
        </div>
        <button className="primary" onClick={() => setImporting(true)}>
          <Upload size={17} /> Preisliste importieren
        </button>
      </div>
      <div className="tabs">
        {[
          ["catalog", "Produktkatalog"],
          ["suppliers", "Lieferanten"],
          ["compare", "Produktvergleich"],
          ["margin", "Marge & Potenzial"],
          ["leads", "Händler & Leads"],
        ].map(([k, v]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {v}
            {k === "compare" && selected.length > 0 && ` (${selected.length})`}
          </button>
        ))}
      </div>
      {tab === "catalog" && (
        <>
          <div className="metrics three">
            <Metric
              label="Produkte im Katalog"
              value={data.products.length}
              detail="Eigene, importierte Lieferantendaten"
              icon={<Package size={17} />}
            />
            <Metric
              label="Lieferanten"
              value={data.suppliers.length}
              detail="Mit individuellen Einkaufskonditionen"
            />
            <Metric
              label="Preisstand prüfen"
              value={old}
              detail="Produkte mit Daten älter als 30 Tage"
            />
          </div>
          <Card>
            <div className="toolbar">
              <div className="search">
                <Search size={18} />
                <input
                  placeholder="Produkt, EAN oder Artikelnummer …"
                  aria-label="Produkte suchen"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={supplier}
                aria-label="Lieferant filtern"
                onChange={(e) => setSupplier(e.target.value)}
              >
                <option value="">Alle Lieferanten</option>
                {data.suppliers.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                className="secondary"
                onClick={() => setEditProduct(true)}
              >
                <Plus size={16} /> Produkt
              </button>
            </div>
            {products.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Vergleich</th>
                      <th>Produkt</th>
                      <th>Lieferant</th>
                      <th>EK / VK netto</th>
                      <th>Marge</th>
                      <th>Bestand / Stand</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={p.name + " vergleichen"}
                            checked={selected.includes(p.id)}
                            disabled={
                              !selected.includes(p.id) && selected.length >= 4
                            }
                            onChange={(e) =>
                              setSelected((s) =>
                                e.target.checked
                                  ? [...s, p.id]
                                  : s.filter((id) => id !== p.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="customer-link"
                            onClick={() => setEditProduct(p)}
                          >
                            {p.name}
                          </button>
                          <small>
                            {p.sku} · {p.category}
                          </small>
                        </td>
                        <td>
                          {
                            data.suppliers.find((s) => s.id === p.supplier_id)
                              ?.name
                          }
                        </td>
                        <td>
                          {money(p.ek_net)} / {money(p.vk_net)}
                        </td>
                        <td>
                          <Badge
                            kind={p.vk_net >= p.ek_net ? "positive" : "danger"}
                          >
                            {margin(p.ek_net, p.vk_net).margin ?? "–"} %
                          </Badge>
                        </td>
                        <td>
                          {p.stock ?? "Unbekannt"}
                          <small>{dateLabel(p.source_date)}</small>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={p.name + " anbieten"}
                            onClick={() =>
                              setDraft({
                                division: "vape",
                                lines: [
                                  {
                                    name: p.name,
                                    quantity: p.pack_size,
                                    price: p.vk_net,
                                    vat: p.vat,
                                  },
                                ],
                                notes:
                                  "Lieferbarkeit und aktuelle Konditionen vor Auftrag bestätigen.",
                              })
                            }
                          >
                            <FileText size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="Dein Katalog beginnt beim Großhandel">
                Lege einen Lieferanten an und importiere seine Preisliste.
                Einkaufspreise werden nur in deinem geschützten CRM gespeichert.
              </Empty>
            )}
          </Card>
          <p className="hint">
            Noch keine automatische Händleranbindung. Dafür werden Name und
            Portaladresse deines Großhändlers benötigt.
          </p>
        </>
      )}
      {tab === "suppliers" && (
        <>
          <div className="button-row">
            <button className="primary" onClick={() => setEditSupplier(true)}>
              <Plus size={16} /> Lieferant anlegen
            </button>
          </div>
          <div className="solutions-grid">
            {data.suppliers.map((s) => (
              <Card title={s.name} key={s.id}>
                <div className="mini-stats">
                  <div>
                    <span>Versand netto</span>
                    <b>{money(s.shipping_net)}</b>
                  </div>
                  <div>
                    <span>Mindestbestellwert</span>
                    <b>{money(s.min_order)}</b>
                  </div>
                  <div>
                    <span>Lieferzeit laut Angabe</span>
                    <b>{s.lead_days} Tage</b>
                  </div>
                  <div>
                    <span>Produkte</span>
                    <b>
                      {
                        data.products.filter((p) => p.supplier_id === s.id)
                          .length
                      }
                    </b>
                  </div>
                </div>
                <p className="prewrap">{s.terms}</p>
                <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() => setEditSupplier(s)}
                  >
                    Bearbeiten
                  </button>
                  {s.website && (
                    <External href={s.website}>Portal öffnen</External>
                  )}
                </div>
              </Card>
            ))}
          </div>
          {!data.suppliers.length && (
            <Card>
              <Empty title="Welcher Großhandel beliefert dich?">
                Hinterlege Portaladresse, Versandkosten und Bestellbedingungen.
              </Empty>
            </Card>
          )}
        </>
      )}
      {tab === "compare" && (
        <Card
          title="Produkte & Lieferanten vergleichen"
          action={<Badge>Maximal 4 Produkte</Badge>}
        >
          {compared.length ? (
            <>
              <Field label="Vergleichsmenge in Stück">
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  value={calc.quantity}
                  onChange={(e) =>
                    setCalc((v) => ({
                      ...v,
                      quantity: Math.max(1, Math.floor(+e.target.value)),
                    }))
                  }
                />
              </Field>
              <div className="compare-grid">
                {compared.map((p) => {
                  const s = data.suppliers.find((s) => s.id === p.supplier_id);
                  const q =
                    Math.ceil(calc.quantity / p.pack_size) * p.pack_size;
                  const cost = round(q * p.ek_net + (s?.shipping_net || 0));
                  return (
                    <div className="comparison-product" key={p.id}>
                      <Badge>{s?.name}</Badge>
                      <h3>{p.name}</h3>
                      <p>{p.ean ? "EAN " + p.ean : p.sku}</p>
                      <strong>{money(cost)}</strong>
                      <small>Einkauf inkl. Versand, netto</small>
                      <dl>
                        <dt>Gebinderundung</dt>
                        <dd>{q} Stück</dd>
                        <dt>Effektiver EK / Stück</dt>
                        <dd>{money(cost / q)}</dd>
                        <dt>Verkauf netto / Stück</dt>
                        <dd>{money(p.vk_net)}</dd>
                        <dt>Marge vor Versand</dt>
                        <dd>{margin(p.ek_net, p.vk_net).margin ?? "–"} %</dd>
                        <dt>Bestand</dt>
                        <dd>{p.stock ?? "Unbekannt"}</dd>
                      </dl>
                      {q * p.ek_net < (s?.min_order || 0) && (
                        <p className="notice">
                          Mindestbestellwert nicht erreicht.
                        </p>
                      )}
                      {p.stock !== null && q > p.stock && (
                        <p className="error">
                          Vergleichsmenge über Lagerbestand.
                        </p>
                      )}
                      <button
                        className="secondary"
                        onClick={() => {
                          setCalc((v) => ({
                            ...v,
                            ek: p.ek_net,
                            vk: p.vk_net,
                            quantity: q,
                            shipping: s?.shipping_net || 0,
                          }));
                          setTab("margin");
                        }}
                      >
                        Kalkulation übernehmen
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="hint">
                Gleiche EAN erleichtert den Vergleich identischer Produkte. Ohne
                EAN Eigenschaften und Gebinde selbst abgleichen. Bestand und
                Lieferzeit sind Angaben aus dem letzten Import.
              </p>
            </>
          ) : (
            <Empty title="Produkte auswählen">
              Markiere bis zu vier Produkte im Katalog.
            </Empty>
          )}
        </Card>
      )}
      {tab === "margin" && (
        <>
          <div className="analysis-grid">
            <Card title="Deine Kalkulation">
              <div className="form-grid">
                {[
                  ["ek", "EK netto / Stück (€)"],
                  ["vk", "VK netto / Stück (€)"],
                  ["quantity", "Bestellmenge (Stück)"],
                  ["shipping", "Versand netto (€)"],
                  ["monthlyUnits", "Erwarteter Absatz / Monat"],
                  ["stock", "Händlerbestand (Stück)"],
                ].map(([k, label]) => (
                  <Field key={k} label={label}>
                    <input
                      type="number"
                      min="0"
                      max="1000000000"
                      step={
                        ["quantity", "monthlyUnits", "stock"].includes(k)
                          ? 1
                          : 0.01
                      }
                      value={calc[k as keyof typeof calc]}
                      onChange={(e) =>
                        setCalc((v) => ({ ...v, [k]: Number(e.target.value) }))
                      }
                    />
                  </Field>
                ))}
              </div>
              <Field label="Händler zuordnen">
                <select
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                >
                  <option value="">Freie Kalkulation</option>
                  {data.customers
                    .filter((c) =>
                      data.opportunities.some(
                        (o) => o.customer_id === c.id && o.division === "vape",
                      ),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company}
                      </option>
                    ))}
                </select>
              </Field>
              <button
                className="primary"
                disabled={!customer || !result || busy}
                onClick={async () => {
                  const o = data.opportunities.find(
                    (o) => o.customer_id === customer && o.division === "vape",
                  );
                  if (!o || !result) return;
                  setBusy(true);
                  try {
                    await save("opportunities", {
                      ...o,
                      potential: round(calc.monthlyUnits * calc.vk),
                      details: { ...o.details, trade: calc },
                    });
                    setMessage("Potenzial in der Händlerakte gespeichert.");
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Save size={16} /> Potenzial speichern
              </button>
              {message && <p role="status">{message}</p>}
            </Card>
            <Card title="Marge & Abnahmepotenzial" eyebrow="NETTO-KALKULATION">
              {result ? (
                <>
                  <div className="profit-number">
                    {money(result.profit)}
                    <small>Rohertrag nach Versand</small>
                  </div>
                  <div className="mini-stats">
                    <div>
                      <span>Handelsspanne vor Versand</span>
                      <b>{result.margin ?? "–"} %</b>
                    </div>
                    <div>
                      <span>Aufschlag auf EK</span>
                      <b>{result.markup ?? "–"} %</b>
                    </div>
                    <div>
                      <span>Warenumsatz</span>
                      <b>{money(result.revenue)}</b>
                    </div>
                    <div>
                      <span>Einkauf inkl. Versand</span>
                      <b>{money(result.cost)}</b>
                    </div>
                    <div>
                      <span>Monatliches Umsatzpotenzial</span>
                      <b>{money(calc.monthlyUnits * calc.vk)}</b>
                    </div>
                    <div>
                      <span>Nachbestellbedarf / Monat</span>
                      <b>
                        {Math.max(0, Math.ceil(calc.monthlyUnits - calc.stock))}{" "}
                        Stück
                      </b>
                    </div>
                  </div>
                  <p className="hint">
                    Absatz ist deine Schätzung. Fixkosten, Zahlungsgebühren,
                    Retouren und weitere Bezugskosten sind nicht enthalten. Kein
                    prognostizierter Nettogewinn.
                  </p>
                </>
              ) : (
                <p className="error">
                  Bitte gültige, nicht negative Zahlen eingeben.
                </p>
              )}
            </Card>
          </div>
        </>
      )}
      {tab === "leads" && <Customers division="vape" />}
      {editSupplier && (
        <SupplierForm
          supplier={editSupplier === true ? undefined : editSupplier}
          onClose={() => setEditSupplier(null)}
        />
      )}{" "}
      {editProduct && (
        <ProductForm
          product={editProduct === true ? undefined : editProduct}
          onClose={() => setEditProduct(null)}
        />
      )}{" "}
      {importing && <ImportForm onClose={() => setImporting(false)} />}{" "}
      {draft && <OfferForm draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
}
