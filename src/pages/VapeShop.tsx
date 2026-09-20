import { useEffect, useMemo, useState } from "react";
import { Camera, ImagePlus, Search, ShoppingBag, ArrowRight, X, ScanBarcode } from "lucide-react";
import { client } from "../lib/client";
import { recognizeStatement } from "../lib/ocr";
import { vapeSaleNet, vapeSaleGross } from "../lib/vapePricing";
import type { OfferDraft } from "./Offers";
import { normalize, rankProductPhoto, type Match } from "../lib/vapePhotoMatch";

type Product = {
  id: string; name: string; category: string | null; supplier_article_no: string | null;
  ean: string | null; image_url: string | null; pieces_per_ve: number | null;
  ve_approved: boolean; ve_ek_net: number | null; single_approved: boolean;
  supplier_single_available: boolean; single_ek_net: number | null;
};
const money = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

function ImageView({ product, url, className = "" }: { product: Product; url?: string; className?: string }) {
  return url ? <img className={className} src={url} alt={product.name} loading="lazy"
    referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = "none"; }} /> :
    <div className={"vape-image-placeholder " + className} role="img" aria-label={"Noch kein Produktfoto für " + product.name}>
      <ImagePlus size={36}/><span>Produktfoto ergänzen</span>
    </div>;
}

