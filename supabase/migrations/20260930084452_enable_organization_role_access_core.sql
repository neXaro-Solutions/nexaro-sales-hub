create or replace function public.nx_current_organization_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select m.organization_id
  from public.nx_organization_members m
  where m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1
$$;

create or replace function public.nx_current_organization_role()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select m.role
  from public.nx_organization_members m
  where m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1
$$;

revoke all on function public.nx_current_organization_id() from public, anon;
revoke all on function public.nx_current_organization_role() from public, anon;
grant execute on function public.nx_current_organization_id() to authenticated;
grant execute on function public.nx_current_organization_role() to authenticated;

create or replace function public.nx_assign_current_organization()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.nx_current_organization_id();
  end if;
  return new;
end;
$$;

revoke all on function public.nx_assign_current_organization() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['nx_customers','nx_tasks','nx_routes','nx_offers','nx_invoices','nx_opportunities','nx_hunter_prospects','nx_notifications','nx_events']
  loop
    execute format('drop trigger if exists nx_assign_current_organization on public.%I', t);
    execute format('create trigger nx_assign_current_organization before insert on public.%I for each row execute function public.nx_assign_current_organization()', t);
  end loop;
end $$;

create policy nx_customers_org_select on public.nx_customers for select to authenticated using (organization_id = public.nx_current_organization_id());
create policy nx_customers_org_insert on public.nx_customers for insert to authenticated with check (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales'));
create policy nx_customers_org_update on public.nx_customers for update to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales')) with check (organization_id = public.nx_current_organization_id());
create policy nx_customers_org_delete on public.nx_customers for delete to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin'));

create policy nx_tasks_org_select on public.nx_tasks for select to authenticated using (organization_id = public.nx_current_organization_id());
create policy nx_tasks_org_insert on public.nx_tasks for insert to authenticated with check (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales'));
create policy nx_tasks_org_update on public.nx_tasks for update to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales')) with check (organization_id = public.nx_current_organization_id());
create policy nx_tasks_org_delete on public.nx_tasks for delete to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales'));

create policy nx_routes_org_select on public.nx_routes for select to authenticated using (organization_id = public.nx_current_organization_id());
create policy nx_routes_org_insert on public.nx_routes for insert to authenticated with check (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales'));
create policy nx_routes_org_update on public.nx_routes for update to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales')) with check (organization_id = public.nx_current_organization_id());
create policy nx_routes_org_delete on public.nx_routes for delete to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales'));

create policy nx_opportunities_org_select on public.nx_opportunities for select to authenticated using (organization_id = public.nx_current_organization_id());
create policy nx_opportunities_org_insert on public.nx_opportunities for insert to authenticated with check (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales'));
create policy nx_opportunities_org_update on public.nx_opportunities for update to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales')) with check (organization_id = public.nx_current_organization_id());
create policy nx_opportunities_org_delete on public.nx_opportunities for delete to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales'));

create policy nx_hunter_org_select on public.nx_hunter_prospects for select to authenticated using (organization_id = public.nx_current_organization_id());
create policy nx_hunter_org_insert on public.nx_hunter_prospects for insert to authenticated with check (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales'));
create policy nx_hunter_org_update on public.nx_hunter_prospects for update to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales')) with check (organization_id = public.nx_current_organization_id());
create policy nx_hunter_org_delete on public.nx_hunter_prospects for delete to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales'));

create policy nx_offers_org_select on public.nx_offers for select to authenticated using (organization_id = public.nx_current_organization_id());
create policy nx_offers_org_insert on public.nx_offers for insert to authenticated with check (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales'));
create policy nx_offers_org_update on public.nx_offers for update to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales')) with check (organization_id = public.nx_current_organization_id());
create policy nx_offers_org_delete on public.nx_offers for delete to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin'));

create policy nx_invoices_org_select on public.nx_invoices for select to authenticated using (organization_id = public.nx_current_organization_id());
create policy nx_invoices_org_insert on public.nx_invoices for insert to authenticated with check (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales'));
create policy nx_invoices_org_update on public.nx_invoices for update to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales')) with check (organization_id = public.nx_current_organization_id());
create policy nx_invoices_org_delete on public.nx_invoices for delete to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin'));

create policy nx_notifications_org_select on public.nx_notifications for select to authenticated using (organization_id = public.nx_current_organization_id());
create policy nx_notifications_org_update on public.nx_notifications for update to authenticated using (organization_id = public.nx_current_organization_id()) with check (organization_id = public.nx_current_organization_id());

create policy nx_events_org_select on public.nx_events for select to authenticated using (organization_id = public.nx_current_organization_id());
create policy nx_events_org_insert on public.nx_events for insert to authenticated with check (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales'));
create policy nx_events_org_update on public.nx_events for update to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales','field_sales')) with check (organization_id = public.nx_current_organization_id());
create policy nx_events_org_delete on public.nx_events for delete to authenticated using (organization_id = public.nx_current_organization_id() and public.nx_current_organization_role() in ('owner','admin','sales'));
