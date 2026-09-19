export function validatePayload(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("invalid_payload");
  const p = input as Record<string, unknown>;
  const text = (key: string, max: number, required = false) => {
    const v = p[key];
    if (v !== undefined && typeof v !== "string") throw Error("invalid_" + key);
    const s = String(v ?? "").trim();
    if (s.length > max || (required && !s)) throw Error("invalid_" + key);
    return s;
  };
  if (p.consent !== true) throw Error("consent_required");
  if (!["sumup", "vape", "both"].includes(String(p.interest)))
    throw Error("invalid_interest");
  const email = text("email", 254, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error("invalid_email");
  return {
    company: text("company", 200, true),
    contact: text("contact", 160, true),
    email: email.toLowerCase(),
    phone: text("phone", 40),
    street: text("street", 200),
    zip: text("zip", 12),
    city: text("city", 120, true),
    industry: text("industry", 100),
    message: text("message", 3000),
    consent: true,
    interest: p.interest,
  };
}
