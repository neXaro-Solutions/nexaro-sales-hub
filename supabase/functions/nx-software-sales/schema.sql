-- Service-only request management; nx-software-sales checks the authenticated nx_owner.
create table public.nx_software_requests (
 id uuid primary key default gen_random_uuid(),
 company text not null, contact text not null, email text not null,
 phone text not null default '', city text not null default '', industry text not null default '',
 users_count text not null default '', request_kind text not null default 'consultation' check(request_kind in ('consultation','demo','pilot')),
 message text not null default '',
 status text not null default 'new' check(status in ('new','contacted','demo','proposal','pilot','won','lost','archived')),
 notes text not null default '', next_contact date,
 source text not null check(source in ('website','manual')),
 consent_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index nx_software_requests_created_idx on public.nx_software_requests(created_at desc);
alter table public.nx_software_requests enable row level security;
revoke all on public.nx_software_requests from public,anon,authenticated;
grant all on public.nx_software_requests to service_role;
alter table public.nx_demo_invitations add column request_id uuid references public.nx_software_requests(id), add column created_by uuid references auth.users(id);
create index nx_demo_invitations_request_idx on public.nx_demo_invitations(request_id);
create or replace function public.nx_software_submit(p_id uuid,p_key text,p_payload jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare n integer; b timestamptz:=date_trunc('hour',clock_timestamp());
begin
 if exists(select 1 from public.nx_software_requests where id=p_id) then return p_id; end if;
 delete from public.nx_demo_limits where bucket<now()-interval '1 day';
 insert into public.nx_demo_limits as l(key,bucket,attempts) values('software:'||p_key,b,1)
 on conflict(key) do update set bucket=b,attempts=case when l.bucket=b then l.attempts+1 else 1 end returning attempts into n;
 if n>10 then raise exception 'rate_limited'; end if;
 insert into public.nx_software_requests(id,company,contact,email,phone,city,industry,users_count,request_kind,message,source,consent_at)
 values(p_id,p_payload->>'company',p_payload->>'contact',p_payload->>'email',p_payload->>'phone',p_payload->>'city',p_payload->>'industry',p_payload->>'users_count',p_payload->>'request_kind',p_payload->>'message','website',now())
 on conflict(id) do nothing;
 return p_id;
end; $$;
revoke all on function public.nx_software_submit(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nx_software_submit(uuid,text,jsonb) to service_role;
