export const DOCUMENT_BUCKET = "nx-client-documents";
export const DOCUMENT_LIMIT = 10 * 1024 * 1024;
export type ClientDocument = {
  path: string;
  name: string;
  size: number;
  created_at: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function documentFolder(customerId: string, demo = false) {
  if (!uuid.test(customerId) && !(demo && /^demo-c[1-3]$/.test(customerId)))
    throw Error("Ungültige Kundenakte.");
  return customerId;
}
export function safeDocumentName(name: string) {
  const clean = name
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/\.{2,}/g, "_")
    .slice(0, 150);
  if (!clean || clean.startsWith("."))
    throw Error("Bitte einen eindeutigen Dateinamen verwenden.");
  return clean;
}
export function checkDocumentPath(
  customerId: string,
  path: string,
  demo = false,
) {
  const folder = documentFolder(customerId, demo);
  if (
    !path.startsWith(folder + "/") ||
    path.split("/").length !== 2 ||
    path.includes("..")
  )
    throw Error("Die Datei gehört nicht zu dieser Kundenakte.");
  return path;
}
export async function validateDocument(file: File) {
  if (!file.size || file.size > DOCUMENT_LIMIT)
    throw Error("Dateien müssen zwischen 1 Byte und 10 MB groß sein.");
  const extensions: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    txt: "text/plain",
  };
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const mime = extensions[ext];
  if (!mime || (file.type && file.type !== mime))
    throw Error(
      "Erlaubt sind PDF, JPG, PNG, WebP und TXT mit passendem Dateityp.",
    );
  const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const ascii = new TextDecoder().decode(bytes);
  const valid =
    ext === "pdf"
      ? ascii.startsWith("%PDF-")
      : ext === "png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
        : ext === "jpg" || ext === "jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : ext === "webp"
            ? ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP"
            : !bytes.includes(0);
  if (!valid) throw Error("Dateiinhalt und Dateityp passen nicht zusammen.");
  return { mime, name: safeDocumentName(file.name) };
}
