import { useEffect, useMemo, useState } from "react";
import { Camera, ImagePlus, Search, ArrowRight, X, ScanBarcode, PackageCheck, Tags, ShoppingCart, Minus, Plus, Trash2, FileText } from "lucide-react";
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

type CartEntry = { product: Product; quantity: number; unitPrice: number };
export function VapeShop({ demo, onOffer, resetCart = 0 }: { demo: boolean; onOffer: (draft: OfferDraft) => void; resetCart?: number }) {
  const [cart,setCart] = useState<CartEntry[]>([]);
  const [cartNotice,setCartNotice] = useState("");
  useEffect(() => { if (resetCart > 0) { setCart([]); setCartNotice(""); } }, [resetCart]);
  const [products,setProducts] = useState<Product[]>([]);
  const [pictures,setPictures] = useState<Record<string,string>>({});
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("");
  const [brand,setBrand] = useState("");
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
  const brands=useMemo(()=>[...new Set(approved.map(p=>p.name.toLowerCase().includes("lost mary")?"Lost Mary":p.name.toLowerCase().includes("elfbar")?"Elfbar":"Sonstige"))].sort(),[approved]);
  const shown=useMemo(()=>approved.filter(p=>(!category||(p.category||"Andere")===category)&&
    (!brand||p.name.toLowerCase().includes(brand.toLowerCase()))&&
    normalize(p.name+" "+(p.supplier_article_no||"")+" "+(p.ean||"")).includes(normalize(query))
  ),[approved,category,brand,query]);
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
  function addToCart(p: Product, amount = 1) {
    if (demo || !p.ve_approved || !p.ve_ek_net || p.pieces_per_ve !== 10 ||
        !Number.isSafeInteger(amount) || amount < 1 || amount > 1000) return;
    const unitPrice = vapeSaleNet(p.ve_ek_net,margin);
    setCart(existing => {
      const found = existing.find(x => x.product.id === p.id);
      if (found) return existing.map(x => x.product.id === p.id
        ? {...x, quantity:Math.min(1000,x.quantity+amount), unitPrice} : x);
      return existing.length >= 100 ? existing : [...existing,{product:p,quantity:amount,unitPrice}];
    });
    setCartNotice(p.name + " zum Warenkorb hinzugefügt.");
    setActive(null);
  }
  function setCartQuantity(id: string, amount: number) {
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000) return;
    setCart(existing=>existing.map(x=>x.product.id===id?{...x,quantity:amount}:x));
  }
  function checkout() {
    if (demo || !cart.length) return;
    onOffer({division:"vape",lines:cart.map(({product,quantity,unitPrice})=>({
      name:product.name+" · 1 VE = 10 Verkaufspackungen"+
        (product.supplier_article_no?" · Art. "+product.supplier_article_no:""),
      quantity,price:unitPrice,vat:19
    }))});
  }
  const cartNet = Math.round(cart.reduce((sum,x)=>sum+x.quantity*x.unitPrice,0)*100)/100;
  const cartVes = cart.reduce((sum,x)=>sum+x.quantity,0);
  return <section className="vape-shop">
    <div className="vape-shop-head">
      <div><span className="eyebrow">FÜR DEN AUSSENDIENST</span><h2>Freigegebene Vape-Produkte</h2>
        <p>Foto aufnehmen, Produkte auswählen, im Warenkorb sammeln und gemeinsam als Angebot übernehmen.</p></div>
      <div className="vape-shop-count">{loading?"…":approved.length}<small>verkaufsfertige Artikel</small></div>
    </div>
    <section className="card nx-vape-cart" aria-label="Vape Warenkorb">
      <div className="nx-vape-cart-head"><div><h3><ShoppingCart size={21}/> Warenkorb <span className="badge positive">{cart.length} Artikel</span></h3>
        <p>Mehrere Sorten sammeln · Mengen immer in vollständigen 10er-VE.</p></div>
        <strong>{money(cartNet)} netto</strong></div>
      {cart.length ? <div className="nx-vape-cart-rows">{cart.map(({product,quantity,unitPrice})=>
        <div className="nx-vape-cart-row" key={product.id}>
          <div className="nx-vape-cart-name"><strong>{product.name}</strong><small>{money(unitPrice)} netto / VE · 10 Packungen</small></div>
          <div className="nx-vape-cart-qty"><button type="button" className="icon-button" disabled={quantity<=1} aria-label={product.name+" eine VE weniger"} onClick={()=>setCartQuantity(product.id,quantity-1)}><Minus size={17}/></button>
            <input aria-label={product.name+" Anzahl VE"} type="number" min="1" max="1000" step="1" value={quantity} onChange={e=>setCartQuantity(product.id,Number(e.target.value))}/>
            <button type="button" className="icon-button" disabled={quantity>=1000} aria-label={product.name+" eine VE mehr"} onClick={()=>setCartQuantity(product.id,quantity+1)}><Plus size={17}/></button></div>
          <b>{money(quantity*unitPrice)}</b>
          <button type="button" className="icon-button" aria-label={product.name+" entfernen"} onClick={()=>setCart(old=>old.filter(x=>x.product.id!==product.id))}><Trash2 size={17}/></button>
        </div>)}</div> : <p className="nx-vape-cart-empty">Noch leer – wähle ein Produkt und tippe auf „In den Warenkorb“.</p>}
      {cartNotice && <p className="hint" role="status">{cartNotice}</p>}
      <div className="nx-vape-cart-total"><span>{cartVes} VE · {cartVes*10} Verkaufspackungen</span><span>19 % MwSt.: {money(vapeSaleGross(cartNet)-cartNet)}</span><b>Gesamt brutto: {money(vapeSaleGross(cartNet))}</b></div>
      <div className="nx-vape-cart-actions">
        <button type="button" className="primary" disabled={!cart.length||demo} onClick={checkout}><FileText size={17}/> Alle Positionen ins Angebot <ArrowRight size={17}/></button>
        <button type="button" className="secondary" disabled={!cart.length} onClick={()=>{if(window.confirm("Warenkorb leeren?"))setCart([]);}}>Warenkorb leeren</button>
      </div>
    </section>
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
        <select aria-label="Marke" value={brand} onChange={e=>{setBrand(e.target.value);setPage(0);}}><option value="">Alle Marken</option>{brands.map(x=><option key={x}>{x}</option>)}</select>
        <label className="vape-margin">Marge <strong>{margin}%</strong><input aria-label="Marge" type="range" min="15" max="25" step="1" value={margin} onChange={e=>{ const next=Number(e.target.value);setMargin(next);setCart(current=>current.map(item=>({...item,unitPrice:vapeSaleNet(item.product.ve_ek_net!,next)}))); }}/></label>
      </div>
      <p className="hint"><PackageCheck size={15} style={{verticalAlign:"middle"}} /> {shown.length} Artikel · Mindestabnahme 1 VE = 10 Verkaufspackungen · 25 % Standardmarge, bis 15 % anpassbar · VK netto.</p>
    </div>
    {error&&<p className="error" role="alert">{error}</p>}
    {loading?<p role="status">Produkte werden geladen …</p>:shown.length===0?<div className="card"><p>Keine passenden freigegebenen Artikel gefunden.</p></div>:
      <div className="vape-products">{visible.map(p=><article className="vape-product-card" key={p.id}><button type="button" className="nx-vape-card-main" onClick={()=>open(p)}>
        <ImageView product={p} url={imageFor(p)} className="vape-product-image"/>
        <div className="vape-product-info"><small>{p.category||"Vape"} · {p.supplier_article_no||"ohne Art.-Nr."}</small>
          <strong>{p.name}</strong><span className="badge vape">{p.ve_approved?"VE freigegeben":"Stück freigegeben"}</span>
          {p.ve_approved&&p.ve_ek_net?<><b>{money(vapeSaleNet(p.ve_ek_net,margin))} netto</b>
            <small>pro VE = {p.pieces_per_ve||10} Packungen · {money(vapeSaleGross(vapeSaleNet(p.ve_ek_net,margin)))} brutto</small><small><Tags size={13} style={{verticalAlign:"middle"}} /> {money(vapeSaleNet(p.ve_ek_net,margin)/(p.pieces_per_ve||10))} netto / Packung (nur Rechenwert)</small></>:
            p.single_approved&&p.single_ek_net?<b>{money(vapeSaleNet(p.single_ek_net,margin))} netto / Stück</b>:null}
          <span className="vape-card-link">Artikel öffnen <ArrowRight size={15}/></span></div>
        </button><button type="button" className="nx-vape-add" disabled={demo||!p.ve_approved||!p.ve_ek_net||p.pieces_per_ve!==10} onClick={()=>addToCart(p)}><ShoppingCart size={16}/> In den Warenkorb <Plus size={15}/></button></article>)}</div>}
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
        <p className="hint">EAN: {active.ean||"nicht hinterlegt"} · VE: {active.pieces_per_ve||10} Verkaufspackungen · Mindestabnahme 1 VE</p>
        {!demo&&<label className="secondary vape-file-action"><ImagePlus size={16}/>
          {imageBusy?"Produktfoto wird gespeichert …":"Produktfoto zu diesem Artikel hinzufügen"}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy}
            onChange={e=>{void uploadImage(e.target.files?.[0]);e.target.value="";}} /></label>}
        <p className="hint">Bilder werden geschützt im CRM gespeichert; das Foto für die Artikelsuche wird nicht gespeichert.</p>
        <div className="form-grid">
          <label className="field">Verkaufseinheit<select value={unit} onChange={e=>setUnit(e.target.value as "VE"|"Stück")}>
            <option value="VE" disabled={!active.ve_approved||!active.ve_ek_net}>Vollständige VE</option>
            <option value="Stück" disabled={true}>Einzelpackung (nur Rechenwert, nicht verkäuflich)</option>
          </select></label>
          <label className="field">Menge<input type="number" min="1" max="1000" step="1" value={quantity}
            onChange={e=>setQuantity(Number(e.target.value))}/></label>
        </div>
        {!active.ve_approved&&!active.single_approved&&<p className="notice">Dieser Artikel ist im CRM vorhanden, aber noch nicht für Angebote freigegeben. Erst den Händler-EK und die Verkaufseinheit unter „Artikel freigeben“ prüfen.</p>}
        {(unit==="VE"?active.ve_approved&&active.ve_ek_net:active.single_approved&&active.single_ek_net)&&<div className="vape-detail-price">
          <small>VK je {unit} · netto / brutto inkl. 19 % MwSt.</small>
          <strong>{money(vapeSaleNet((unit==="VE"?active.ve_ek_net:active.single_ek_net)||0.01,margin))}</strong>
          <span>{money(vapeSaleGross(vapeSaleNet((unit==="VE"?active.ve_ek_net:active.single_ek_net)||0.01,margin)))}</span>
          <small>Rechnerisch je Verkaufspackung: {money(vapeSaleNet(active.ve_ek_net||0.01,margin)/(active.pieces_per_ve||10))} netto · Verkauf nur je vollständiger VE.</small>
        </div>}
        <button className="primary wide" disabled={demo||!Number.isSafeInteger(quantity)||quantity<1||
          (unit==="VE"?!(active.ve_approved&&active.ve_ek_net&&active.pieces_per_ve):
            !(active.single_approved&&active.supplier_single_available&&active.single_ek_net))}
          onClick={()=>addToCart(active,quantity)}><ShoppingCart size={18}/> {quantity} VE in den Warenkorb <Plus size={16}/></button>
      </section>
    </div>}
  </section>;
}
