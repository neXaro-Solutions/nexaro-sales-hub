import { isExcludedChain } from "./business-search";
export type Prospect = {
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
let lastGeocode = 0;
const cache = new Map<
  string,
  { lat: number; lng: number; label: string; city: string }
>();
export async function geocode(query: string) {
  const configResponse = await fetch(
    import.meta.env.BASE_URL + "maps-config.json",
    {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!configResponse.ok)
    throw Error("Die Ortssuche ist derzeit nicht konfiguriert.");
  const config = await configResponse.json();
  if (!config.enabled)
    throw Error(
      "Die öffentliche Ortssuche ist deaktiviert. Google-Maps-Links stehen weiter bereit.",
    );
  const endpoint = new URL(config.geocoder, location.href);
  if (endpoint.protocol !== "https:" && endpoint.origin !== location.origin)
    throw Error("Ungültige Konfiguration der Ortssuche.");
  const cacheKey = query.trim().toLowerCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  if (query.trim().length < 3)
    throw Error("Bitte einen Ort oder eine vollständige Adresse eingeben.");
  const wait = Math.max(0, 1100 - (Date.now() - lastGeocode));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastGeocode = Date.now();
  const response = await fetch(
    endpoint.href +
      "?" +
      new URLSearchParams({
        q: query,
        format: "jsonv2",
        limit: "1",
        countrycodes: "de",
        addressdetails: "1",
      }),
    {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok)
    throw Error(
      "Die öffentliche Ortssuche ist gerade nicht verfügbar. Bitte später erneut versuchen.",
    );
  const rows = await response.json();
  if (!rows.length)
    throw Error("Ort nicht gefunden. Bitte PLZ und Ortsname eingeben.");
  const r = rows[0],
    lat = Number(r.lat),
    lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    throw Error("Keine gültigen Koordinaten erhalten.");
  const found = {
    lat,
    lng,
    label: String(r.display_name),
    city: String(
      r.address?.city || r.address?.town || r.address?.village || query,
    ),
  };
  cache.set(cacheKey, found);
  return found;
}
export async function findProspects(
  center: { lat: number; lng: number },
  radius: number,
  category: string,
): Promise<Prospect[]> {
  if (
    !Number.isFinite(center.lat) ||
    !Number.isFinite(center.lng) ||
    radius < 1 ||
    radius > 30
  )
    throw Error("Ungültiger Suchbereich.");
  const radiusMeters=Math.round(radius*1000);
  const selectors:Record<string,string[]>={
    all:['["shop"]','["amenity"~"^(restaurant|cafe|fast_food|bar|pub|bank|pharmacy|clinic|dentist|doctors|veterinary|fuel|car_wash|car_rental|marketplace|biergarten|nightclub)$"]','["craft"]','["office"]','["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"]','["healthcare"]','["leisure"~"^(fitness_centre|sports_centre|bowling_alley)$"]'],
    shops:['["shop"]'],food:['["amenity"~"^(cafe|restaurant|fast_food|bar|pub|biergarten)$"]'],
    vape:['["shop"~"^(kiosk|tobacco|convenience|e-cigarette)$"]'],
    services:['["craft"]','["shop"~"^(hairdresser|beauty|car_repair|laundry|dry_cleaning|copyshop|mobile_phone|computer)$"]','["amenity"~"^(car_wash|car_rental)$"]'],
    health:['["shop"~"^(beauty|hairdresser|optician|medical_supply)$"]','["amenity"~"^(pharmacy|clinic|dentist|doctors|veterinary)$"]','["healthcare"]'],
    lodging:['["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"]'],
    office:['["office"]']
  };
  const chosen=selectors[category]||selectors.all;
  const union=chosen.map(selector=>`nwr["name"]${selector}(around:${radiusMeters},${center.lat},${center.lng});`).join("");
  const q=`[out:json][timeout:40];(${union});out center tags 1200;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: new URLSearchParams({ data: q }),
    signal: AbortSignal.timeout(50000),
  });
  if (!response.ok)
    throw Error(
      "Die öffentliche Unternehmenssuche ist ausgelastet. Bitte später erneut versuchen.",
    );
  const json = await response.json();
  if (json.remark)
    throw Error(
      "Die Suche wurde nicht vollständig ausgeführt. Bitte Radius verkleinern.",
    );
  return (json.elements || [])
    .map(
      (e: {
        id: number;
        type: string;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }) => {
        const t = e.tags || {};
        if(isExcludedChain(t))return null;
        return {
          id: `${e.type}/${e.id}`,
          name: t.name || "",
          street: [t["addr:street"], t["addr:housenumber"]]
            .filter(Boolean)
            .join(" "),
          zip: t["addr:postcode"] || "",
          city: t["addr:city"] || "",
          phone: t.phone || t["contact:phone"] || "",
          website: t.website || t["contact:website"] || "",
          email: t.email || t["contact:email"] || "",
          lat: e.lat ?? e.center?.lat,
          lng: e.lon ?? e.center?.lon,
          category: t.shop || t.amenity || "",
        };
      },
    )
    .filter((p:Prospect|null):p is Prospect=>!!p&&!!p.name&&Number.isFinite(p.lat)&&Number.isFinite(p.lng))
    .sort((a:Prospect,b:Prospect)=>{
      const lat1=Math.PI/180*center.lat;
      const dx=(a.lng-center.lng)*Math.cos(lat1),dy=a.lat-center.lat;
      const ex=(b.lng-center.lng)*Math.cos(lat1),ey=b.lat-center.lat;
      return dx*dx+dy*dy-ex*ex-ey*ey;
    })
    .slice(0,150);
}
