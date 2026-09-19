import { validatePayload } from "./validation.ts";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const url = Deno.env.get("SUPABASE_URL")!;
const origins = new Set([
  "https://nexaro-solutions.github.io",
  "https://www.nexaro-solutions.de",
  "https://nexaro-solutions.de",
]);
const encoder = new TextEncoder();
const keyPromise = crypto.subtle.importKey(
  "raw",
  encoder.encode(serviceKey),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
async function sign(s: string) {
  return hex(
    await crypto.subtle.sign("HMAC", await keyPromise, encoder.encode(s)),
  );
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": origins.has(origin)
      ? origin
      : "https://nexaro-solutions.github.io",
    "Access-Control-Allow-Headers": "content-type,apikey",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  };
  const respond = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), { status, headers });
  if (!origins.has(origin))
    return respond(403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  try {
    if (req.method === "GET") {
      const challenge = { id: crypto.randomUUID(), issued: Date.now() };
      return respond(200, {
        ...challenge,
        signature: await sign(
          `intake:${challenge.id}:${challenge.issued}:${origin}`,
        ),
      });
    }
    if (req.method !== "POST")
      return respond(405, { error: "method_not_allowed" });
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      return respond(415, { error: "json_required" });
    if (Number(req.headers.get("content-length") || 0) > 16000)
      return respond(413, { error: "too_large" });
    // Bound streamed bodies too: content-length can be absent or untrusted.
    const reader = req.body?.getReader();
    if (!reader) return respond(400, { error: "empty_body" });
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16000) {
        await reader.cancel();
        return respond(413, { error: "too_large" });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let body;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return respond(400, { error: "invalid_json" });
    }
    const c = body.challenge;
    if (
      !c ||
      typeof c.id !== "string" ||
      !/^[-0-9a-f]{36}$/.test(c.id) ||
      !Number.isSafeInteger(c.issued) ||
      typeof c.signature !== "string" ||
      !/^[0-9a-f]{64}$/.test(c.signature)
    )
      return respond(400, { error: "invalid_challenge" });
    const age = Date.now() - c.issued;
    if (age < 2000 || age > 3600000)
      return respond(400, { error: "expired_challenge" });
    const signature = new Uint8Array(
      c.signature.match(/.{2}/g).map((s: string) => parseInt(s, 16)),
    );
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await keyPromise,
        signature,
        encoder.encode(`intake:${c.id}:${c.issued}:${origin}`),
      ))
    )
      return respond(403, { error: "invalid_challenge" });
    if (body.website) return respond(400, { error: "invalid_submission" });
    let payload;
    try {
      payload = validatePayload(body.payload);
    } catch {
      return respond(400, { error: "invalid_fields" });
    }
    // IP is HMACed with the server secret; no raw IP is stored in application tables.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const response = await fetch(`${url}/rest/v1/rpc/nx_submit_intake`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_id: c.id,
        p_ip_hash: await sign("ip:" + ip),
        p_payload: payload,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      const failure = await response.text();
      return respond(failure.includes("rate_limited") ? 429 : 503, {
        error: failure.includes("rate_limited")
          ? "rate_limited"
          : "temporarily_unavailable",
      });
    }
    return respond(200, { ok: true });
  } catch {
    return respond(503, { error: "temporarily_unavailable" });
  }
});
