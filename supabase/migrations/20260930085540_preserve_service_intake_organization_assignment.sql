create or replace function public.nx_assign_current_organization()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid;
begin
  if new.organization_id is not null then
    return new;
  end if;

  v_org := public.nx_current_organization_id();

  if v_org is null and current_user = 'service_role' then
    select o.id into v_org
    from public.nx_organizations o
    where o.owner_user_id in (select no.user_id from public.nx_owner no where no.singleton = true)
    order by o.created_at asc
    limit 1;
  end if;

  new.organization_id := v_org;
  return new;
end;
$$;

revoke all on function public.nx_assign_current_organization() from public, anon, authenticated;
