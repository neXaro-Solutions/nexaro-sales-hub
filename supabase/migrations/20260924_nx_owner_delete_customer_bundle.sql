-- One explicit, atomic owner-authorized deletion of a customer's non-accounting CRM bundle.
-- Never cascade through invoices or non-draft commercial offers.
create or replace function public.nx_delete_customer_bundle(p_customer uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_customer public.nx_customers%rowtype;
        v_paths jsonb := '[]'::jsonb;
        v_tasks int := 0; v_events int := 0; v_opps int := 0; v_receipts int := 0; v_drafts int := 0;
begin
 if auth.uid() is null or not exists(select 1 from public.nx_owner where user_id=auth.uid()) then
   raise exception 'Not authorized' using errcode='42501';
 end if;
 select * into v_customer from public.nx_customers where id=p_customer for update;
 if not found then raise exception 'Kundenakte nicht gefunden' using errcode='P0002'; end if;
 if exists(select 1 from public.nx_invoices where customer_id=p_customer) then
   raise exception 'Kundenakte enthält Rechnungen. Löschung aus Gründen der Belegdokumentation gesperrt.';
 end if;
 if exists(select 1 from public.nx_offers where customer_id=p_customer and status <> 'Entwurf') then
   raise exception 'Kundenakte enthält ein nicht mehr als Entwurf geführtes Angebot. Bitte zuerst geschäftliche Aufbewahrung prüfen.';
 end if;
 select coalesce(jsonb_agg(name), '[]'::jsonb) into v_paths
 from storage.objects where bucket_id='nx-client-documents' and name like p_customer::text || '/%';
 select count(*) into v_tasks from public.nx_tasks where customer_id=p_customer;
 select count(*) into v_events from public.nx_events where customer_id=p_customer;
 select count(*) into v_opps from public.nx_opportunities where customer_id=p_customer;
 select count(*) into v_receipts from public.nx_intake_receipts where customer_id=p_customer;
 select count(*) into v_drafts from public.nx_offers where customer_id=p_customer;
 delete from public.nx_tasks where customer_id=p_customer;
 delete from public.nx_events where customer_id=p_customer;
 delete from public.nx_opportunities where customer_id=p_customer;
 delete from public.nx_offers where customer_id=p_customer;
 -- Receipt relations cascade to inbound-statement metadata and email-intake receipts.
 delete from public.nx_intake_receipts where customer_id=p_customer;
 delete from public.nx_customers where id=p_customer;
 return jsonb_build_object('deleted',true,'storage_paths',v_paths,'tasks',v_tasks,'events',v_events,
   'opportunities',v_opps,'receipts',v_receipts,'draft_offers',v_drafts);
end $$;
revoke all on function public.nx_delete_customer_bundle(uuid) from public,anon;
grant execute on function public.nx_delete_customer_bundle(uuid) to authenticated;