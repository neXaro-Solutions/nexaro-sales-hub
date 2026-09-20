import { useEffect, useMemo, useState } from "react";
import { client } from "../lib/client";
import type { OfferLine } from "../lib/types";

type ApprovedVape = {
  id: string; name: string; supplier_article_no: string | null; category: string | null;
  pieces_per_ve: number | null; ve_ek_net: number | null; ve_approved: boolean;
  supplier_single_available: boolean; single_ek_net: number | null; single_approved: boolean;
};
const money = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
export const calcVapeSaleNet = (ek: number, margin: number) =>
  Math.ceil((ek / (1 - margin / 100)) * 100 - 0.00000001) / 100;

export function VapeOfferPicker({ onAdd }: { onAdd: (line: OfferLine) => void }) {
  const [products, setProducts] = useState<ApprovedVape[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [unit, setUnit] = useState<"VE" | "Stück">("VE");
  const [quantity, setQuantity] = useState(1);
  const [margin, setMargin] = useState(25);

  useEffect(() => {
    let live = true;
    async function load() {
      const { data, error: dbError } = await client.from("nx_vape_catalog")
        .select("id,name,supplier_article_no,category,pieces_per_ve,ve_ek_net,ve_approved,supplier_single_available,single_ek_net,single_approved")
        .or("ve_approved.eq.true,single_approved.eq.true").order("name");
      if (!live) return;
      if (dbError) setError("Freigegebene Vape-Produkte konnten nicht geladen werden.");
      else { setProducts((data || []) as ApprovedVape[]); setError(""); }
    }
    void load();
    return () => { live = false; };
  }, []);

  const visible = useMemo(() => products.filter(p =>
    (p.name + " " + (p.supplier_article_no || "")).toLocaleLowerCase("de-DE")
      .includes(search.toLocaleLowerCase("de-DE").trim())), [products, search]);
  const product = products.find(p => p.id === selected);
  const allowedVE = !!(product?.ve_approved && product.ve_ek_net && product.ve_ek_net > 0 && product.pieces_per_ve && product.pieces_per_ve > 0);
  const allowedSingle = !!(product?.single_approved && product.supplier_single_available &&
    product.single_ek_net && product.single_ek_net > 0);
  const ek = unit === "VE" ? allowedVE ? product?.ve_ek_net : null : allowedSingle ? product?.single_ek_net : null;
  const vk = ek ? calcVapeSaleNet(ek, margin) : null;

  function add() {
    if (!product || vk === null || !Number.isSafeInteger(quantity) || quantity < 1 ||
      (unit === "VE" && !allowedVE) || (unit === "Stück" && !allowedSingle)) return;
    const line: OfferLine = {
      name: product.name + " · " + (unit === "VE" ? "1 VE = " + product.pieces_per_ve + " Stück" : "Einzelstück") +
        (product.supplier_article_no ? " · Art. " + product.supplier_article_no : ""),
      quantity, price: vk, vat: 19,
    };
    onAdd(line);
    setQuantity(1);
  }
  return <section className="card" aria-label="Freigegebene Vape-Produkte ins Angebot übernehmen">
    <h3>Freigegebene Vape-Produkte übernehmen</h3>
    <p>Nur geprüfte Verkaufseinheiten sind auswählbar. Preise je VE oder Einzelstück, netto, 19 % MwSt.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="form-grid">
      <label className="field">Produkt suchen
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Produkt oder Artikelnummer …" />
      </label>
      <label className="field">Freigegebenes Produkt
        <select value={selected} onChange={e => {
          setSelected(e.target.value);
          const p = products.find(p => p.id === e.target.value);
          setUnit(p?.ve_approved ? "VE" : "Stück");
        }}>
          <option value="">Produkt auswählen ({visible.length})</option>
          {visible.map(p => <option key={p.id} value={p.id}>{p.name} {p.supplier_article_no ? "· " + p.supplier_article_no : ""}</option>)}
        </select>
      </label>
      <label className="field">Verkaufseinheit
        <select value={unit} onChange={e => setUnit(e.target.value as "VE" | "Stück")} disabled={!product}>
          <option value="VE" disabled={!allowedVE}>Vollständige VE{product?.pieces_per_ve ? " (" + product.pieces_per_ve + " Stück)" : ""}</option>
          <option value="Stück" disabled={!allowedSingle}>Einzelstück</option>
        </select>
      </label>
      <label className="field">Bestellmenge in {unit}
        <input type="number" min="1" max="1000000" step="1" value={quantity}
          onChange={e => setQuantity(Number(e.target.value))} />
      </label>
      <label className="field">Marge: {margin} %
        <input type="range" min="15" max="25" step="1" value={margin}
          onChange={e => setMargin(Number(e.target.value))} />
      </label>
    </div>
    {vk !== null && <p>VK netto je {unit}: <strong>{money(vk)}</strong> · Gesamt netto: {money(Math.round(vk * quantity * 100) / 100)}</p>}
    <button type="button" disabled={!product || vk === null || !Number.isSafeInteger(quantity) || quantity < 1}
      onClick={add}>Freigegebene Position ins Angebot übernehmen</button>
  </section>;
}
