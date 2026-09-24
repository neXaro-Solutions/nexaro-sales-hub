-- Owner-only preflight for public intake receipts (RLS is intentionally not exposed to browsers).
create or replace function public.nx_customer_has_intake(p_customer uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nx_owner where user_id=auth.uid()) then
   raise exception 'Not authorized';
 end if;
 return exists(select 1 from public.nx_intake_receipts where customer_id=p_customer);
end $$;
revoke all on function public.nx_customer_has_intake(uuid) from public,anon;
grant execute on function public.nx_customer_has_intake(uuid) to authenticated;