export function VapeShop({ demo, onOffer }: { demo: boolean; onOffer: (draft: OfferDraft) => void }) {
  const [products,setProducts] = useState<Product[]>([]);
  const [pictures,setPictures] = useState<Record<string,string>>({});
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("");
  const [margin,setMargin] = useState(25);
  const [page,setPage] = useState(0);
  const [active,setActive] = useState<Product | null>(null);
  const [unit,setUnit] = useState<"VE"|"Stück">("VE");
  const [quantity,setQuantity] = useState(1);
  const [loading,setLoading] = useState(!demo);
  const [photoBusy,setPhotoBusy] = useState(false);
  const [progress,setProgress] = useState("");
  const [error,setError] = useState("");
  const [matches,setMatches] = useState<Match<Product>[]>([]);
  const [photoPreview,setPhotoPreview] = useState("");
  const [scanText,setScanText] = useState("");
  const [imageBusy,setImageBusy] = useState(false);

  async function load() {
    setLoading(true);
    const {data,error:dbError} = await client.from("nx_vape_catalog").select(
      "id,name,category,supplier_article_no,ean,image_url,pieces_per_ve,ve_approved,ve_ek_net,single_approved,supplier_single_available,single_ek_net"
    ).order("name");
    if (dbError) setError("Katalog konnte nicht geladen werden: " + dbError.message);
    else { setProducts((data||[]) as Product[]); setError(""); }
    setLoading(false);
  }
  useEffect(() => { if (!demo) void load(); else setLoading(false); }, [demo]);
  useEffect(() => {
    let live=true;
    const paths=products.filter(p => p.image_url?.startsWith("nx-vape-images/"))
      .map(p => p.image_url!.slice("nx-vape-images/".length));
    if (!paths.length) return;
    void client.storage.from("nx-vape-images").createSignedUrls(paths, 3600)
      .then(({data}) => { if (!live) return; setPictures(old=>{
        const next={...old};
        data?.forEach((row,i)=>{ if(row.signedUrl) next[products.find(p=>p.image_url==="nx-vape-images/"+paths[i])?.id||""]=row.signedUrl; });
        return next;
      });});
    return () => { live=false; };
  },[products]);
  useEffect(()=>()=>{if(photoPreview) URL.revokeObjectURL(photoPreview);},[photoPreview]);
  const approved=useMemo(()=>products.filter(p=>p.ve_approved||p.single_approved),[products]);
  const categories=useMemo(()=>[...new Set(approved.map(p=>p.category||"Andere"))].sort(),[approved]);
  const shown=useMemo(()=>approved.filter(p=>(!category||(p.category||"Andere")===category)&&
    normalize(p.name+" "+(p.supplier_article_no||"")+" "+(p.ean||"")).includes(normalize(query))
  ),[approved,category,query]);
  const pages=Math.max(1,Math.ceil(shown.length/24));
  const visible=shown.slice(Math.min(page,pages-1)*24,Math.min(page,pages-1)*24+24);
  const imageFor=(p:Product)=>p.image_url?.startsWith("nx-vape-images/")?pictures[p.id]:
    p.image_url?.startsWith("https://")?p.image_url:undefined;

  async function scan(file: File | undefined) {
    if (!file) return;
    setError("");setMatches([]);setScanText("");setPhotoBusy(true);setProgress("Produktfoto wird geprüft …");
    if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size>15_000_000) {
      setError("Bitte JPG, PNG oder WebP bis 15 MB wählen.");setPhotoBusy(false);return;
    }
    setPhotoPreview(URL.createObjectURL(file));
    const codes:string[]=[];
    let text="";
    try {
      type BarcodeDetectorType = new (config:{formats:string[]}) => {
        detect:(input:ImageBitmap)=>Promise<Array<{rawValue:string}>>;
      };
      const Detector=(globalThis as unknown as {BarcodeDetector?:BarcodeDetectorType}).BarcodeDetector;
      if (Detector) {
        const bitmap=await createImageBitmap(file);
        try { codes.push(...(await new Detector({formats:["ean_13","ean_8","upc_a","code_128","qr_code"]})
          .detect(bitmap)).map(x=>x.rawValue)); } finally {bitmap.close();}
      }
    } catch { /* BarcodeDetector is optional; use on-device OCR below. */ }
    try {
      setProgress("Verpackungstext wird lokal erkannt …");
      const controller=new AbortController();
      const result=await recognizeStatement(file,controller.signal,n=>setProgress("Texterkennung "+n+" %"));
      text=result.text;
    } catch (e) {
      if (!codes.length) setError("Texterkennung fehlgeschlagen: "+(e instanceof Error?e.message:"Unbekannter Fehler"));
    } finally {setPhotoBusy(false);setProgress("");}
    setScanText(text);
    const ranked=rankProductPhoto(products,text,codes);
    setMatches(ranked);
    const exact=ranked.filter(m=>m.score>=95);
    if(exact.length===1){setActive(exact[0].item);setUnit(exact[0].item.ve_approved?"VE":"Stück");}
    else if (!ranked.length) setError("Kein sicherer Katalogtreffer. Bitte Artikelnummer/EAN oder Produktname manuell suchen.");
  }
  async function uploadImage(file:File|undefined) {
    if(!file||!active||demo)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5_000_000){
      setError("Produktfoto: bitte JPG, PNG oder WebP bis 5 MB wählen.");return;
    }
    const id=active.id;
    const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
    const path=id+"."+ext;
    setImageBusy(true);setError("");
    try {
      const {error:uploadError}=await client.storage.from("nx-vape-images")
        .upload(path,file,{contentType:file.type,upsert:true});
      if(uploadError)throw uploadError;
      const {error:dbError}=await client.from("nx_vape_catalog")
        .update({image_url:"nx-vape-images/"+path,updated_at:new Date().toISOString()}).eq("id",id);
      if(dbError)throw dbError;
      const {data}=await client.storage.from("nx-vape-images").createSignedUrl(path,3600);
      setPictures(old=>({...old,[id]:data?.signedUrl||""}));
      setProducts(old=>old.map(p=>p.id===id?{...p,image_url:"nx-vape-images/"+path}:p));
      setActive(old=>old&&old.id===id?{...old,image_url:"nx-vape-images/"+path}:old);
    }catch(e){setError("Bild konnte nicht gespeichert werden: "+(e instanceof Error?e.message:"Fehler"));}
    finally{setImageBusy(false);}
  }
  function open(p:Product){setActive(p);setUnit(p.ve_approved?"VE":"Stück");setQuantity(1);setError("");}
  function offer(p:Product) {
    const validVE=!!(p.ve_approved&&p.ve_ek_net&&p.pieces_per_ve);
    const validSingle=!!(p.single_approved&&p.supplier_single_available&&p.single_ek_net);
    const price=unit==="VE"&&validVE?p.ve_ek_net:unit==="Stück"&&validSingle?p.single_ek_net:null;
    if(!price||!Number.isSafeInteger(quantity)||quantity<1)return;
    setActive(null);
    onOffer({division:"vape",lines:[{
      name:p.name+" · "+(unit==="VE"?"1 VE = "+p.pieces_per_ve+" Stück":"Einzelstück")+
        (p.supplier_article_no?" · Art. "+p.supplier_article_no:""),
      quantity,price:vapeSaleNet(price,margin),vat:19
    }]});
  }
  return <section className="vape-shop">
    <div className="vape-shop-head">
      <div><span className="eyebrow">FÜR DEN AUSSENDIENST</span><h2>Freigegebene Vape-Produkte</h2>
        <p>Foto aufnehmen, Produkt finden, geprüften VK sehen und direkt ins Angebot übernehmen.</p></div>
      <div className="vape-shop-count">{loading?"…":approved.length}<small>verkaufsfertige Artikel</small></div>
    </div>
    <div className="card vape-scan">
      <h3><Camera size={19}/> Produkt beim Händler erkennen</h3>
      <p>Barcode/EAN und lesbarer Verpackungstext werden ausschließlich mit deinen freigegebenen CRM-Artikeln abgeglichen. Du bestätigst den Treffer.</p>
      <div className="vape-scan-actions">
        <label className="secondary vape-file-action"><Camera size={16}/> Kamera öffnen<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
          disabled={photoBusy||demo} onChange={e=>{void scan(e.target.files?.[0]);e.target.value="";}} /></label>
        <label className="secondary vape-file-action"><ImagePlus size={16}/> Foto aus Galerie / Dateien<input type="file" accept="image/jpeg,image/png,image/webp"
          disabled={photoBusy||demo} onChange={e=>{void scan(e.target.files?.[0]);e.target.value="";}} /></label>
      </div>
      {photoBusy&&<p role="status">{progress}</p>}
      {photoPreview&&<img src={photoPreview} alt="Aufgenommenes Suchfoto" className="vape-scan-preview"/>}
      {scanText&&<details><summary>Erkannten Verpackungstext prüfen</summary><p className="prewrap">{scanText}</p></details>}
      {matches.length>0&&<div className="vape-matches"><strong>Mögliche Treffer – bitte Artikel prüfen</strong>
        {matches.map(m=><button className="vape-match" key={m.item.id} onClick={()=>open(m.item)}>
          <ScanBarcode size={17}/><span><b>{m.item.name}</b><small>{m.reason} · {m.score}% Text-/Code-Übereinstimmung · {m.item.ve_approved||m.item.single_approved?"verkaufsfertig":"noch nicht freigegeben"}</small></span><ArrowRight size={16}/>
        </button>)}</div>}
    </div>
    <div className="card">
      <div className="vape-shop-filters">
        <label className="search"><Search size={18}/><input aria-label="Vape Artikel suchen" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}
          placeholder="Name, Sorte, EAN oder Artikelnummer" /></label>
        <select aria-label="Kategorie" value={category} onChange={e=>{setCategory(e.target.value);setPage(0);}}>
          <option value="">Alle Kategorien</option>{categories.map(x=><option key={x}>{x}</option>)}
        </select>
        <label className="vape-margin">Marge <strong>{margin}%</strong><input aria-label="Marge" type="range" min="15" max="25" step="1" value={margin} onChange={e=>setMargin(Number(e.target.value))}/></label>
      </div>
      <p className="hint">{shown.length} Artikel · 25 % Standardmarge, bis 15 % anpassbar · ausschließlich bestätigte EK netto und Verkaufseinheiten.</p>
    </div>
    {error&&<p className="error" role="alert">{error}</p>}
    {loading?<p role="status">Produkte werden geladen …</p>:shown.length===0?<div className="card"><p>Keine passenden freigegebenen Artikel gefunden.</p></div>:
      <div className="vape-products">{visible.map(p=><button type="button" className="vape-product-card" key={p.id} onClick={()=>open(p)}>
        <ImageView product={p} url={imageFor(p)} className="vape-product-image"/>
        <div className="vape-product-info"><small>{p.category||"Vape"} · {p.supplier_article_no||"ohne Art.-Nr."}</small>
          <strong>{p.name}</strong><span className="badge vape">{p.ve_approved?"VE freigegeben":"Stück freigegeben"}</span>
          {p.ve_approved&&p.ve_ek_net?<><b>{money(vapeSaleNet(p.ve_ek_net,margin))} netto</b>
            <small>pro VE mit {p.pieces_per_ve||"?"} Stück · {money(vapeSaleGross(vapeSaleNet(p.ve_ek_net,margin)))} brutto</small></>:
            p.single_approved&&p.single_ek_net?<b>{money(vapeSaleNet(p.single_ek_net,margin))} netto / Stück</b>:null}
          <span className="vape-card-link">Artikel öffnen <ArrowRight size={15}/></span></div>
        </button>)}</div>}
    {pages>1&&<div className="vape-pagination">
      <button className="secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Zurück</button>
      <span>Seite {Math.min(page,pages-1)+1} / {pages}</span>
      <button className="secondary" disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)}>Weiter</button>
    </div>}
    {active&&<div className="vape-detail-overlay" role="presentation" onClick={()=>setActive(null)}>
      <section className="vape-detail card" role="dialog" aria-modal="true" aria-label={"Produkt: "+active.name} onClick={e=>e.stopPropagation()}>
        <button className="icon-button vape-detail-close" aria-label="Schließen" onClick={()=>setActive(null)}><X/></button>
        <ImageView product={active} url={imageFor(active)} className="vape-detail-image"/>
        <span className="eyebrow">{active.category||"Vape"} · {active.supplier_article_no||"ohne Art.-Nr."}</span>
        <h2>{active.name}</h2>
        <p className="hint">EAN: {active.ean||"nicht hinterlegt"} · {active.pieces_per_ve?"VE: "+active.pieces_per_ve+" Stück":"VE-Größe unbekannt"}</p>
        {!demo&&<label className="secondary vape-file-action"><ImagePlus size={16}/>
          {imageBusy?"Produktfoto wird gespeichert …":"Produktfoto zu diesem Artikel hinzufügen"}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy}
            onChange={e=>{void uploadImage(e.target.files?.[0]);e.target.value="";}} /></label>}
        <p className="hint">Bilder werden geschützt im CRM gespeichert; das Foto für die Artikelsuche wird nicht gespeichert.</p>
        <div className="form-grid">
          <label className="field">Verkaufseinheit<select value={unit} onChange={e=>setUnit(e.target.value as "VE"|"Stück")}>
            <option value="VE" disabled={!active.ve_approved||!active.ve_ek_net}>Vollständige VE</option>
            <option value="Stück" disabled={!active.single_approved||!active.supplier_single_available||!active.single_ek_net}>Einzelstück (nur freigegeben)</option>
          </select></label>
          <label className="field">Menge<input type="number" min="1" max="1000" step="1" value={quantity}
            onChange={e=>setQuantity(Number(e.target.value))}/></label>
        </div>
        {!active.ve_approved&&!active.single_approved&&<p className="notice">Dieser Artikel ist im CRM vorhanden, aber noch nicht für Angebote freigegeben. Erst den Händler-EK und die Verkaufseinheit unter „Artikel freigeben“ prüfen.</p>}
        {(unit==="VE"?active.ve_approved&&active.ve_ek_net:active.single_approved&&active.single_ek_net)&&<div className="vape-detail-price">
          <small>VK je {unit} · netto / brutto inkl. 19 % MwSt.</small>
          <strong>{money(vapeSaleNet((unit==="VE"?active.ve_ek_net:active.single_ek_net)||0.01,margin))}</strong>
          <span>{money(vapeSaleGross(vapeSaleNet((unit==="VE"?active.ve_ek_net:active.single_ek_net)||0.01,margin)))}</span>
        </div>}
        <button className="primary wide" disabled={demo||!Number.isSafeInteger(quantity)||quantity<1||
          (unit==="VE"?!(active.ve_approved&&active.ve_ek_net&&active.pieces_per_ve):
            !(active.single_approved&&active.supplier_single_available&&active.single_ek_net))}
          onClick={()=>offer(active)}><ShoppingBag size={18}/> Ins Angebot übernehmen <ArrowRight size={16}/></button>
      </section>
    </div>}
  </section>;
}
