import { isExcludedPublicFacility } from "./public-facilities.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

type SearchBody = {
  center?: { lat?: number; lng?: number };
  radius?: number;
  category?: string;
};
type Prospect = {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  website: string;
  email: string;
  lat: number;
  lng: number;
  category: string;
};
const ALLOWED_ORIGIN = "https://nexaro-solutions.github.io";
const headers = {
  ...corsHeaders,
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  Vary: "Origin",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const categoryBatches: Record<string, string[]> = {
  all: [
    "commercial",
    "catering",
    "service",
    "healthcare",
    "accommodation",
    "rental",
    "sport",
  ],
  shops: ["commercial"],
  food: ["catering"],
  vape: ["commercial.tobacco", "commercial.convenience"],
  services: ["service"],
  health: ["healthcare"],
  lodging: ["accommodation"],
  office: ["service"],
};
const chains = [
  "kaufland",
  "lidl",
  "aldi",
  "rewe",
  "edeka",
  "netto",
  "penny",
  "norma",
  "mcdonald",
  "burger king",
  "kfc",
  "subway",
  "starbucks",
  "rossmann",
  "dm drogerie",
  "deichmann",
  "obi",
  "bauhaus",
  "hornbach",
  "toom",
  "mediamarkt",
  "saturn",
  "ikea",
  "jysk",
  "action",
  "tedi",
  "woolworth",
  "aral",
  "shell",
  "esso",
  "sparkasse",
  "volksbank",
  "deutsche bank",
  "postbank",
  "vodafone",
  "telekom",
  "o2 shop",
  "fressnapf",
  "sixt",
  "europcar",
  "hertz",
  "avis",
  "mcfit",
  "fitx",
];
const clean = (v: string) =>
  v
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const isChain = (name: string, brand = "", operator = "") =>
  [name, brand, operator].some((v) => {
    const n = clean(v);
    return chains.some(
      (c) =>
        n === c ||
        n.startsWith(c + " ") ||
        n.endsWith(" " + c) ||
        n.includes(" " + c + " "),
    );
  });
function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const r = 6371,
    p = Math.PI / 180,
    dlat = (b.lat - a.lat) * p,
    dlng = (b.lng - a.lng) * p;
  const x =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dlng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

async function geoBatch(
  center: { lat: number; lng: number },
  radius: number,
  categories: string,
) {
  const key = Deno.env.get("GEOAPIFY_API_KEY");
  if (!key) throw new Error("GEOAPIFY_NOT_CONFIGURED");
  const params = new URLSearchParams({
    categories,
    filter: `circle:${center.lng},${center.lat},${Math.round(radius * 1000)}`,
    bias: `proximity:${center.lng},${center.lat}`,
    limit: "120",
    lang: "de",
    apiKey: key,
  });
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 9000);
  try {
    const res = await fetch(
      "https://api.geoapify.com/v2/places?" + params.toString(),
      { headers: { Accept: "application/json" }, signal: c.signal },
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`GEOAPIFY_HTTP_${res.status}`);
    const json = JSON.parse(text);
    if (!Array.isArray(json?.features))
      throw new Error("INVALID_PROVIDER_RESPONSE");
    return json.features;
  } finally {
    clearTimeout(timer);
  }
}

