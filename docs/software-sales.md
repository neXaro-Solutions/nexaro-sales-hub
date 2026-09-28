# Software-Vertrieb

Public software inquiries use `nx-software-sales` with a signed, origin-bound challenge, consent, honeypot, length checks, and a service-only rate-limited SQL insertion. Reusing a successful challenge does not create duplicate requests. This endpoint sends no email and does not issue invitations automatically.

Management calls validate the bearer token with Supabase Auth and require a matching `nx_owner` record. Anonymous users and non-owner accounts cannot list, edit, issue or revoke. Tables have RLS enabled and no anon/authenticated grants. This is intentional: access is through the checked Edge Function only.

CRM: Software-Vertrieb (`?nx=software`). Supports manual requests, search, statuses, notes, date-based follow-up, expiry choices 1–30 days, and revocation. Follow-ups are displayed in this module, not automatically sent as push notifications or calendar events. Archive through the status field; no permanent delete action is exposed.

Invitation plaintext is returned once and kept only in current React state. The server stores only its hash; copy the code/text before closing. E-mail links open a draft for the user to review and send. Existing invitations without request_id remain available in the overview for revocation. Invitation creation does not automatically invalidate previous codes.

Prerequisite: existing `nx_demo_invitations`/demo-access setup from the website deployment. Apply the `software_sales_workspace` migration, deploy the Edge Function with custom authentication (`verify_jwt=false`), then deploy the CRM and website. No service key belongs in browser assets.

The list currently displays at most the newest 1,000 requests/invitations and announces that limit when reached. Saved edits use the previous updated_at value to reject concurrent overwrites. Website leads begin in status new. Public submit and duplicate protection were tested end to end; management authorization and UI lifecycle are covered by automated tests with mocked sessions.
