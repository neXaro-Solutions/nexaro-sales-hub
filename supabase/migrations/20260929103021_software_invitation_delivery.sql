-- Software contacts use the central customer file without creating SumUp/Vape opportunities.
alter table public.nx_customers add column crm_software boolean not null default false;
alter table public.nx_customers drop constraint nx_customers_interests_check;
alter table public.nx_customers add constraint nx_customers_interests_check check
 (interests <@ array['sumup','vape']::text[] and cardinality(interests)<=2 and (cardinality(interests)>=1 or crm_software));
alter table public.nx_software_requests add column customer_id uuid references public.nx_customers(id) on delete set null;
create index nx_software_requests_customer_idx on public.nx_software_requests(customer_id);

create function public.nx_link_software_customer(p_id uuid, p_customer_id uuid default null, p_create boolean default false)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare r public.nx_software_requests%rowtype; c uuid; n integer;
begin
 select * into r from public.nx_software_requests where id=p_id for update;
 if not found then raise exception 'request_not_found'; end if;
 if r.customer_id is not null then return r.customer_id; end if;
 -- Serialize submissions for the same address. Never overwrite an existing customer's data.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(btrim(r.email)), 0));
 if p_customer_id is not null then
  select id into c from public.nx_customers where id=p_customer_id;
  if c is null then raise exception 'customer_not_found'; end if;
 else
  select count(*) into n from public.nx_customers where lower(btrim(email))=lower(btrim(r.email)) and lower(btrim(company))=lower(btrim(r.company));
  if n=1 then
   select id into c from public.nx_customers where lower(btrim(email))=lower(btrim(r.email)) and lower(btrim(company))=lower(btrim(r.company));
  else
   if not p_create and exists(select 1 from public.nx_customers where lower(btrim(email))=lower(btrim(r.email)) or lower(btrim(company))=lower(btrim(r.company))) then return null; end if;
   insert into public.nx_customers(company,contact,email,phone,city,industry,source,interests,crm_software)
   values(r.company,r.contact,r.email,r.phone,r.city,r.industry,'CRM Software','{}',true) returning id into c;
  end if;
 end if;
 update public.nx_customers set crm_software=true where id=c and not crm_software;
 update public.nx_software_requests set customer_id=c,updated_at=now() where id=r.id;
 insert into public.nx_events(customer_id,kind,description) values(c,'CRM Software','Software-Anfrage zentral verknüpft: '||r.company);
 return c;
end; $$;
revoke all on function public.nx_link_software_customer(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.nx_link_software_customer(uuid,uuid,boolean) to service_role;
create function public.nx_software_customer_created() returns trigger language plpgsql security invoker set search_path='' as $$
begin perform public.nx_link_software_customer(new.id); return new; end; $$;
revoke all on function public.nx_software_customer_created() from public,anon,authenticated;
grant execute on function public.nx_software_customer_created() to service_role;
create trigger nx_link_new_software_customer after insert on public.nx_software_requests for each row execute function public.nx_software_customer_created();

-- One dispatch per invitation. Pending/uncertain SMTP results must never be retried automatically.
create table public.nx_software_mail_delivery (
 invitation_id uuid primary key references public.nx_demo_invitations(id) on delete cascade,
 request_id uuid not null references public.nx_software_requests(id) on delete cascade,
 recipient text not null, subject text not null,
 status text not null default 'sending' check(status in ('sending','accepted','unknown')),
 created_at timestamptz not null default now(), accepted_at timestamptz,
 created_by uuid not null references auth.users(id), message_id text
);
alter table public.nx_software_mail_delivery enable row level security;
revoke all on public.nx_software_mail_delivery from public,anon,authenticated;
grant select,insert,update,delete on public.nx_software_mail_delivery to service_role;
create index nx_software_mail_request_idx on public.nx_software_mail_delivery(request_id);
create index nx_software_mail_owner_idx on public.nx_software_mail_delivery(created_by);
create function public.nx_claim_software_mail(p_id uuid,p_hash text,p_recipient text,p_subject text,p_owner uuid,p_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare i public.nx_demo_invitations%rowtype; r public.nx_software_requests%rowtype; d public.nx_software_mail_delivery%rowtype;
begin
 if not exists(select 1 from public.nx_owner where user_id=p_owner) then raise exception 'not_owner'; end if;
 select * into i from public.nx_demo_invitations where id=p_id for update;
 if not found or i.code_hash<>p_hash or i.revoked_at is not null or i.expires_at<=now() then raise exception 'invalid_invitation'; end if;
 select * into r from public.nx_software_requests where id=i.request_id for update;
 if not found or lower(r.email)<>lower(p_recipient) or r.customer_id is null or r.updated_at<>p_updated_at then raise exception 'invalid_recipient'; end if;
 select * into d from public.nx_software_mail_delivery where invitation_id=p_id;
 if found then return jsonb_build_object('claimed',false,'status',d.status); end if;
 insert into public.nx_software_mail_delivery(invitation_id,request_id,recipient,subject,created_by)
 values(i.id,r.id,r.email,p_subject,p_owner);
 return jsonb_build_object('claimed',true,'status','sending','lead',to_jsonb(r),'invitation',jsonb_build_object('expires_at',i.expires_at));
end; $$;
revoke all on function public.nx_claim_software_mail(uuid,text,text,text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.nx_claim_software_mail(uuid,text,text,text,uuid,timestamptz) to service_role;
create function public.nx_complete_software_mail(p_id uuid,p_message_id text)
returns void language plpgsql security invoker set search_path='' as $$
declare d public.nx_software_mail_delivery%rowtype; c uuid;
begin
 select * into d from public.nx_software_mail_delivery where invitation_id=p_id for update;
 if not found then raise exception 'delivery_not_found'; end if;
 if d.status='accepted' then return; end if;
 update public.nx_software_mail_delivery set status='accepted',accepted_at=now(),message_id=left(p_message_id,300) where invitation_id=p_id;
 select customer_id into c from public.nx_software_requests where id=d.request_id;
 if c is not null then insert into public.nx_events(customer_id,kind,description)
 values(c,'CRM Software','Demo-Einladung an '||d.recipient||' vom Mailserver angenommen. Zustellung im Posteingang nicht bestätigt.'); end if;
end; $$;
revoke all on function public.nx_complete_software_mail(uuid,text) from public,anon,authenticated;
grant execute on function public.nx_complete_software_mail(uuid,text) to service_role;
