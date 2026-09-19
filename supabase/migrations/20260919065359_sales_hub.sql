-- Independent single-owner CRM. Existing application tables are not modified.
begin;
create table public.nx_owner (singleton boolean primary key default true check(singleton), user_id uuid not null unique references auth.users(id));
alter table public.nx_owner enable row level security;
revoke all on public.nx_owner from anon, authenticated;
grant select on public.nx_owner to authenticated;
create policy owner_read on public.nx_owner for select to authenticated using(user_id=(select auth.uid()));
-- Reuse the unique, already provisioned active administrator. Fail closed otherwise.
insert into public.nx_owner(user_id) select id from public.staff_users where active and role='admin' and (select count(*) from public.staff_users where active and role='admin')=1;
create table public.nx_customers (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1,
 company text not null check(length(trim(company)) between 1 and 200), contact text not null default '' check(length(contact)<=160), email text not null default '' check(length(email)<=254), phone text not null default '' check(length(phone)<=40), street text not null default '' check(length(street)<=200), zip text not null default '' check(length(zip)<=12), city text not null default '' check(length(city)<=120), industry text not null default '' check(length(industry)<=100), source text not null default 'Manuell', notes text not null default '' check(length(notes)<=5000), lat double precision check(lat between -90 and 90), lng double precision check(lng between -180 and 180), interests text[] not null default '{sumup}' check(interests <@ array['sumup','vape']::text[] and cardinality(interests) between 1 and 2)
);
create table public.nx_opportunities (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1,
 customer_id uuid not null references public.nx_customers(id) on delete restrict, division text not null check(division in ('sumup','vape')), stage text not null default 'Neu' check(stage in ('Neu','Kontaktiert','Termin','Angebot','Gewonnen','Verloren')), potential numeric(14,2) not null default 0 check(potential between 0 and 1000000000), details jsonb not null default '{}' check(jsonb_typeof(details)='object' and octet_length(details::text)<=50000), unique(customer_id,division)
);
create table public.nx_tasks (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1,
 customer_id uuid references public.nx_customers(id) on delete restrict, division text check(division in ('sumup','vape')), title text not null check(length(trim(title)) between 1 and 240), due_at timestamptz not null, done boolean not null default false
);
create table public.nx_suppliers (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1,
 name text not null unique check(length(trim(name)) between 1 and 200), website text not null default '' check(website='' or website ~ '^https://'), terms text not null default '' check(length(terms)<=3000), shipping_net numeric(12,2) not null default 0 check(shipping_net>=0), min_order numeric(12,2) not null default 0 check(min_order>=0), lead_days int not null default 0 check(lead_days between 0 and 365)
);
create table public.nx_products (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1,
 supplier_id uuid not null references public.nx_suppliers(id) on delete restrict, sku text not null check(length(trim(sku)) between 1 and 160), ean text not null default '' check(length(ean)<=40), name text not null check(length(trim(name)) between 1 and 300), category text not null default 'Trendprodukte', ek_net numeric(12,2) not null check(ek_net>=0), vk_net numeric(12,2) not null check(vk_net>=0), vat numeric(5,2) not null default 19 check(vat between 0 and 100), stock int check(stock>=0), pack_size int not null default 1 check(pack_size between 1 and 1000000), source_date date not null default current_date, source_url text not null default '' check(source_url='' or source_url ~ '^https://'), unique(supplier_id,sku)
);
create sequence public.nx_offer_number;
create table public.nx_offers (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1,
 customer_id uuid not null references public.nx_customers(id) on delete restrict, division text not null check(division in ('sumup','vape')), number text not null unique default ('NX-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.nx_offer_number')::text,5,'0')), status text not null default 'Entwurf' check(status in ('Entwurf','Gesendet','Angenommen','Abgelehnt')), valid_until date not null, lines jsonb not null check(jsonb_typeof(lines)='array' and jsonb_array_length(lines) between 1 and 100), notes text not null default '' check(length(notes)<=5000), snapshot jsonb not null default '{}' check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=50000), net numeric(16,2) not null default 0, gross numeric(16,2) not null default 0
);
create table public.nx_routes (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1,
 day date not null unique, name text not null check(length(trim(name)) between 1 and 160), origin text not null default '' check(length(origin)<=300), stops jsonb not null check(jsonb_typeof(stops)='array' and jsonb_array_length(stops)<=40 and octet_length(stops::text)<=50000)
);
create table public.nx_events (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version int not null default 1,
 customer_id uuid references public.nx_customers(id) on delete restrict, division text check(division in ('sumup','vape')), kind text not null check(length(kind)<=100), description text not null check(length(trim(description)) between 1 and 3000)
);
create function public.nx_touch() returns trigger language plpgsql security invoker set search_path='' as $$begin new.updated_at=now();new.created_at=old.created_at;new.version=old.version+1;return new;end;$$;
create function public.nx_validate_offer() returns trigger language plpgsql security invoker set search_path='' as $$
declare l jsonb;n numeric;v numeric;q numeric;line_net numeric;
begin
 if not exists(select 1 from public.nx_opportunities where customer_id=new.customer_id and division=new.division) then raise exception 'Customer has no opportunity in this division';end if;
 new.net=0;new.gross=0;
 for l in select * from jsonb_array_elements(new.lines) loop
  if jsonb_typeof(l)<>'object' or coalesce(length(trim(l->>'name')),0) not between 1 and 300 or not (l ?& array['quantity','price','vat']) then raise exception 'Invalid line';end if;
  q=(l->>'quantity')::numeric;n=(l->>'price')::numeric;v=(l->>'vat')::numeric;
  if q is null or n is null or v is null or q not between 1 and 1000000 or n not between 0 and 1000000000 or v not between 0 and 100 then raise exception 'Invalid amount';end if;
  line_net=round(q*n,2);new.net=new.net+line_net;new.gross=new.gross+line_net+round(line_net*v/100,2);
 end loop;
 return new;
