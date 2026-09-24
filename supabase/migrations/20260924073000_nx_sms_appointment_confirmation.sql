-- Applied to project hbuqzdmjqvgybwohfnqy on 2026-09-24.
create table if not exists public.nx_sms_appointments (
 task_id uuid primary key references public.nx_tasks(id) on delete cascade,
 enabled boolean not null default false,
 status text not null default 'planned' check(status in ('planned','sending','sent','confirmed','reschedule_requested','failed')),
 token_hash text unique,
 sent_at timestamptz,
 confirmed_at timestamptz,
 requested_at timestamptz,
 proposed_at timestamptz,
 request_note text not null default '' check(length(request_note)<=500),
 twilio_sid text,
 failure_reason text,
 scheduled_due_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.nx_sms_appointments enable row level security;
revoke all on public.nx_sms_appointments from anon;
grant select,insert,update,delete on public.nx_sms_appointments to authenticated;
drop policy if exists nx_sms_owner_all on public.nx_sms_appointments;
create policy nx_sms_owner_all on public.nx_sms_appointments for all to authenticated
 using (exists(select 1 from public.nx_owner where user_id=(select auth.uid())))
 with check (exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
create or replace function public.nx_sms_task_changed() returns trigger language plpgsql set search_path='' as $$
begin
 if old.due_at is distinct from new.due_at or old.title is distinct from new.title or old.division is distinct from new.division or old.customer_id is distinct from new.customer_id or old.kind is distinct from new.kind or old.done is distinct from new.done then
  update public.nx_sms_appointments set status='planned',token_hash=null,sent_at=null,confirmed_at=null,requested_at=null,proposed_at=null,request_note='',twilio_sid=null,failure_reason=null,scheduled_due_at=null,updated_at=now() where task_id=new.id;
 end if;
 return new;
end $$;
drop trigger if exists nx_sms_task_changed on public.nx_tasks;
create trigger nx_sms_task_changed after update on public.nx_tasks for each row execute function public.nx_sms_task_changed();
