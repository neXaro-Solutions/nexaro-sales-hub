export type Division = "sumup" | "vape";
export const stages = [
  "Neu",
  "Kontaktiert",
  "Termin",
  "Angebot",
  "Gewonnen",
  "Verloren",
] as const;
export type Stage = (typeof stages)[number];
export type Base = {
  id: string;
  created_at: string;
  updated_at: string;
  version: number;
};
export type Customer = Base & {
  interests?: Division[];
  company: string;
  contact: string;
  email: string;
  phone: string;
  website: string;
  street: string;
  zip: string;
  city: string;
  industry: string;
  source: string;
  notes: string;
  lat: number | null;
  lng: number | null;
};
export type Opportunity = Base & {
  customer_id: string;
  division: Division;
  stage: Stage;
  potential: number;
  details: Record<string, unknown>;
};
export type Task = Base & {
  kind?: "Aufgabe" | "Termin" | "Wiedervorlage";
  notes?: string;
  customer_id: string | null;
  division: Division | null;
  title: string;
  due_at: string;
  done: boolean;
};
export type Supplier = Base & {
  name: string;
  website: string;
  terms: string;
  shipping_net: number;
  min_order: number;
  lead_days: number;
};
export type Product = Base & {
  supplier_id: string;
  sku: string;
  ean: string;
  name: string;
  category: string;
  ek_net: number;
  vk_net: number;
  vat: number;
  stock: number | null;
  pack_size: number;
  source_date: string;
  source_url: string;
};
export type OfferLine = {
  name: string;
  quantity: number;
  price: number;
  vat: number;
};
export type Offer = Base & {
  customer_id: string | null;
  division: Division;
  number: string;
  status: "Entwurf" | "An Versandserver übergeben" | "Gesendet" | "Angenommen" | "Abgelehnt";
  valid_until: string;
  lines: OfferLine[];
  notes: string;
  snapshot: Record<string, unknown>;
  net: number;
  gross: number;
};
export type Invoice = Base & {
  customer_id: string;
  offer_id: string | null;
  division: Division;
  number: string;
  status: "Entwurf" | "Offen" | "Bezahlt" | "Storniert";
  issue_date: string;
  service_date: string;
  due_date: string;
  lines: OfferLine[];
  notes: string;
  snapshot: Record<string, unknown>;
  net: number;
  gross: number;
};
export type Stop = {
  id: string;
  company: string;
  address: string;
  lat: number | null;
  lng: number | null;
};
export type Route = Base & {
  day: string;
  name: string;
  origin: string;
  stops: Stop[];
};
export type Event = Base & {
  customer_id: string | null;
  division: Division | null;
  kind: string;
  description: string;
};
export type Data = {
  customers: Customer[];
  opportunities: Opportunity[];
  tasks: Task[];
  suppliers: Supplier[];
  products: Product[];
  offers: Offer[];
  invoices: Invoice[];
  routes: Route[];
  events: Event[];
};
export type Entity = keyof Data;
export type Row<K extends Entity> = Data[K][number];
export const emptyData: Data = {
  customers: [],
  opportunities: [],
  tasks: [],
  suppliers: [],
  products: [],
  offers: [],
  invoices: [],
  routes: [],
  events: [],
};