end;$$;
create trigger validate_offer before insert or update on public.nx_offers for each row execute function public.nx_validate_offer();
create function public.nx_customer_created() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.nx_opportunities(customer_id,division) select new.id,d from (select distinct unnest(new.interests) d) s;
 insert into public.nx_events(customer_id,kind,description) values(new.id,'Standort','Standort erfasst: '||new.company);
 return new;
end;$$;
create trigger customer_created after insert on public.nx_customers for each row execute function public.nx_customer_created();
do $$ declare t text; begin
 foreach t in array array['customers','opportunities','tasks','suppliers','products','offers','routes','events'] loop
  execute format('alter table public.nx_%I enable row level security',t);
  execute format('revoke all on public.nx_%I from anon, authenticated',t);
  execute format('grant select,insert,update,delete on public.nx_%I to authenticated',t);
  execute format('create policy owner_access on public.nx_%I for all to authenticated using (exists(select 1 from public.nx_owner where user_id=(select auth.uid()))) with check (exists(select 1 from public.nx_owner where user_id=(select auth.uid())))',t);
  execute format('create trigger touch before update on public.nx_%I for each row execute function public.nx_touch()',t);
 end loop;
end $$;
grant usage on sequence public.nx_offer_number to authenticated,service_role;
grant all on public.nx_owner,public.nx_customers,public.nx_opportunities,public.nx_tasks,public.nx_suppliers,public.nx_products,public.nx_offers,public.nx_routes,public.nx_events to service_role;
revoke execute on function public.nx_touch(), public.nx_validate_offer(), public.nx_customer_created() from public,anon,authenticated;
create index nx_tasks_due on public.nx_tasks(due_at) where not done;
create index nx_tasks_customer on public.nx_tasks(customer_id);
create index nx_events_customer on public.nx_events(customer_id,created_at desc);
create index nx_offers_customer on public.nx_offers(customer_id);
create index nx_products_ean on public.nx_products(ean) where ean<>'';
create index nx_customers_search on public.nx_customers(lower(company),lower(city));
-- Atomic product import. RLS is still enforced (SECURITY INVOKER).
create function public.nx_import_products(p_products jsonb) returns int language plpgsql security invoker set search_path='' as $$
declare n int;
begin
 if not exists(select 1 from public.nx_owner where user_id=auth.uid()) then raise insufficient_privilege;end if;
 if jsonb_typeof(p_products)<>'array' or jsonb_array_length(p_products) not between 1 and 5000 or octet_length(p_products::text)>5000000 then raise exception 'Invalid import size';end if;
 insert into public.nx_products(supplier_id,sku,ean,name,category,ek_net,vk_net,vat,stock,pack_size,source_date,source_url)
 select supplier_id,sku,coalesce(ean,''),name,coalesce(category,'Trendprodukte'),ek_net,vk_net,coalesce(vat,19),stock,coalesce(pack_size,1),coalesce(source_date,current_date),coalesce(source_url,'')
 from jsonb_to_recordset(p_products) as x(supplier_id uuid,sku text,ean text,name text,category text,ek_net numeric,vk_net numeric,vat numeric,stock int,pack_size int,source_date date,source_url text)
 on conflict(supplier_id,sku) do update set ean=excluded.ean,name=excluded.name,category=excluded.category,ek_net=excluded.ek_net,vk_net=excluded.vk_net,vat=excluded.vat,stock=excluded.stock,pack_size=excluded.pack_size,source_date=excluded.source_date,source_url=excluded.source_url;
 get diagnostics n=row_count;return n;
