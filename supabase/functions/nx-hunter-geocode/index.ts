import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

const ALLOWED_ORIGIN = "https://nexaro-solutions.github.io";
const headers = {
  ...corsHeaders,
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  Vary: "Origin",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export function parseQuery(raw: string) {
  const zip = (raw.match(/\b\d{5}\b/) || [])[0] || "";
  const place = raw
    .replace(/\b\d{5}\b/g, "")
    .replace(/,?\s*brandenburg\b/gi, "")
    .replace(/,?\s*deutschland\b/gi, "")
    .replace(/,?\s*germany\b/gi, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { zip, place };
}

async function geocode(raw: string) {
  // Geoapify returns the municipality polygon centroid for this exact town.
  // Verified settlement centre: GeoNames 2911691 via Open-Meteo, 2026-10-06.
  // Never apply this to GPS coordinates, neighbouring towns or street addresses.
  const exactTown = raw
    .toLocaleLowerCase("de-DE")
    .replace(/[,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    /^(?:15757 )?halbe(?: brandenburg)?(?: deutschland| germany)?$/.test(
      exactTown,
    )
  )
    return {
      lat: 52.11667,
      lng: 13.7,
      label: "15757 Halbe · Ortszentrum",
      city: "Halbe",
    };
  const apiKey = Deno.env.get("GEOAPIFY_API_KEY");
  if (!apiKey) throw new Error("GEOAPIFY_NOT_CONFIGURED");
  const { zip, place } = parseQuery(raw);
  const variants: URLSearchParams[] = [];

  const streetQuery =
    /\d/.test(place) ||
    /straße|strasse|str\.|weg\b|platz\b|allee\b/i.test(place);
  if (zip && place && !streetQuery) {
    variants.push(
      new URLSearchParams({
        postcode: zip,
        city: place,
        country: "Germany",
        type: "city",
        lang: "de",
        limit: "5",
        format: "json",
        apiKey,
      }),
    );
    variants.push(
      new URLSearchParams({
        postcode: zip,
        city: place,
        country: "Germany",
        lang: "de",
        limit: "5",
        format: "json",
        apiKey,
      }),
    );
  }
  if (!streetQuery)
    variants.push(
      new URLSearchParams({
        text: raw,
        type: "city",
        filter: "countrycode:de",
        lang: "de",
        limit: "5",
        format: "json",
        apiKey,
      }),
    );
  variants.push(
    new URLSearchParams({
      text: raw,
      filter: "countrycode:de",
      lang: "de",
      limit: "5",
      format: "json",
      apiKey,
    }),
  );

  const deadline = Date.now() + 12000;
  let upstreamFailed = false;
  for (const params of variants) {
    if (Date.now() >= deadline) {
      upstreamFailed = true;
      break;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(
      () => ctrl.abort(),
      Math.min(5000, deadline - Date.now()),
    );
    try {
      const res = await fetch(
        "https://api.geoapify.com/v1/geocode/search?" + params.toString(),
        { headers: { Accept: "application/json" }, signal: ctrl.signal },
      );
      const text = await res.text();
      if (!res.ok) {
        upstreamFailed = true;
        continue;
      }
      let rows: any[] = [];
      try {
        const json = JSON.parse(text);
        rows = Array.isArray(json?.results) ? json.results : [];
      } catch {
        continue;
      }
      if (!rows.length) continue;
      const ranked = rows
        .map((r) => {
          const rzip = String(r.postcode || "");
          const rcity = String(r.city || r.town || r.village || r.name || "");
          let score = 0;
          if (zip && rzip === zip) score += 100;
          if (
            place &&
            rcity.toLocaleLowerCase("de-DE") ===
              place.toLocaleLowerCase("de-DE")
          )
            score += 140;
          if (String(r.result_type || "") === "city") score += 30;
          if (String(r.result_type || "") === "postcode") score -= 60;
          return { r, score };
        })
        .sort((a, b) => b.score - a.score);
      const r = ranked[0].r;
      const lat = Number(r.lat),
        lng = Number(r.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        console.log(
          "nx-hunter-geocode success",
          JSON.stringify({
            query: raw,
            lat,
            lng,
            city: r.city || r.town || r.village || r.name || "",
            postcode: r.postcode || "",
            result_type: r.result_type || "",
          }),
        );
        return {
          lat,
          lng,
          label: String(r.formatted || r.address_line2 || raw),
          city: String(r.city || r.town || r.village || r.name || place || raw),
        };
      }
    } catch {
      upstreamFailed = true;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(
    upstreamFailed ? "GEOCODE_UNAVAILABLE" : "LOCATION_NOT_FOUND",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers,
    });
  try {
    const body = await req.json();
    const query = String(body?.query || "").trim();
    if (query.length < 3)
      return new Response(JSON.stringify({ error: "INVALID_QUERY" }), {
        status: 400,
        headers,
      });
    const result = await geocode(query);
    return new Response(JSON.stringify(result), { headers });
  } catch (e) {
    console.error(
      "nx-hunter-geocode failed",
      e instanceof Error ? e.name : "unknown",
    );
    return new Response(
      JSON.stringify({
        error: "GEOCODE_FAILED",
        message: "Standort konnte nicht bestimmt werden.",
      }),
      {
        status:
          e instanceof Error && e.message === "LOCATION_NOT_FOUND" ? 404 : 503,
        headers,
      },
    );
  }
});
