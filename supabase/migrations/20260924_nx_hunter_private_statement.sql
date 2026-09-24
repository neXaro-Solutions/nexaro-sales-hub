-- Applied in production. Private inbound statement metadata and owner-only RLS. See Supabase migration nx_hunter_optional_private_inbound_statements.
create table if not exists public.nx_inbound_statements(receipt_id uuid primary key references public.nx_intake_receipts(id) on delete cascade,customer_id uuid not null references public.nx_customers(id) on delete cascade,storage_path text not null unique check(length(storage_path)<260),original_name text not null check(length(original_name)<=150),mime text not null check(mime in ('application/pdf','image/jpeg','image/png','image/webp')),size_bytes integer not null check(size_bytes between 1 and 8388608),uploaded_at timestamptz not null default now(),reviewed_at timestamptz);
create index if not exists nx_inbound_statements_customer_idx on public.nx_inbound_statements(customer_id,uploaded_at desc);
alter table public.nx_inbound_statements enable row level security;
revoke all on public.nx_inbound_statements from anon;
grant select,update,delete on public.nx_inbound_statements to authenticated;
drop policy if exists nx_inbound_statement_owner on public.nx_inbound_statements;
create policy nx_inbound_statement_owner on public.nx_inbound_statements for all to authenticated using(exists(select 1 from public.nx_owner where user_id=(select auth.uid()))) with check(exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