async function geoapify(
  center: { lat: number; lng: number },
  radius: number,
  category: string,
) {
  const batches = categoryBatches[category] || categoryBatches.all;
  const settled = await Promise.allSettled(
    batches.map((x) => geoBatch(center, radius, x)),
  );
  const errors: string[] = [];
  const features: any[] = [];
  const batchCounts: Record<string, number> = {};
  settled.forEach((s, i) => {
    const k = batches[i];
    if (s.status === "fulfilled") {
      batchCounts[k] = s.value.length;
      features.push(...s.value);
    } else {
      batchCounts[k] = 0;
      errors.push(
        s.reason?.name === "AbortError" ? "TIMEOUT" : "UPSTREAM_FAILED",
      );
    }
  });
  const out: Prospect[] = [];
  for (const f of features) {
    const p = f?.properties || {},
      raw = p?.datasource?.raw || {},
      coords = f?.geometry?.coordinates || [];
    const lng = Number(coords[0]),
      lat = Number(coords[1]),
      name = String(p.name || raw.name || "").trim();
    if (
      !name ||
      (!raw.name &&
        /(?:str\.?|straße|strasse|weg|platz|allee)\s*\d+[^,]*,\s*\d{5}\b/i.test(
          name,
        )) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      distanceKm(center, { lat, lng }) > radius ||
      isChain(
        name,
        String(p.brand || raw.brand || ""),
        String(p.operator || raw.operator || ""),
      )
    )
      continue;
    const cats = Array.isArray(p.categories) ? p.categories.map(String) : [];
    if (
      isExcludedPublicFacility({ ...raw, name }) ||
      cats.some((c: string) =>
        /^(healthcare.hospital|service.(fire_station|police|ambulance_station|financial.atm|financial.payment_terminal|funeral_hall|place_of_mourning|mortuary|crematorium|advertising)|education|religion)(\.|$)/.test(
          c,
        ),
      )
    )
      continue;
    if (
      category === "vape" &&
      !/vape|tobacco|e-cigarette|convenience/i.test(name + " " + cats.join(" "))
    )
      continue;
    out.push({
      id: `geoapify/${p.place_id || raw.osm_id || name + "-" + lat + "-" + lng}`,
      name,
      street: String(
        [
          p.street || raw["addr:street"],
          p.housenumber || raw["addr:housenumber"],
        ]
          .filter(Boolean)
          .join(" "),
      ),
      zip: String(p.postcode || ""),
      city: String(p.city || p.town || p.village || p.county || ""),
      phone: String(
        p.contact?.phone || raw.phone || raw["contact:phone"] || "",
      ),
      website: String(
        p.website ||
          p.contact?.website ||
          raw.website ||
          raw["contact:website"] ||
          "",
      ),
      email: String(
        p.contact?.email || raw.email || raw["contact:email"] || "",
      ),
      lat,
      lng,
      category: String(
        cats
          .filter((c: string) =>
            /^(commercial|catering|service|healthcare|accommodation|rental|sport)(\.|$)/.test(
              c,
            ),
          )
          .sort((a: string, b: string) => b.length - a.length)[0] || "Geschäft",
      ),
    });
  }
  return { items: out, errors, batchCounts, rawCount: features.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers,
    });
  try {
    const body = (await req.json()) as SearchBody;
    const lat = body.center?.lat,
      lng = body.center?.lng,
      radius = body.radius,
      category = body.category || "all";
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      typeof radius !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(radius) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180 ||
      radius < 1 ||
      radius > 35 ||
      !Object.hasOwn(categoryBatches, category)
    )
      return new Response(JSON.stringify({ error: "INVALID_SEARCH" }), {
        status: 400,
        headers,
      });
    const center = { lat, lng };
    const g = await geoapify(center, radius, category);
    // A provider failure is never a successful empty search. Never expose CRM rows
    // through a service-role fallback or relabel saved leads as new search results.
    if (g.errors.length === categoryBatches[category].length)
      return new Response(JSON.stringify({ error: "SEARCH_UNAVAILABLE" }), {
        status: 503,
        headers,
      });
    const unique = new Map<string, Prospect>();
    for (const p of g.items) {
      const k =
        clean(p.name) +
        "|" +
        clean(p.street) +
        "|" +
        p.zip +
        "|" +
        p.lat.toFixed(4) +
        "|" +
        p.lng.toFixed(4);
      if (!unique.has(k)) unique.set(k, p);
    }
    const items = [...unique.values()]
      .sort((a, b) => distanceKm(center, a) - distanceKm(center, b))
      .slice(0, 180);
    const partial = g.errors.length > 0;
    const truncated =
      Object.values(g.batchCounts).some((n) => n >= 120) || unique.size > 180;
    console.log(
      "nx-hunter-search v13",
      JSON.stringify({
        center,
        items: items.length,
        rawCount: g.rawCount,
        batchCounts: g.batchCounts,
        partial,
        truncated,
        radius,
        category,
      }),
    );
    return new Response(
      JSON.stringify({
        items,
        center,
        partial,
        truncated,
        source: "nx-hunter-search-v13",
      }),
      { headers },
    );
  } catch {
    console.error("nx-hunter-search request failed");
    return new Response(JSON.stringify({ error: "SEARCH_FAILED" }), {
      status: 503,
      headers,
    });
  }
});
