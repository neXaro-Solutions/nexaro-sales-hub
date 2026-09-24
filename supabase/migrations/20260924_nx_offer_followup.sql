-- Internal follow-up only. Marking an offer Gesendet never sends email/SMS.
create or replace function public.nx_offer_followup_task()
returns trigger language plpgsql set search_path = '' as $$
declare marker text := 'nx-offer-followup:' || new.id::text;
begin
 if new.customer_id is null then return new; end if;
 if new.status = 'Gesendet' and (tg_op = 'INSERT' or old.status is distinct from 'Gesendet') then
   insert into public.nx_tasks (customer_id,division,kind,title,notes,due_at,done)
   select new.customer_id,new.division,'Wiedervorlage',
     'Angebot ' || new.number || ' persönlich nachfassen',
     marker || E'\n' || 'Intern prüfen, ob und über welchen vereinbarten Kontaktweg eine Rückfrage zulässig ist. Kein automatischer Werbeversand.',
     now() + interval '3 days',false
   where not exists (select 1 from public.nx_tasks where notes like marker || E'\n%');
 elsif new.status in ('Angenommen','Abgelehnt') then
   update public.nx_tasks set done=true
   where notes like marker || E'\n%' and done=false;
 end if;
 return new;
end $$;
drop trigger if exists nx_offer_followup_task on public.nx_offers;
create trigger nx_offer_followup_task after insert or update of status on public.nx_offers
for each row execute function public.nx_offer_followup_task();
