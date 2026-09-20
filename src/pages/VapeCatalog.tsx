import { useEffect, useMemo, useState } from "react";
import { client } from "../lib/client";

type VapeProduct = {
  id: string;
  article_no: string;
  name: string;
  category: string | null;
  variant: string | null;
  packaging_unit: string | null;
  ek_net: number;
  ean: string | null;
  active: boolean;
};

const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
export const vapeSaleNet = (purchaseNet: number, marginPercent: number) =>
  Math.round((purchaseNet / (1 - marginPercent / 100) + Number.EPSILON) * 100) / 100;

export function VapeCatalog({ demo }: { demo: boolean }) {
  const [products, setProducts] = useState<VapeProduct[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [margin, setMargin] = useState(25);
  const [onlyActive, setOnlyActive] = useState(true);

  useEffect(() => {
    if (demo) { setLoading(false); return; }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const rows: VapeProduct[] = [];
        for (let start = 0; ; start += 1000) {
          const { data, error } = await client.from("vape_products")
            .select("id,article_no,name,category,variant,packaging_unit,ek_net,ean,active")
            .order("article_no").range(start, start + 999);
          if (error) throw error;
          rows.push(...(data || []) as VapeProduct[]);
          if (!data || data.length < 1000) break;
        }
        if (!cancelled) { setProducts(rows); setError(""); }
      } catch {
        if (!cancelled) setError("Produktstamm konnte nicht geladen werden. Bitte erneut versuchen.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [demo]);

  const categories = useMemo(
    () => [...new Set(products.map(p => p.category || "Ohne Kategorie"))].sort(),
    [products],
  );
  const filtered = useMemo(() => products.filter(p =>
    (!onlyActive || p.active) &&
    (!category || (p.category || "Ohne Kategorie") === category) &&
    [p.name, p.article_no, p.ean, p.variant].some(v =>
      (v || "").toLocaleLowerCase("de-DE").includes(search.toLocaleLowerCase("de-DE").trim())
    )
  ), [products, onlyActive, category, search]);

  return <section className="card" aria-label="Vape Produktkatalog">
    <div className="card-head"><h2>Vape-Produktkatalog</h2></div>
    <p>Interner B2B-Katalog · Einkaufspreise nur für die Inhaberansicht. Vor einem Kundenangebot die aktuellen Händlerpreise und Verpackungseinheiten prüfen.</p>
    <div className="form-grid">
      <label className="field">Suche nach Produkt, Artikelnummer, EAN oder Variante
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Produkt suchen …" />
      </label>
      <label className="field">Kategorie
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Alle Kategorien</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="field">Kalkulationsmarge: {margin} %
        <input type="range" min="15" max="25" step="1" value={margin}
          onChange={e => setMargin(Number(e.target.value))} />
      </label>
      <label className="checkbox-field">
        <input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} />
        Nur aktive Produkte
      </label>
    </div>
    <p role="status">{loading ? "Produkte werden geladen …" : `${filtered.length} von ${products.length} Produkten`}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {demo && <p>In der Demo werden keine echten Händler- oder Einkaufspreise geladen.</p>}
    {!loading && !demo && <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
        <thead><tr><th>Produkt</th><th>Kategorie</th><th>EK netto</th><th>VK netto</th><th>VK brutto (19 %)</th></tr></thead>
        <tbody>{filtered.map(p => {
          const net = vapeSaleNet(Number(p.ek_net), margin);
          return <tr key={p.id}>
            <td><strong>{p.name}</strong><br /><small>{p.article_no}{p.variant ? ` · ${p.variant}` : ""}{p.packaging_unit ? ` · ${p.packaging_unit}` : ""}</small></td>
            <td>{p.category || "Ohne Kategorie"}</td>
            <td>{euro(Number(p.ek_net))}</td>
            <td><strong>{euro(net)}</strong></td>
            <td>{euro(Math.round((net * 1.19 + Number.EPSILON) * 100) / 100)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
  </section>;
}
