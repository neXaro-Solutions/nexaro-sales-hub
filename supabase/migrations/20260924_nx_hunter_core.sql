-- Hunter Core: manually shortlisted OSM business locations, separate from canonical customers.
-- Applied to hbuqzdmjqvgybwohfnqy, owner-only RLS; no scraping jobs.
create table if not exists public.nx_hunter_prospects (
 id uuid primary key default gen_random_uuid(),
 source_id text not null unique check (length(source_id) <= 160),
 company text not null check (length(company) between 1 and 250),
 street text not null default '',
 zip text not null default '',
 city text not null default '',
 industry text not null default '',
 phone text not null default '',
 website text not null default '',
 lat double precision not null check (lat between -90 and 90),
 lng double precision not null check (lng between -180 and 180),
 status text not null default 'Neu' check(status in ('Neu','Vorbereitet','Besucht','Interesse','Wiedervorlage','Kein Interesse','Übernommen')),
 note text not null default '' check(length(note)<=3000),
 customer_id uuid references public.nx_customers(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists nx_hunter_prospects_status_idx on public.nx_hunter_prospects(status);
alter table public.nx_hunter_prospects enable row level security;
revoke all on public.nx_hunter_prospects from anon;
grant select,insert,update,delete on public.nx_hunter_prospects to authenticated;
drop policy if exists nx_hunter_owner_all on public.nx_hunter_prospects;
create policy nx_hunter_owner_all on public.nx_hunter_prospects for all to authenticated
 using (exists(select 1 from public.nx_owner where user_id=(select auth.uid())))
 with check (exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
