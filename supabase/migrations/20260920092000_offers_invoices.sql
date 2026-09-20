-- Dedicated sequential invoice numbers and owner-only invoice records.
-- The existing offer numbering continues without renumbering historical documents.
begin;
alter table public.nx_offers alter column number set default
  ('ANG-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.nx_offer_number')::text,5,'0'));
create sequence public.nx_invoice_number;
create table public.nx_invoices (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version int not null default 1,
 customer_id uuid not null references public.nx_customers(id) on delete restrict,
 offer_id uuid references public.nx_offers(id) on delete restrict,
 division text not null check (division in ('sumup','vape')),
 number text not null unique default ('RE-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.nx_invoice_number')::text,5,'0')),
 status text not null default 'Entwurf' check (status in ('Entwurf','Offen','Bezahlt','Storniert')),
 issue_date date not null default current_date,
 service_date date not null default current_date,
 due_date date not null,
 lines jsonb not null check (jsonb_typeof(lines)='array' and jsonb_array_length(lines) between 1 and 100),
 notes text not null default '' check (length(notes)<=5000),
 snapshot jsonb not null default '{}' check (jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=50000),
 net numeric(16,2) not null default 0,
 gross numeric(16,2) not null default 0
);
-- Reuse server-side validation and VAT rounding of existing offers.
create function public.nx_validate_invoice() returns trigger language plpgsql security invoker set search_path='' as $$
declare l jsonb;n numeric;v numeric;q numeric;line_net numeric;
begin
 if new.offer_id is not null and not exists
 (select 1 from public.nx_offers o where o.id=new.offer_id and o.customer_id=new.customer_id and o.division=new.division)
 then raise exception 'Invoice offer/customer mismatch';end if;
 new.net=0;new.gross=0;
 for l in select * from jsonb_array_elements(new.lines) loop
  if jsonb_typeof(l)<>'object' or coalesce(length(trim(l->>'name')),0) not between 1 and 300
    or not (l ?& array['quantity','price','vat']) then raise exception 'Invalid invoice line';end if;
  q=(l->>'quantity')::numeric;n=(l->>'price')::numeric;v=(l->>'vat')::numeric;
  if q is null or n is null or v is null or q not between 1 and 1000000
    or n not between 0 and 1000000000 or v not between 0 and 100 then raise exception 'Invalid invoice amount';end if;
  line_net=round(q*n,2);
  new.net=new.net+line_net;
  new.gross=new.gross+line_net+round(line_net*v/100,2);
 end loop;
 return new;
end;$$;
create trigger validate_invoice before insert or update on public.nx_invoices
for each row execute function public.nx_validate_invoice();
create trigger touch before update on public.nx_invoices
for each row execute function public.nx_touch();
alter table public.nx_invoices enable row level security;
revoke all on public.nx_invoices from anon, authenticated;
grant select,insert,update,delete on public.nx_invoices to authenticated;
create policy owner_access on public.nx_invoices for all to authenticated
 using (exists(select 1 from public.nx_owner where user_id=(select auth.uid())))
 with check (exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
grant usage on sequence public.nx_invoice_number to authenticated, service_role;
grant all on public.nx_invoices to service_role;
revoke execute on function public.nx_validate_invoice() from public,anon,authenticated;
create index nx_invoices_customer on public.nx_invoices(customer_id,created_at desc);
create index nx_invoices_offer on public.nx_invoices(offer_id) where offer_id is not null;
commit;
