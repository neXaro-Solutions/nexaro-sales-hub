import { useEffect, useMemo, useState } from "react";
import { client } from "../lib/client";
import { vapeSaleNet, vapeSaleGross } from "../lib/vapePricing";

type SupplierDetail = {
  url: string; title?: string; articleNo?: string; ean?: string; category?: string;
  priceCandidate?: number | null; priceStatus?: string; images?: string[];
  listing?: { name?: string; image?: string };
};
type Draft = {
  id: string; source_url: string; supplier_article_no: string | null; ean: string | null;
  name: string; category: string | null; image_url: string | null;
  supplier_price_candidate_net: number | null; price_status: string;
  pieces_per_ve: number | null; ve_ek_net: number | null; ve_approved: boolean;
  supplier_single_available: boolean; single_ek_net: number | null; single_approved: boolean;
  reviewed_at: string | null;
};

const euro = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const amount = (v: string): number | null => {
  if (!v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const count = (v: string): number | null => {
  const n = Number(v);
  return v.trim() !== "" && Number.isSafeInteger(n) && n > 0 ? n : null;
};
export function VapeReviewCatalog({ demo }: { demo: boolean }) {
  const [products, setProducts] = useState<Draft[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [margin, setMargin] = useState(25);
  const [drafts, setDrafts] = useState<Record<string, { ve: string; pieces: string; single: string }>>({});
  const [pending, setPending] = useState<SupplierDetail[] | null>(null);

  async function load() {
    setBusy(true);
    try {
      const rows: Draft[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error: dbError } = await client.from("nx_vape_catalog").select("*")
          .order("name").range(offset, offset + 999);
        if (dbError) throw dbError;
        rows.push(...(data || []) as Draft[]);
        if (!data || data.length < 1000) break;
      }
      setProducts(rows); setError("");
    } catch (e) {
      setError("Der geschützte Vape-Katalog ist noch nicht erreichbar. Datenbankmigration prüfen. " +
        (e instanceof Error ? e.message : ""));
    } finally { setBusy(false); }
  }
  useEffect(() => { if (!demo) void load(); }, [demo]);
  const categories = useMemo(() => [...new Set(products.map(p => p.category || "Ohne Kategorie"))].sort(), [products]);
  const filtered = useMemo(() => products.filter(p =>
    (!category || (p.category || "Ohne Kategorie") === category) &&
    (reviewFilter === "all" || (reviewFilter === "pending" && !p.ve_approved && !p.single_approved) ||
      (reviewFilter === "ve" && p.ve_approved) || (reviewFilter === "single" && p.single_approved)) &&
    [p.name, p.supplier_article_no, p.ean].some(s =>
      (s || "").toLocaleLowerCase("de-DE").includes(search.toLocaleLowerCase("de-DE").trim()))
  ), [products, search, category, reviewFilter]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 25) - 1));

  async function readImport(file: File | undefined) {
    if (!file) return;
    setPending(null); setError(""); setNotice("");
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed) || parsed.length > 10000) throw new Error("Erwartet wird dealer-products.json (max. 10.000 Artikel).");
      const details = parsed as SupplierDetail[];
      if (!details.length || !details.every(d => typeof d.url === "string" &&
        d.url.startsWith("https://e-zigaretten-handel.de/") &&
        typeof (d.title || d.listing?.name) === "string")) {
        throw new Error("Die Datei enthält keine gültigen Händler-Detailseiten.");
      }
      const seen = new Set<string>();
      const unique = details.filter(d => { if (seen.has(d.url)) return false; seen.add(d.url); return true; });
      setPending(unique);
      setNotice(unique.length + " Händlerartikel geprüft und zum Import vorgemerkt. Noch keine Datenbankänderung.");
    } catch (e) { setError(e instanceof Error ? e.message : "Datei nicht lesbar."); }
  }

  async function importDrafts() {
    if (!pending || !window.confirm(pending.length + " Händlerartikel als UNFREIGEGEBENE Entwürfe importieren? Vorhandene Freigaben und Preise bleiben unverändert.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      // Never upsert: an export must not overwrite any owner approvals, verified EKs or manual pack sizes.
      const existingUrls = new Set(products.map(p => p.source_url));
      const unseen = pending.filter(d => !existingUrls.has(d.url));
      let imported = 0;
      for (let i = 0; i < unseen.length; i += 100) {
        const batch = unseen.slice(i, i + 100).map(d => ({
          source_url: d.url, supplier_article_no: d.articleNo || null, ean: d.ean || null,
          name: d.title || d.listing?.name || "Unbenannter Artikel", category: d.category || null,
          image_url: d.listing?.image || d.images?.[0] || null,
          supplier_price_candidate_net: Number(d.priceCandidate) > 0 ? d.priceCandidate : null,
          price_status: d.priceStatus || "missing",
          // Crucially, supplier candidate is NOT an approved VE or single-item price.
          ve_approved: false, single_approved: false,
        }));
        const { error: dbError } = await client.from("nx_vape_catalog").insert(batch);
        if (dbError) throw dbError;
        imported += batch.length;
      }
      setPending(null);
      setNotice(imported + " neue Entwürfe importiert; " + (pending.length - imported) + " vorhandene Artikel nicht überschrieben.");
      await load();
    } catch (e) { setError("Import nicht abgeschlossen: " + (e instanceof Error ? e.message : "")); }
    finally { setBusy(false); }
  }
  async function save(p: Draft, field: "ve" | "single" | "supplier") {
    const v = drafts[p.id] || { ve: "", pieces: "", single: "" };
    const patch: Record<string, unknown> = { reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (field === "ve") {
      const ek = amount(v.ve || String(p.ve_ek_net ?? ""));
      const pieces = count(v.pieces || String(p.pieces_per_ve ?? ""));
      if (ek === null || pieces === null) { setError("VE-Freigabe benötigt bestätigten EK netto je VE und eine positive ganzzahlige Stückzahl."); return; }
      if (!window.confirm("VE-Verkauf für diesen Artikel nach Prüfung freigeben?")) return;
      Object.assign(patch, { ve_ek_net: ek, pieces_per_ve: pieces, ve_approved: true });
    } else if (field === "supplier") {
      if (!window.confirm("Hast du beim Großhändler bestätigt, dass dieser Artikel einzeln bezogen werden kann?")) return;
      patch.supplier_single_available = true;
    } else {
      if (!p.supplier_single_available) { setError("Zuerst die Einzelstück-Verfügbarkeit beim Großhändler bestätigen."); return; }
      const ek = amount(v.single || String(p.single_ek_net ?? ""));
      if (ek === null) { setError("Ein bestätigter Einzelstück-EK netto ist erforderlich."); return; }
      if (!window.confirm("Einzelstückverkauf mit diesem bestätigten Einzelstück-EK freigeben?")) return;
      Object.assign(patch, { single_ek_net: ek, single_approved: true });
    }
    setBusy(true); setError(""); setNotice("");
    const { error: dbError } = await client.from("nx_vape_catalog").update(patch).eq("id", p.id);
    if (dbError) setError(dbError.message);
    else { setNotice("Freigabe für " + p.name + " gespeichert."); await load(); }
    setBusy(false);
  }
  async function revoke(p: Draft, field: "ve" | "single") {
    if (!window.confirm("Diese Verkaufsfreigabe für " + p.name + " zurücknehmen?")) return;
    setBusy(true);
    const { error: dbError } = await client.from("nx_vape_catalog")
      .update({ [field === "ve" ? "ve_approved" : "single_approved"]: false,
        updated_at: new Date().toISOString() }).eq("id", p.id);
    if (dbError) setError(dbError.message);
    else await load();
    setBusy(false);
  }
  const edit = (id: string, field: "ve" | "pieces" | "single", value: string) =>
    setDrafts(current => ({ ...current, [id]: { ...(current[id] || { ve: "", pieces: "", single: "" }), [field]: value } }));

  return <section className="card" aria-label="Vape Händlerimport und Freigaben">
    <div className="card-head"><h2>Händlerimport & Produktfreigabe</h2></div>
    <p>Inhaberansicht: VE standardmäßig · Einzelstückverkauf nur nach bestätigtem Einzelbezug und separater Freigabe.
      Händler-Preiskandidaten sind keine freigegebenen Verkaufspreise.</p>
    {demo ? <p>In der Demo sind EK und Händlerimport deaktiviert.</p> : <>
      <label className="field">Nur bei späteren Händlerexporten: neue Datei einlesen (dealer-products.json)
        <input type="file" accept=".json,application/json" disabled={busy} onChange={e => void readImport(e.target.files?.[0])} />
      </label>
      {pending && <button type="button" disabled={busy} onClick={() => void importDrafts()}>
        {pending.length} Artikel als nicht freigegebene Entwürfe importieren
      </button>}
      <div className="form-grid">
        <label className="field">Produkt oder EAN suchen
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Artikel suchen …" />
        </label>
        <label className="field">Kategorie
          <select value={category} onChange={e => { setCategory(e.target.value); setPage(0); }}>
            <option value="">Alle Kategorien</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">Freigabestatus
          <select value={reviewFilter} onChange={e => { setReviewFilter(e.target.value); setPage(0); }}>
            <option value="all">Alle Produkte</option>
            <option value="pending">Ohne Freigabe</option>
            <option value="ve">VE freigegeben</option>
            <option value="single">Einzelstück freigegeben</option>
          </select>
        </label>
        <label className="field">Marge: {margin} %
          <input type="range" min="15" max="25" step="1" value={margin}
            onChange={e => setMargin(Number(e.target.value))} />
        </label>
      </div>
      <p role="status">{busy ? "Bearbeitung läuft …" : products.length + " Händlerartikel bereits im Sales Hub · " + filtered.length + " in der aktuellen Auswahl · " + products.filter(p => p.ve_approved).length + " VE-Freigaben · " + products.filter(p => p.single_approved).length + " Einzelstück-Freigaben"}</p>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {filtered.length > 25 && <div className="button-row">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Zurück</button>
        <span>Seite {currentPage + 1} von {Math.ceil(filtered.length / 25)}</span>
        <button type="button" disabled={currentPage + 1 >= Math.ceil(filtered.length / 25)} onClick={() => setPage(currentPage + 1)}>Weiter</button>
      </div>}
      {filtered.slice(currentPage * 25, currentPage * 25 + 25).map(p => <article className="card" key={p.id}>
        <h3>{p.name}</h3>
        <small>{p.supplier_article_no || "Ohne Artikelnummer"} · {p.category || "Kategorie prüfen"} · {p.ean || "EAN fehlt"}</small>
        <p>Händlerpreis-Kandidat netto: {p.supplier_price_candidate_net ? euro(p.supplier_price_candidate_net) : "fehlt"}
          {" · "}{p.price_status}</p>
        <div className="form-grid">
          <label className="field">Stück je vollständige VE
            <input type="number" min="1" step="1" disabled={busy || p.ve_approved}
              value={drafts[p.id]?.pieces ?? String(p.pieces_per_ve ?? "")}
              onChange={e => edit(p.id, "pieces", e.target.value)} />
          </label>
          <label className="field">Bestätigter EK netto je VE (€)
            <input type="number" min="0.01" step="0.01" disabled={busy || p.ve_approved}
              value={drafts[p.id]?.ve ?? String(p.ve_ek_net ?? "")}
              onChange={e => edit(p.id, "ve", e.target.value)} />
          </label>
        </div>
        {p.ve_approved && p.ve_ek_net !== null
          ? <p>VE freigegeben · VK netto: <strong>{euro(vapeSaleNet(p.ve_ek_net, margin))}</strong> · brutto:
            {" "}{euro(vapeSaleGross(vapeSaleNet(p.ve_ek_net, margin)))}</p>
          : <p>VE noch nicht freigegeben.</p>}
        <button type="button" disabled={busy} onClick={() => void (p.ve_approved ? revoke(p, "ve") : save(p, "ve"))}>
          {p.ve_approved ? "VE-Freigabe zurücknehmen" : "VE nach Prüfung freigeben"}
        </button>
        <details>
          <summary>Optionaler Einzelstückverkauf</summary>
          <p>Einzelbezug beim Großhändler: {p.supplier_single_available ? "bestätigt" : "nicht bestätigt"}</p>
          {!p.supplier_single_available && <button type="button" disabled={busy}
            onClick={() => void save(p, "supplier")}>Einzelbezug beim Großhändler bestätigt</button>}
          <label className="field">Bestätigter EK netto je Einzelstück (€)
            <input type="number" min="0.01" step="0.01" disabled={busy || p.single_approved}
              value={drafts[p.id]?.single ?? String(p.single_ek_net ?? "")}
              onChange={e => edit(p.id, "single", e.target.value)} />
          </label>
          {p.single_approved && p.single_ek_net !== null
            ? <p>Einzelstück freigegeben · VK netto: <strong>{euro(vapeSaleNet(p.single_ek_net, margin))}</strong>
              {" · "}VK brutto: {euro(vapeSaleGross(vapeSaleNet(p.single_ek_net, margin)))}</p>
            : <p>Einzelstückverkauf gesperrt.</p>}
          <button type="button" disabled={busy || (!p.supplier_single_available && !p.single_approved)}
            onClick={() => void (p.single_approved ? revoke(p, "single") : save(p, "single"))}>
            {p.single_approved ? "Einzelstück-Freigabe zurücknehmen" : "Einzelstück nach Prüfung freigeben"}
          </button>
        </details>
      </article>)}
    </>}
  </section>;
}
