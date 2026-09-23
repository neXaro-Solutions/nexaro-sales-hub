-- iCloud CalDAV sync metadata only. NO Apple account details or passwords in tables.
-- Separate records without FK allow later detection of removed CRM appointments.
begin;
create table public.nx_icloud_sync (
 task_id uuid primary key,
 event_href text not null default '',
 etag text not null default '',
 synced_version integer not null default 0,
 last_attempt timestamptz,
 last_success timestamptz,
 last_error text not null default '' check(length(last_error)<=500)
);
alter table public.nx_icloud_sync enable row level security;
revoke all on public.nx_icloud_sync from public,anon,authenticated;
grant select on public.nx_icloud_sync to authenticated;
create policy owner_read on public.nx_icloud_sync for select to authenticated
 using (exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
grant all on public.nx_icloud_sync to service_role;
commit;
