import { finite, today } from "./calculations";
export function parseCsv(text: string) {
  const input = text.replace(/^\uFEFF/, "");
  const first = input.split(/\r?\n/)[0];
  const delimiter = first.includes(";")
    ? ";"
    : first.includes("\t")
      ? "\t"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell === "") quoted = true;
      else if (quoted) quoted = false;
      else throw Error("Ungültige Anführungszeichen.");
    } else if (c === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Nicht geschlossenes Anführungszeichen.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2)
    throw Error(
      "Die Datei benötigt eine Kopfzeile und mindestens ein Produkt.",
    );
  if (rows.length > 5001)
    throw Error("Bitte höchstens 5.000 Produkte je Datei importieren.");
  const headers = rows.shift()!.map((v) => v.toLowerCase().trim());
  if (new Set(headers).size !== headers.length)
    throw Error("Spaltennamen müssen eindeutig sein.");
  return {
    headers,
    rows: rows.map((r, i) => {
      if (r.length !== headers.length)
        throw Error(`Zeile ${i + 2}: falsche Spaltenanzahl.`);
      return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
    }),
  };
}
export function decimal(value: string) {
  const v = value.replace(/[€\s]/g, "");
  const n = Number(
    v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v,
  );
  if (!v || !Number.isFinite(n)) throw Error(`Ungültige Zahl: ${value}`);
  return n;
}
export type ColumnMap = Record<
  | "sku"
  | "name"
  | "ek_net"
  | "vk_net"
  | "ean"
  | "category"
  | "stock"
  | "pack_size",
  string
>;
export function mapProducts(
  rows: Record<string, string>[],
  mapping: ColumnMap,
  supplier_id: string,
) {
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const get = (key: keyof ColumnMap) => r[mapping[key]] ?? "";
    const sku = get("sku"),
      name = get("name");
    if (!sku || !name)
      throw Error(`Zeile ${i + 2}: Artikelnummer und Name sind erforderlich.`);
    if (seen.has(sku)) throw Error(`Doppelte Artikelnummer ${sku}.`);
    seen.add(sku);
    const ek_net = finite(decimal(get("ek_net")), "EK"),
      vk_net = finite(decimal(get("vk_net")), "VK");
    const pack_size = get("pack_size")
      ? finite(decimal(get("pack_size")), "Gebinde", 1, 1000000)
      : 1;
    const stock = get("stock")
      ? finite(decimal(get("stock")), "Bestand")
      : null;
    if (
      !Number.isInteger(pack_size) ||
      (stock !== null && !Number.isInteger(stock))
    )
      throw Error(
        `Zeile ${i + 2}: Gebinde und Bestand müssen ganzzahlig sein.`,
      );
    return {
      supplier_id,
      sku,
      name,
      ek_net,
      vk_net,
      ean: get("ean"),
      category: get("category") || "Trendprodukte",
      stock,
      pack_size,
      vat: 19,
      source_date: today(),
      source_url: "",
    };
  });
}
export const aliases: Record<keyof ColumnMap, string[]> = {
  sku: ["sku", "artikelnummer", "art-nr", "artikel-nr."],
  name: ["name", "produkt", "bezeichnung", "artikel"],
  ek_net: ["ek_net", "ek", "einkaufspreis", "nettopreis"],
  vk_net: ["vk_net", "vk", "verkaufspreis"],
  ean: ["ean", "gtin"],
  category: ["category", "kategorie"],
  stock: ["stock", "bestand", "lagerbestand"],
  pack_size: ["pack_size", "ve", "gebinde"],
};
