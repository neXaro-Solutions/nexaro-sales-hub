export type PhotoProduct = {
  id: string; name: string; ean: string | null; supplier_article_no: string | null;
};
export type Match<T extends PhotoProduct> = { item: T; score: number; reason: string };
export const normalize = (s: string) => s.toLocaleLowerCase("de-DE").normalize("NFKD")
  .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const tokens = (s: string) => normalize(s).split(" ").filter(s => s.length >= 3 &&
  !["pod","kit","stk","ve","vape","pack","einweg","liquid","edition","sorten"].includes(s));

/** Local barcode and packaging-text lookup. A fuzzy match is never an automatic identification. */
export function rankProductPhoto<T extends PhotoProduct>(products: T[], text: string, barcodes: string[]): Match<T>[] {
  const corpus = normalize(text);
  const found = new Set(tokens(text));
  const codes = new Set(barcodes.map(x => x.replace(/\D/g,"")).filter(x => x.length >= 8));
  return products.map(item => {
    const ean = (item.ean || "").replace(/\D/g,"");
    const article = normalize(item.supplier_article_no || "");
    if (ean && (codes.has(ean) || (" "+corpus+" ").includes(" "+ean+" ")))
      return { item, score: 100, reason: "EAN / Barcode exakt" };
    if (article.length >= 4 && (" " + corpus + " ").includes(" " + article + " "))
      return { item, score: 95, reason: "Artikelnummer exakt" };
    const words = [...new Set(tokens(item.name))];
    const common = words.filter(x => found.has(x));
    const score = words.length && common.length >= 2 ?
      Math.round(100 * common.length / words.length) : 0;
    return { item, score, reason: common.length ? common.join(" · ") : "Kein Texttreffer" };
  }).filter(result => result.score >= 25).sort((a,b) => b.score - a.score).slice(0,8);
}
