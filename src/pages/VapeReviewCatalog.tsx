import { useEffect, useMemo, useState } from "react";
import { client } from "../lib/client";
import { ImagePlus } from "lucide-react";
import { vapeSaleNet, vapeSaleGross, vapeIndicativePieceNet } from "../lib/vapePricing";

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
  const [reviewFilter, setReviewFilter] = useState("ve");
  const [page, setPage] = useState(0);
  const [margin, setMargin] = useState(25);
  const [drafts, setDrafts] = useState<Record<string, { ve: string; pieces: string; single: string }>>({});
  const [pending, setPending] = useState<SupplierDetail[] | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [batchConfirmed, setBatchConfirmed] = useState(false);

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
  const groupCandidates = useMemo(() => products.filter(p =>
    !p.ve_approved && p.pieces_per_ve !== null && p.pieces_per_ve > 0 &&
    p.supplier_price_candidate_net !== null && p.supplier_price_candidate_net > 0 &&
    /\\(VE\\s*=\\s*\\d+\\s*STK\\)/i.test(p.name) &&
    !/\\b(BUNDLE|PROMO|AKTION)\\b/i.test(p.name)), [products]);
  const veGroups = useMemo(() => {
    const groups = new Map<string, { key: string; pieces: number; price: number; products: Draft[] }>();
    for (const p of groupCandidates) {
      const pieces = p.pieces_per_ve!;
      const price = Number(p.supplier_price_candidate_net);
      const key = pieces + ":" + price.toFixed(2);
      if (!groups.has(key)) groups.set(key, { key, pieces, price, products: [] });
      groups.get(key)!.products.push(p);
    }
    return [...groups.values()].sort((a, b) => a.pieces - b.pieces || a.price - b.price);
  }, [groupCandidates]);
  const selectedBatch = veGroups.filter(g => selectedGroups.includes(g.key)).flatMap(g => g.products);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 25) - 1));

  async function uploadPdfImages(files: FileList | null) {
    if (!files?.length || demo || busy) return;
    const catalog = new Map(products.filter(p => p.source_url.startsWith("pdf://nexaro-vape-20260921/"))
      .map(p => [p.source_url.split("/").pop(), p]));
    const selected = Array.from(files);
    const invalid = selected.filter(f => !/^\\d{3}\\.jpe?g$/i.test(f.name) || f.size > 5_000_000);
    if (invalid.length) { setError("Bitte ausschließlich die nummerierten JPG-Dateien 001.jpg bis 170.jpg aus dem PDF-Bildpaket auswählen (je max. 5 MB)."); return; }
    if (!window.confirm(selected.length + " PDF-Produktbilder den vorhandenen Katalogartikeln zuordnen? Bestehende Artikeltexte und Preise bleiben unverändert.")) return;
    setBusy(true);setError("");setNotice("");
    let completed = 0;
    const failed: string[] = [];
    try {
      for (const file of selected) {
        const number = file.name.slice(0, 3);
        const product = catalog.get(number);
        if (!product) {failed.push(file.name + ": Kein entsprechender PDF-Artikel");continue;}
        const path = product.id + ".jpg";
        const {error:uploadError} = await client.storage.from("nx-vape-images")
          .upload(path,file,{contentType:"image/jpeg",upsert:true});
        if (uploadError) {failed.push(file.name + ": " + uploadError.message);continue;}
        const {data:updated,error:dbError} = await client.from("nx_vape_catalog")
          .update({image_url:"nx-vape-images/"+path,updated_at:new Date().toISOString()})
          .eq("id",product.id).select("id");
        if (dbError || !updated?.length) {failed.push(file.name + ": " + (dbError?.message||"Keine Schreibberechtigung"));continue;}
        completed++;
        setNotice(completed + " von " + selected.length + " Produktbildern gespeichert …");
      }
      if (failed.length) setError(failed.length + " Bild(er) nicht übernommen: " + failed.slice(0,8).join("; ") +
        (failed.length>8 ? " …" : "") + ". Erneutes Auswählen der fehlenden Dateien ist möglich.");
      setNotice(completed + " PDF-Produktbilder erfolgreich zugeordnet.");
    } finally {await load();setBusy(false);}
  }

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
  async function approveSelectedVE() {
    if (!selectedBatch.length || !batchConfirmed || busy) return;
    if (!window.confirm(
      selectedBatch.length + " Produkte verbindlich für VE-Verkauf freigeben? " +
      "Du bestätigst damit, dass der angezeigte Händler-EK netto den GESAMTPREIS der angegebenen VE darstellt. " +
      "Einzelstückverkauf bleibt gesperrt."
    )) return;
    setBusy(true); setError(""); setNotice("");
    let approved = 0;
    try {
      for (let i = 0; i < selectedBatch.length; i += 25) {
        const group = selectedBatch.slice(i, i + 25);
        // Match on both original candidate and VE size: do not approve a product whose
        // price or pack size changed since the user reviewed it.
        for (const p of group) {
          const { data, error: dbError } = await client.from("nx_vape_catalog")
            .update({
              ve_ek_net: p.supplier_price_candidate_net,
              ve_approved: true,
              reviewed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", p.id)
            .eq("ve_approved", false)
            .eq("pieces_per_ve", p.pieces_per_ve!)
            .eq("supplier_price_candidate_net", p.supplier_price_candidate_net!)
            .select("id");
          if (dbError) throw dbError;
          if (data?.length === 1) approved++;
        }
      }
      setSelectedGroups([]); setBatchConfirmed(false);
      setNotice(approved + " VE-Artikel freigegeben. Einzelstücke und unklare Artikel bleiben gesperrt.");
    } catch (e) {
      setError(approved + " VE-Artikel gespeichert; weitere Freigaben abgebrochen: " +
        (e instanceof Error ? e.message : "Unbekannter Datenbankfehler"));
    } finally {
      await load(); setBusy(false);
    }
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
    <div className="card-head"><h2>Dein Vape-Produktkatalog</h2></div>
    <p>Freigegebene Verpackungseinheiten direkt in „Angebote & Rechnungen“ übernehmen. Einzelstücke sind optional.</p>
    {demo ? <p>In der Demo sind EK und Händlerimport deaktiviert.</p> : <>
      <div className="metrics">
        <div className="card"><strong>{products.filter(p => p.ve_approved).length}</strong><p>Für VE-Angebote freigegeben</p></div>
        <div className="card"><strong>{products.filter(p => !p.ve_approved && !p.single_approved).length}</strong><p>Weitere Händlerartikel</p></div>
        <div className="card"><strong>{products.filter(p => p.single_approved).length}</strong><p>Einzelstück-Freigaben</p></div>
      </div>
      <div className="card" style={{background:"var(--soft-green)",borderColor:"#b7e57e"}}>
        <h3><ImagePlus size={19} style={{verticalAlign:"middle"}} /> PDF-Produktbilder zuordnen</h3>
        <p>Die 170 Produkte aus „Produkte neu mit Bild 2.pdf“ sind bereits angelegt. Das Bildpaket entpacken und alle nummerierten JPG-Dateien auswählen. Die Zuordnung erfolgt anhand der eindeutigen Nummer 001–170. Der bestehende Preis und die Freigabe werden dabei nicht verändert.</p>
        <label className="secondary vape-file-action"><ImagePlus size={17} /> {busy ? "Bilder werden verarbeitet …" : "PDF-Produktbilder hochladen"}
          <input type="file" accept="image/jpeg,.jpg,.jpeg" multiple disabled={busy}
            onChange={e=>{void uploadPdfImages(e.target.files);e.target.value="";}} />
        </label>
        <p className="hint">{products.filter(p=>p.source_url.startsWith("pdf://nexaro-vape-20260921/") && !!p.image_url).length} / 170 PDF-Bilder hinterlegt</p>
      </div>
      <details><summary>Verwaltung & zukünftige Händlerimporte (optional)</summary>
      <label className="field">Neue Händlerdatei (dealer-products.json)
        <input type="file" accept=".json,application/json" disabled={busy} onChange={e => void readImport(e.target.files?.[0])} />
      </label>
      {pending && <button type="button" disabled={busy} onClick={() => void importDrafts()}>
        {pending.length} Artikel als nicht freigegebene Entwürfe importieren
      </button>}
      <section className="card" aria-label="Sammelprüfung und VE-Sammelfreigabe">
        <h3>VE-Sammelprüfung statt 346 Einzelklicks</h3>
        <p>Bei {groupCandidates.length} Artikeln stehen VE-Größe und ein positiver Netto-Preiskandidat im Händlerexport.
          Die Liste ist nach gleicher VE-Größe und gleichem Preis gruppiert. Prüfe je Gruppe, ob der Betrag
          tatsächlich der <strong>Gesamt-EK netto für diese vollständige VE</strong> ist. Ein „ab“- oder
          Staffelpreis kann andernfalls etwas anderes bedeuten.</p>
        <p>Unklare Produkte ohne VE-Angabe, Bundles und Einzelstückpreise werden nicht mitfreigegeben.</p>
        {veGroups.map(g => <label key={g.key} style={{display:"block",padding:"0.65rem",borderBottom:"1px solid #8884"}}>
          <input type="checkbox" disabled={busy} checked={selectedGroups.includes(g.key)}
            onChange={e => {
              setBatchConfirmed(false);
              setSelectedGroups(current => e.target.checked ? [...current,g.key] : current.filter(k=>k!==g.key));
            }} />
          {" "}<strong>{g.products.length} Produkte · VE {g.pieces} Stück · EK-Kandidat {euro(g.price)} netto je VE</strong>
          <br /><small>Beispiele: {g.products.slice(0,3).map(p=>p.name).join(" · ")}</small>
        </label>)}
        <label style={{display:"block",marginTop:"1rem"}}>
          <input type="checkbox" disabled={busy || !selectedBatch.length}
            checked={batchConfirmed} onChange={e => setBatchConfirmed(e.target.checked)} />
          {" "}Ich habe die ausgewählten Gruppen geprüft und bestätige, dass der jeweilige Netto-Preis
          für die vollständige angegebene VE gilt. Die Produktvarianten innerhalb dieser Gruppen
          dürfen mit diesen Konditionen angeboten werden.
        </label>
        <button type="button" disabled={busy || !batchConfirmed || !selectedBatch.length}
          onClick={() => void approveSelectedVE()}>
          {selectedBatch.length} ausgewählte VE-Artikel gemeinsam freigeben
        </button>
      </section>
      </details>
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
            <option value="ve">Verkaufsfertige VE</option>
            <option value="all">Alle Händlerartikel</option>
            <option value="pending">Weitere Produkte (noch ohne VE-Preis)</option>
            <option value="single">Freigegebene Einzelstücke</option>
          </select>
        </label>
        <label className="field">Marge: {margin} %
          <input type="range" min="15" max="25" step="1" value={margin}
            onChange={e => setMargin(Number(e.target.value))} />
        </label>
      </div>
      <p role="status">{busy ? "Produkte werden geladen …" : filtered.length + " Produkte angezeigt"}</p>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {filtered.length > 25 && <div className="button-row">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Zurück</button>
        <span>Seite {currentPage + 1} von {Math.ceil(filtered.length / 25)}</span>
        <button type="button" disabled={currentPage + 1 >= Math.ceil(filtered.length / 25)} onClick={() => setPage(currentPage + 1)}>Weiter</button>
      </div>}
      {filtered.slice(currentPage * 25, currentPage * 25 + 25).map(p => <article className="card" key={p.id}>
        <h3>{p.name}</h3>
        <small>{p.supplier_article_no || "Ohne Artikelnummer"} · {p.category || "Vape-Artikel"} {p.pieces_per_ve ? " · VE mit " + p.pieces_per_ve + " Stück" : ""}</small>
        {p.ve_approved && p.ve_ek_net !== null && <p>
          <strong>VK netto je VE: {euro(vapeSaleNet(p.ve_ek_net, margin))}</strong>
          {" · "}inkl. 19 % MwSt.: {euro(vapeSaleGross(vapeSaleNet(p.ve_ek_net, margin)))}
        </p>}
        {p.ve_approved && p.ve_ek_net !== null && p.pieces_per_ve !== null && p.pieces_per_ve > 0 && <p className="muted">
          Rechnerischer Preis pro Stück: <strong>{euro(vapeIndicativePieceNet(vapeSaleNet(p.ve_ek_net, margin), p.pieces_per_ve))} netto</strong>
          {" · "}{euro(vapeSaleGross(vapeSaleNet(p.ve_ek_net, margin) / p.pieces_per_ve))} inkl. 19 % MwSt.
          <br /><small>Nur Vergleichswert aus dem VE-Preis – kein freigegebener Einzelstück-Verkaufspreis.</small>
        </p>}
        {!p.ve_approved && <p>Im Katalog vorhanden · Preis je Verkaufseinheit noch nicht zugeordnet.</p>}
        <details><summary>Produkt bearbeiten / Einzelstückverkauf</summary>
        <p>Händlerpreis-Kandidat netto: {p.supplier_price_candidate_net ? euro(p.supplier_price_candidate_net) : "fehlt"} · Preis je Verkaufseinheit prüfen</p>
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
        </details>
      </article>)}
    </>}
  </section>;
}
