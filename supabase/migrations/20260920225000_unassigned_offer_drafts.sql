-- Save anonymous field-sales comparisons as real CRM drafts; assigning a customer
-- is required before an offer can be sent/accepted or converted to an invoice.
alter table public.nx_offers alter column customer_id drop not null;
create or replace function public.nx_validate_offer()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare l jsonb; n numeric; v numeric; q numeric; line_net numeric;
begin
 if new.customer_id is null then
   if new.status <> 'Entwurf' then
     raise exception 'Unassigned offers must remain drafts';
   end if;
 else
   if not exists (
     select 1 from public.nx_opportunities
     where customer_id = new.customer_id and division = new.division
   ) then raise exception 'Customer has no opportunity in this division'; end if;
 end if;
 new.net=0; new.gross=0;
 for l in select * from jsonb_array_elements(new.lines) loop
  if jsonb_typeof(l) <> 'object'
    or coalesce(length(trim(l->>'name')),0) not between 1 and 300
    or not (l ?& array['quantity','price','vat'])
    then raise exception 'Invalid line'; end if;
  q=(l->>'quantity')::numeric; n=(l->>'price')::numeric;
  v=(l->>'vat')::numeric;
  if q is null or n is null or v is null
    or q not between 1 and 1000000
    or n not between 0 and 1000000000
    or v not between 0 and 100
    then raise exception 'Invalid amount'; end if;
  line_net=round(q*n,2);
  new.net=new.net+line_net;
  new.gross=new.gross+line_net+round(line_net*v/100,2);
 end loop;
 return new;
end;
$function$;
