import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { client } from "./client";
import { emptyData, type Data, type Entity, type Row } from "./types";
import { demoData } from "./demo";
import { offerTotals } from "./calculations";
import {
  DOCUMENT_BUCKET,
  documentFolder,
  checkDocumentPath,
  validateDocument,
  type ClientDocument,
} from "./documents";
type Store = {
  data: Data;
  demo: boolean;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  save: <K extends Entity>(
    entity: K,
    value: Partial<Row<K>>,
  ) => Promise<Row<K>>;
  remove: (entity: Entity, id: string) => Promise<void>;
  importProducts: (products: Partial<Row<"products">>[]) => Promise<void>;
  listDocuments: (customerId: string) => Promise<ClientDocument[]>;
  uploadDocument: (customerId: string, file: File) => Promise<ClientDocument>;
  downloadDocument: (customerId: string, path: string) => Promise<Blob>;
  removeDocument: (customerId: string, path: string) => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function DataProvider({
  children,
  demo,
}: {
  children: ReactNode;
  demo: boolean;
}) {
  const [data, setData] = useState<Data>(() => (demo ? demoData() : emptyData)),
    [loading, setLoading] = useState(!demo),
    [error, setError] = useState("");
  const alive = useRef(true);
  const generation = useRef(0);
  const demoDocuments = useRef(
    new Map<string, { record: ClientDocument; file: File }>(),
  );
  const refresh = useCallback(async () => {
    if (demo) return;
    const g = ++generation.current;
    try {
      const entries = await Promise.all(
        (Object.keys(emptyData) as Entity[]).map(async (e) => {
          const all: unknown[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error } = await client
              .from("nx_" + e)
              .select("*")
              .order("id")
              .range(from, from + 999);
            if (error) throw error;
            all.push(...data);
            if (data.length < 1000) break;
          }
          return [e, all];
        }),
      );
      if (alive.current && g === generation.current) {
        setData(Object.fromEntries(entries) as Data);
        setError("");
      }
    } catch {
      if (alive.current && g === generation.current)
        setError(
          "Daten konnten nicht geladen werden. Bitte Verbindung prüfen und erneut versuchen.",
        );
    } finally {
      if (alive.current && g === generation.current) setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  async function save<K extends Entity>(
    entity: K,
    value: Partial<Row<K>>,
  ): Promise<Row<K>> {
    if (demo) {
      const existing = value.id
        ? data[entity].find((x) => x.id === value.id)
        : undefined;
      const row = {
        ...existing,
        ...value,
        id: value.id || crypto.randomUUID(),
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: (existing?.version || 0) + 1,
        ...(entity === "offers"
          ? {
              ...offerTotals((value as Partial<Row<"offers">>).lines || []),
              number:
                (value as Partial<Row<"offers">>).number ||
                "DEMO-" + (data.offers.length + 1),
            }
          : {}),
      } as Row<K>;
      setData((d) => {
        const next = {
          ...d,
          [entity]: [row, ...d[entity].filter((x) => x.id !== row.id)],
        };
        if (entity === "customers" && !existing) {
          const c = row as Row<"customers">;
          for (const division of c.interests || ["sumup"])
            next.opportunities = [
              {
                id: crypto.randomUUID(),
                created_at: row.created_at,
                updated_at: row.updated_at,
                version: 1,
                customer_id: row.id,
                division,
                stage: "Neu",
                potential: 0,
                details: {},
              },
              ...next.opportunities,
            ];
          next.events = [
            {
              id: crypto.randomUUID(),
              created_at: row.created_at,
              updated_at: row.updated_at,
              version: 1,
              customer_id: row.id,
              division: null,
              kind: "Standort",
              description: "Standort erfasst: " + c.company,
            },
            ...next.events,
          ];
        }
        return next;
      });
      return row;
    }
    const { id, version, created_at, updated_at, ...payload } = value;
    delete (payload as Record<string, unknown>).net;
    delete (payload as Record<string, unknown>).gross;
    delete (payload as Record<string, unknown>).number;
    const query = id
      ? client
          .from("nx_" + entity)
          .update(payload as Record<string, unknown>)
          .eq("id", id)
          .eq("version", version ?? 0)
      : client.from("nx_" + entity).insert(payload as Record<string, unknown>);
    const { data: rows, error } = await query.select();
    if (error)
      throw Error(
        error.code === "23505"
          ? "Dieser Eintrag existiert bereits. Bitte Daten prüfen."
          : "Speichern fehlgeschlagen. Bitte Verbindung und Eingaben prüfen.",
      );
    if (!rows?.length)
      throw Error(
        "Der Datensatz wurde zwischenzeitlich geändert. Bitte neu laden.",
      );
    ++generation.current;
    const row = rows[0] as Row<K>;
    setData((d) => ({
      ...d,
      [entity]: [row, ...d[entity].filter((x) => x.id !== row.id)],
    }));
    return row;
  }
  async function remove(entity: Entity, id: string) {
    if (!demo) {
      const { data: rows, error } = await client
        .from("nx_" + entity)
        .delete()
        .eq("id", id)
        .select("id");
      if (error)
        throw Error(
          "Löschen nicht möglich. Es bestehen eventuell noch Verknüpfungen.",
        );
      if (!rows?.length)
        throw Error("Eintrag nicht gefunden oder keine Berechtigung.");
    }
    ++generation.current;
    setData((d) => ({ ...d, [entity]: d[entity].filter((x) => x.id !== id) }));
  }
  async function importProducts(products: Partial<Row<"products">>[]) {
    if (demo) {
      const now = new Date().toISOString();
      setData((d) => {
        const updated = products.map((p) => {
          const old = d.products.find(
            (x) => x.supplier_id === p.supplier_id && x.sku === p.sku,
          );
          return {
            ...old,
            ...p,
            id: old?.id || crypto.randomUUID(),
            created_at: old?.created_at || now,
            updated_at: now,
            version: (old?.version || 0) + 1,
          } as Row<"products">;
        });
        return {
          ...d,
          products: [
            ...updated,
            ...d.products.filter((p) => !updated.some((x) => x.id === p.id)),
          ],
        };
      });
      return;
    }
    const { error } = await client.rpc("nx_import_products", {
      p_products: products,
    });
    if (error)
      throw Error(
        "Import fehlgeschlagen. Es wurden keine Produkte übernommen.",
      );
    await refresh();
  }
  function requireCustomer(id: string) {
    documentFolder(id, demo);
    if (!data.customers.some((c) => c.id === id))
      throw Error("Kundenakte nicht geladen. Bitte Daten neu laden.");
  }
  async function listDocuments(customerId: string) {
    requireCustomer(customerId);
    if (demo)
      return [...demoDocuments.current.values()]
        .map((v) => v.record)
        .filter((r) => r.path.startsWith(customerId + "/"));
    const result: ClientDocument[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data: rows, error } = await client.storage
        .from(DOCUMENT_BUCKET)
        .list(customerId, {
          limit: 100,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
      if (error)
        throw Error(
          "Dokumentenliste nicht verfügbar. Verbindung prüfen und erneut laden.",
        );
      for (const r of rows || [])
        if (r.id)
          result.push({
            path: customerId + "/" + r.name,
            name: r.name.replace(/^[0-9a-f-]{36}--/i, ""),
            size: Number(r.metadata?.size || 0),
            created_at: r.created_at || new Date(0).toISOString(),
          });
      if (!rows || rows.length < 100) break;
    }
    return result.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async function uploadDocument(customerId: string, file: File) {
    requireCustomer(customerId);
    const { mime, name } = await validateDocument(file);
    const record: ClientDocument = {
      path: customerId + "/" + crypto.randomUUID() + "--" + name,
      name,
      size: file.size,
      created_at: new Date().toISOString(),
    };
    if (demo) demoDocuments.current.set(record.path, { record, file });
    else {
      const { error } = await client.storage
        .from(DOCUMENT_BUCKET)
        .upload(record.path, file, {
          contentType: mime,
          upsert: false,
          cacheControl: "0",
        });
      if (error)
        throw Error(
          "Upload nicht bestätigt. Bitte Liste neu laden, bevor du erneut hochlädst.",
        );
    }
    return record;
  }
  async function downloadDocument(
    customerId: string,
    path: string,
  ): Promise<Blob> {
    requireCustomer(customerId);
    checkDocumentPath(customerId, path, demo);
    if (demo) {
      const value = demoDocuments.current.get(path);
      if (!value) throw Error("Datei nicht gefunden.");
      return value.file;
    }
    const { data: blob, error } = await client.storage
      .from(DOCUMENT_BUCKET)
      .download(path);
    if (error || !blob)
      throw Error(
        "Download fehlgeschlagen. Datei oder Berechtigung nicht verfügbar.",
      );
    return blob;
  }
  async function removeDocument(customerId: string, path: string) {
    requireCustomer(customerId);
    checkDocumentPath(customerId, path, demo);
    if (demo) {
      demoDocuments.current.delete(path);
      return;
    }
    const { data: removed, error } = await client.storage
      .from(DOCUMENT_BUCKET)
      .remove([path]);
    if (error || !removed?.length)
      throw Error("Löschen nicht bestätigt. Bitte Dokumentenliste neu laden.");
  }
  return (
    <Context.Provider
      value={{
        data,
        demo,
        loading,
        error,
        refresh,
        save,
        remove,
        importProducts,
        listDocuments,
        uploadDocument,
        downloadDocument,
        removeDocument,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => {
  const s = useContext(Context);
  if (!s) throw Error("Datenkontext fehlt.");
  return s;
};
