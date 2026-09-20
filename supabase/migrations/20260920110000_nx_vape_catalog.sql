-- Owner-only supplier draft. Execute via an authorized database migration.
create table if not exists public.nx_vape_catalog (
 id uuid primary key default gen_random_uuid(),
 source_url text not null unique,
 supplier_article_no text,
 ean text,
 name text not null,
 category text,
 image_url text,
 supplier_price_candidate_net numeric(12,2) check (supplier_price_candidate_net is null or supplier_price_candidate_net > 0),
 price_status text not null default 'missing',
 pieces_per_ve integer check (pieces_per_ve is null or pieces_per_ve > 0),
 ve_ek_net numeric(12,2) check (ve_ek_net is null or ve_ek_net > 0),
 ve_approved boolean not null default false,
 supplier_single_available boolean not null default false,
 single_ek_net numeric(12,2) check (single_ek_net is null or single_ek_net > 0),
 single_approved boolean not null default false,
 source_at timestamptz,
 reviewed_at timestamptz,
 updated_at timestamptz not null default now(),
 constraint nx_vape_ve_approval check (not ve_approved or (ve_ek_net > 0 and pieces_per_ve > 0)),
 constraint nx_vape_single_approval check (not single_approved or (supplier_single_available and single_ek_net > 0))
);
alter table public.nx_vape_catalog enable row level security;
revoke all on public.nx_vape_catalog from public, anon, authenticated;
grant select, insert, update on public.nx_vape_catalog to authenticated;
drop policy if exists nx_vape_owner_access on public.nx_vape_catalog;
create policy nx_vape_owner_access on public.nx_vape_catalog
for all to authenticated
using (exists (select 1 from public.nx_owner where user_id = (select auth.uid())))
with check (exists (select 1 from public.nx_owner where user_id = (select auth.uid())));
create index if not exists nx_vape_catalog_article_idx on public.nx_vape_catalog(supplier_article_no);
-- Existing public.vape_products RLS may expose historical EK to regular authenticated dealers.
-- Before enabling a dealer portal, replace its broad SELECT policy with an owner-only policy.
drop policy if exists products_select_authenticated on public.vape_products;
create policy vape_products_owner_select on public.vape_products for select to authenticated
using (exists (select 1 from public.nx_owner where user_id=(select auth.uid())));
