-- Public website requests are written only by nx-software-sales/service_role.
-- Reuse the existing notification -> authenticated push dispatch path.
create or replace function public.nx_notify_software_inquiry()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
 if new.source = 'website' then
  insert into public.nx_notifications(event_key,title,body,category,target_url)
  values(
   'software-inquiry:' || new.id::text,
   'Neue Software-Anfrage',
   'Eine neue Anfrage zu neXaro CRM ist eingegangen. Jetzt im Software-Vertrieb prüfen.',
   'inquiry',
   '/new-nexaro-field-sales-crm/hub/?nx=software'
  ) on conflict(event_key) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.nx_notify_software_inquiry() from public, anon, authenticated;
grant execute on function public.nx_notify_software_inquiry() to service_role;
create trigger nx_notify_new_software_inquiry
after insert on public.nx_software_requests
for each row execute function public.nx_notify_software_inquiry();
