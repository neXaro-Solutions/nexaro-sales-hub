create table if not exists public.nx_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nx_organization_members (
  organization_id uuid not null references public.nx_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','sales','field_sales','read_only')),
  status text not null default 'active' check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists nx_organizations_owner_user_id_idx
  on public.nx_organizations(owner_user_id);
create index if not exists nx_organization_members_user_id_idx
  on public.nx_organization_members(user_id);
create index if not exists nx_organization_members_org_status_idx
  on public.nx_organization_members(organization_id, status);

alter table public.nx_organizations enable row level security;
alter table public.nx_organization_members enable row level security;

revoke all on table public.nx_organizations from anon;
revoke all on table public.nx_organization_members from anon;
revoke all on table public.nx_organizations from authenticated;
revoke all on table public.nx_organization_members from authenticated;
grant select on table public.nx_organizations to authenticated;
grant select on table public.nx_organization_members to authenticated;

create policy nx_organizations_owner_read
  on public.nx_organizations
  for select
  to authenticated
  using (owner_user_id = (select auth.uid()));

create policy nx_org_members_self_read
  on public.nx_organization_members
  for select
  to authenticated
  using (user_id = (select auth.uid()));

insert into public.nx_organizations (name, slug, owner_user_id)
select 'neXaro Solutions', 'nexaro-solutions', o.user_id
from public.nx_owner o
where o.singleton = true
  and not exists (
    select 1 from public.nx_organizations x where x.owner_user_id = o.user_id
  );

insert into public.nx_organization_members (organization_id, user_id, role, status)
select org.id, org.owner_user_id, 'owner', 'active'
from public.nx_organizations org
where not exists (
  select 1
  from public.nx_organization_members m
  where m.organization_id = org.id and m.user_id = org.owner_user_id
);