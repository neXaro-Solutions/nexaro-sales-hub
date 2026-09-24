# neXaro HUNTER AUTO – Phase 1 (2026-09-24)

## Live components
- Public fee-comparison request: https://nexaro-solutions.github.io/new-nexaro-field-sales-crm/sumup-gebuehrencheck.html
- The shared public intake script `nx-public-intake.js` calls the existing challenge-protected `nx-public-intake` Edge Function.
- `supabase/functions/nx-public-intake/validation.ts` validates fee-check purpose, optional monthly card volume and existing provider. Server ignores any injected marketing consent fields.
- `nx_submit_intake` reuses the central customer record on matching case-insensitive email AND company; creates a SumUp follow-up task, an intake event, a separate request-contact permission record, and retains the original idempotent challenge receipt/rate limits.
- `nx_contact_permissions` records purpose-specific inbound contact request. `marketing_email` defaults **false** and has evidence/check constraints. No marketing email is sent and no feature to activate an email campaign exists in Phase 1.
- `nx_marketing_suppressions` is an owner-only centralized suppression list. Inserting an address retracts matching existing marketing status; marking the same address as marketable is blocked by database trigger. Matching customer email changes also enforce the block.
- Inside CRM: Hunter links to the public landing page; each central customer profile shows contact purpose and suppression state; Settings allows recording email-address-wide opt-outs.
- The existing `nx-email-appointments` function is unaffected: the separately authorized appointment confirmation operates on its own table/purpose.

## NOT enabled
No unsolicited bulk emails, phone bot, scraped mass business database, newsletter sending, automatic promotional campaign, promise of a guaranteed rate saving, uploaded invoice handling, or outbound email trigger. The public form requests an individual comparison; completing that request is distinct from marketing. Further marketing requires a separate appropriately evidenced opt-in or documented legally applicable exception; verify with legal counsel before enabling a campaign.

## Operator checklist
1. Open the public URL on a mobile device and review the data collection and privacy text.
2. Submit a **real owner-authorized** test inquiry using the owner's own contact details; never use fabricated business identities or third-party email addresses.
3. Check the CRM central customer record, its incoming task, source `SumUp Gebührencheck`, and `Kontaktfreigabe` panel.
4. Add a personal test email to the suppression list and confirm its status in the customer panel.
5. Have the final data protection notice, deletion/retention rules, lawful contact method and applicable provider terms checked before sending traffic to the page.
6. Turn on any later marketing dispatcher only after verified opt-in, unsubscribe process, suppression checks and consent audit have been tested. Do not reuse the appointment-email cron.

## Data-source and deployment boundaries
Only source-backed, manual OpenStreetMap searches in Hunter; no new paid vendors. Public site is GitHub Pages and CRM records are stored with Supabase owner-only RLS. The public intake function alone uses the service role server-side, after origin, challenge, size and rate-limit checks. A client-side anti-bot challenge is abuse mitigation, not a guarantee against spam.
