-- Remove only system-generated internal reminders for a deleted offer.
-- Related invoices remain protected by their existing ON DELETE RESTRICT foreign key.
create or replace function public.nx_cleanup_deleted_offer_followups()
returns trigger language plpgsql set search_path='' as $$
begin
 delete from public.nx_tasks
 where notes like ('nx-offer-followup:' || old.id::text || E'\n%')
   and title like 'Angebot % persönlich nachfassen';
 return old;
end $$;
drop trigger if exists nx_cleanup_deleted_offer_followups on public.nx_offers;
create trigger nx_cleanup_deleted_offer_followups
after delete on public.nx_offers
for each row execute function public.nx_cleanup_deleted_offer_followups();
