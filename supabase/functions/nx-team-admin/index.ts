import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, serviceKey);

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const payload = await req.json().catch(() => ({}));
  const action = String(payload.action || "list");

  const { data: membership } = await admin
    .from("nx_organization_members")
    .select("organization_id, role, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return json({ error: "Forbidden" }, 403);

  if (action === "activate-self") {
    if (membership.status === "disabled") return json({ error: "Dieser Zugang wurde deaktiviert." }, 403);
    if (membership.status === "invited") {
      const { error } = await admin.from("nx_organization_members").update({ status: "active", updated_at: new Date().toISOString() }).eq("organization_id", membership.organization_id).eq("user_id", user.id).eq("status", "invited");
      if (error) return json({ error: error.message }, 500);
    }
    return json({ ok: true, role: membership.role, organizationId: membership.organization_id });
  }

  if (membership.status !== "active" || !["owner", "admin"].includes(membership.role)) return json({ error: "Forbidden" }, 403);

  if (action === "list") {
    const { data: org } = await admin.from("nx_organizations").select("id,name,slug").eq("id", membership.organization_id).single();
    const { data: members, error } = await admin
      .from("nx_organization_members")
      .select("user_id,role,status,created_at,updated_at")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 500);
    const rows = await Promise.all((members || []).map(async (m) => {
      const result = await admin.auth.admin.getUserById(m.user_id);
      return { ...m, email: result.data.user?.email || "" };
    }));
    return json({ ok: true, organization: org, members: rows, myRole: membership.role });
  }

  if (action === "invite") {
    const email = String(payload.email || "").trim().toLowerCase();
    const role = String(payload.role || "sales");
    if (!email || !["admin","sales","field_sales","read_only"].includes(role)) return json({ error: "Ungültige Einladung." }, 400);
    const redirectTo = String(payload.redirectTo || "https://nexaro-solutions.github.io/new-nexaro-field-sales-crm/hub/");
    const invite = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { nx_org_id: membership.organization_id } });
    if (invite.error || !invite.data.user) return json({ error: invite.error?.message || "Einladung fehlgeschlagen." }, 400);
    const { error: upsertError } = await admin.from("nx_organization_members").upsert({ organization_id: membership.organization_id, user_id: invite.data.user.id, role, status: "invited", updated_at: new Date().toISOString() }, { onConflict: "organization_id,user_id" });
    if (upsertError) return json({ error: upsertError.message }, 500);
    return json({ ok: true, email, role });
  }

  if (action === "set-role") {
    if (membership.role !== "owner") return json({ error: "Nur der Owner kann Rollen ändern." }, 403);
    const userId = String(payload.userId || "");
    const role = String(payload.role || "");
    if (!userId || !["admin","sales","field_sales","read_only"].includes(role)) return json({ error: "Ungültige Rolle." }, 400);
    const { error } = await admin.from("nx_organization_members").update({ role, updated_at: new Date().toISOString() }).eq("organization_id", membership.organization_id).eq("user_id", userId).neq("role", "owner");
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === "set-status") {
    if (membership.role !== "owner") return json({ error: "Nur der Owner kann Zugänge deaktivieren." }, 403);
    const userId = String(payload.userId || "");
    const status = String(payload.status || "");
    if (!userId || !["active","disabled"].includes(status)) return json({ error: "Ungültiger Status." }, 400);
    const { error } = await admin.from("nx_organization_members").update({ status, updated_at: new Date().toISOString() }).eq("organization_id", membership.organization_id).eq("user_id", userId).neq("role", "owner");
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});