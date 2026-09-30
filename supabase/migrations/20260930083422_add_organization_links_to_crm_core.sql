alter table public.nx_customers add column if not exists organization_id uuid references public.nx_organizations(id) on delete restrict;
alter table public.nx_tasks add column if not exists organization_id uuid references public.nx_organizations(id) on delete restrict;
alter table public.nx_routes add column if not exists organization_id uuid references public.nx_organizations(id) on delete restrict;
alter table public.nx_offers add column if not exists organization_id uuid references public.nx_organizations(id) on delete restrict;
alter table public.nx_invoices add column if not exists organization_id uuid references public.nx_organizations(id) on delete restrict;
alter table public.nx_opportunities add column if not exists organization_id uuid references public.nx_organizations(id) on delete restrict;
alter table public.nx_hunter_prospects add column if not exists organization_id uuid references public.nx_organizations(id) on delete restrict;
alter table public.nx_notifications add column if not exists organization_id uuid references public.nx_organizations(id) on delete restrict;
alter table public.nx_events add column if not exists organization_id uuid references public.nx_organizations(id) on delete restrict;

update public.nx_customers set organization_id=(select id from public.nx_organizations where slug='nexaro-solutions' limit 1) where organization_id is null;
update public.nx_tasks set organization_id=(select id from public.nx_organizations where slug='nexaro-solutions' limit 1) where organization_id is null;
update public.nx_routes set organization_id=(select id from public.nx_organizations where slug='nexaro-solutions' limit 1) where organization_id is null;
update public.nx_offers set organization_id=(select id from public.nx_organizations where slug='nexaro-solutions' limit 1) where organization_id is null;
update public.nx_invoices set organization_id=(select id from public.nx_organizations where slug='nexaro-solutions' limit 1) where organization_id is null;
update public.nx_opportunities set organization_id=(select id from public.nx_organizations where slug='nexaro-solutions' limit 1) where organization_id is null;
update public.nx_hunter_prospects set organization_id=(select id from public.nx_organizations where slug='nexaro-solutions' limit 1) where organization_id is null;
update public.nx_notifications set organization_id=(select id from public.nx_organizations where slug='nexaro-solutions' limit 1) where organization_id is null;
update public.nx_events set organization_id=(select id from public.nx_organizations where slug='nexaro-solutions' limit 1) where organization_id is null;

create index if not exists nx_customers_organization_id_idx on public.nx_customers(organization_id);
create index if not exists nx_tasks_organization_id_idx on public.nx_tasks(organization_id);
create index if not exists nx_routes_organization_id_idx on public.nx_routes(organization_id);
create index if not exists nx_offers_organization_id_idx on public.nx_offers(organization_id);
create index if not exists nx_invoices_organization_id_idx on public.nx_invoices(organization_id);
create index if not exists nx_opportunities_organization_id_idx on public.nx_opportunities(organization_id);
create index if not exists nx_hunter_prospects_organization_id_idx on public.nx_hunter_prospects(organization_id);
create index if not exists nx_notifications_organization_id_idx on public.nx_notifications(organization_id);
create index if not exists nx_events_organization_id_idx on public.nx_events(organization_id);