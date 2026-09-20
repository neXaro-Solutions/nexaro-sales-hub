begin;
-- Trigger execution is unchanged; these functions are not client RPC endpoints.
revoke execute on function public.notify_new_order(), public.notify_new_dealer_registration(), public.notify_dealer_approval(), public.dispatch_admin_push() from public,anon,authenticated;
grant execute on function public.notify_new_order(), public.notify_new_dealer_registration(), public.notify_dealer_approval(), public.dispatch_admin_push() to service_role;
-- These existing endpoints already require a signed-in user in their bodies.
revoke execute on function public.get_my_dealer_catalog(), public.place_dealer_order(jsonb,text), public.reject_dealer_registration(uuid) from public,anon;
grant execute on function public.get_my_dealer_catalog(), public.place_dealer_order(jsonb,text), public.reject_dealer_registration(uuid) to authenticated,service_role;
-- Authorization is bound to the immutable Auth user ID, never an email fallback.
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.staff_users s where s.active=true and s.id=auth.uid());
$$;
commit;