end;$$;
revoke all on function public.nx_import_products(jsonb) from public,anon;
grant execute on function public.nx_import_products(jsonb) to authenticated;
-- Intake metadata contains no raw IP addresses. No public/client access.
create table public.nx_intake_limits (key text primary key, window_start timestamptz not null, count int not null);
create table public.nx_intake_receipts (id uuid primary key, customer_id uuid not null references public.nx_customers(id), created_at timestamptz not null default now());
alter table public.nx_intake_limits enable row level security;
alter table public.nx_intake_receipts enable row level security;
revoke all on public.nx_intake_limits,public.nx_intake_receipts from public,anon,authenticated;
grant all on public.nx_intake_limits,public.nx_intake_receipts to service_role;
create index nx_intake_receipts_customer on public.nx_intake_receipts(customer_id);
create function public.nx_submit_intake(p_id uuid,p_ip_hash text,p_payload jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare cid uuid;count_now int;limit_key text;interest text[];div text;
begin
 if current_user<>'service_role' then raise insufficient_privilege;end if;
 if p_id is null or p_ip_hash is null or length(p_ip_hash)<>64 then raise exception 'Invalid request';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,0));
 if exists(select 1 from public.nx_intake_receipts where id=p_id) then return;end if;
 delete from public.nx_intake_limits where window_start<now()-interval '2 days';
 foreach limit_key in array array[p_ip_hash||':'||to_char(now(),'YYYYMMDDHH24')||':'||(extract(minute from now())::int/15)::text,'global:'||to_char(now(),'YYYYMMDDHH24')] loop
  insert into public.nx_intake_limits(key,window_start,count) values(limit_key,now(),1) on conflict(key) do update set count=public.nx_intake_limits.count+1 returning count into count_now;
  if count_now>(case when limit_key like 'global:%' then 100 else 5 end) then raise exception 'rate_limited';end if;
 end loop;
 if (p_payload->>'consent') is distinct from 'true' or coalesce(length(p_payload->>'email'),0)=0 or coalesce(length(p_payload->>'contact'),0)=0 then raise exception 'Invalid consent/contact';end if;
 interest=case p_payload->>'interest' when 'sumup' then array['sumup'] when 'vape' then array['vape'] when 'both' then array['sumup','vape'] else null end;
 if interest is null then raise exception 'Invalid interest';end if;
 insert into public.nx_customers(company,contact,email,phone,street,zip,city,industry,source,notes,interests)
 values(p_payload->>'company',p_payload->>'contact',lower(p_payload->>'email'),coalesce(p_payload->>'phone',''),coalesce(p_payload->>'street',''),coalesce(p_payload->>'zip',''),coalesce(p_payload->>'city',''),coalesce(p_payload->>'industry',''),'Kontaktformular',coalesce(p_payload->>'message',''),interest) returning id into cid;
 foreach div in array interest loop
  insert into public.nx_tasks(customer_id,division,title,due_at) values(cid,div,'Neue Anfrage beantworten · '||case div when 'sumup' then 'SumUp' else 'Vapes' end,now()+interval '1 day');
 end loop;
 insert into public.nx_events(customer_id,kind,description) values(cid,'Formularanfrage','Kontaktanfrage eingegangen; Einwilligung zur Kontaktaufnahme dokumentiert (Formularversion 1).');
 insert into public.nx_intake_receipts(id,customer_id) values(p_id,cid);
end;$$;
revoke all on function public.nx_submit_intake(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nx_submit_intake(uuid,text,jsonb) to service_role;
commit;
