create or replace function public.nx_sync_sumup_lead_status()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.division = 'sumup' then
    update public.nx_customers
    set lead_status = new.stage,
        conversion_value = case when new.stage = 'Gewonnen' then coalesce(new.potential,0) else 0 end,
        updated_at = now()
    where id = new.customer_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists nx_sync_sumup_lead_status on public.nx_opportunities;
create trigger nx_sync_sumup_lead_status
after insert or update of stage, potential on public.nx_opportunities
for each row execute function public.nx_sync_sumup_lead_status();
