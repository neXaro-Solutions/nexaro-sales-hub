-- Hunter AUTO Phase 1. Already applied to production on 2026-09-24.
-- No marketing dispatcher is enabled here. Request-contact is NOT marketing consent.
create table if not exists public.nx_contact_permissions(
 customer_id uuid primary key references public.nx_customers(id) on delete cascade,
 request_contact boolean not null default false,
 request_source text not null default '' check(length(request_source)<=200),
 request_at timestamptz,
 marketing_email boolean not null default false,
 marketing_verified_at timestamptz,
 marketing_evidence text not null default '' check(length(marketing_evidence)<=1000),
 updated_at timestamptz not null default now(),
 constraint nx_marketing_requires_evidence check(not marketing_email or (marketing_verified_at is not null and length(trim(marketing_evidence))>=12))
);
create table if not exists public.nx_marketing_suppressions(
 email text primary key check(email=lower(trim(email)) and email like '%@%' and length(email)<=254),
 reason text not null default 'Widerspruch' check(length(reason)<=500),
 recorded_at timestamptz not null default now()
);
alter table public.nx_contact_permissions enable row level security;
alter table public.nx_marketing_suppressions enable row level security;
revoke all on public.nx_contact_permissions,public.nx_marketing_suppressions from anon;
grant select,insert,update on public.nx_contact_permissions to authenticated;
grant select,insert on public.nx_marketing_suppressions to authenticated;
drop policy if exists nx_contact_permissions_owner on public.nx_contact_permissions;
create policy nx_contact_permissions_owner on public.nx_contact_permissions for all to authenticated
 using(exists(select 1 from public.nx_owner where user_id=(select auth.uid())))
 with check(exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
drop policy if exists nx_marketing_suppressions_owner on public.nx_marketing_suppressions;
create policy nx_marketing_suppressions_owner on public.nx_marketing_suppressions for all to authenticated
 using(exists(select 1 from public.nx_owner where user_id=(select auth.uid())))
 with check(exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
create or replace function public.nx_block_suppressed_marketing() returns trigger language plpgsql set search_path='' as $$
begin
 if new.marketing_email and exists(
 select 1 from public.nx_customers c join public.nx_marketing_suppressions s on s.email=lower(trim(c.email))
 where c.id=new.customer_id
 ) then raise exception 'marketing_suppressed';end if;
 return new;
end $$;
drop trigger if exists nx_block_suppressed_marketing on public.nx_contact_permissions;
create trigger nx_block_suppressed_marketing before insert or update on public.nx_contact_permissions for each row execute function public.nx_block_suppressed_marketing();
create or replace function public.nx_apply_marketing_suppression() returns trigger language plpgsql set search_path='' as $$
begin
 update public.nx_contact_permissions cp set marketing_email=false,marketing_verified_at=null,marketing_evidence='',updated_at=now()
 from public.nx_customers c where c.id=cp.customer_id and lower(trim(c.email))=new.email;
 return new;
end $$;
drop trigger if exists nx_apply_marketing_suppression on public.nx_marketing_suppressions;
create trigger nx_apply_marketing_suppression after insert on public.nx_marketing_suppressions for each row execute function public.nx_apply_marketing_suppression();
create or replace function public.nx_reset_marketing_on_customer_email() returns trigger language plpgsql set search_path='' as $$
begin
 if lower(trim(new.email)) is distinct from lower(trim(old.email)) then
  update public.nx_contact_permissions set marketing_email=false,marketing_verified_at=null,marketing_evidence='',updated_at=now() where customer_id=new.id;
 end if;
 return new;
end $$;
drop trigger if exists nx_reset_marketing_on_customer_email on public.nx_customers;
create trigger nx_reset_marketing_on_customer_email after update of email on public.nx_customers
 for each row execute function public.nx_reset_marketing_on_customer_email();

-- Replaces the existing intake RPC without removing its HMAC challenge, receipt idempotency or rate limiting.
CREATE OR REPLACE FUNCTION public.nx_submit_intake(p_id uuid, p_ip_hash text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cid uuid;count_now int;limit_key text;interest text[];div text;request_kind text;fee_context text;
begin
 if current_user<>'service_role' then raise insufficient_privilege;end if;
 if p_id is null or p_ip_hash is null or length(p_ip_hash)<>64 then raise exception 'Invalid request';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,0));
 if exists(select 1 from public.nx_intake_receipts where id=p_id) then return;end if;
 delete from public.nx_intake_limits where window_start<now()-interval '2 days';
 foreach limit_key in array array[p_ip_hash||':'||to_char(now(),'YYYYMMDDHH24')||':'||(extract(minute from now())::int/15)::text,'global:'||to_char(now(),'YYYYMMDDHH24')] loop
  insert into public.nx_intake_limits(key,window_start,count) values(limit_key,now(),1)
   on conflict(key) do update set count=public.nx_intake_limits.count+1 returning count into count_now;
  if count_now>(case when limit_key like 'global:%' then 100 else 5 end) then raise exception 'rate_limited';end if;
 end loop;
 if (p_payload->>'consent') is distinct from 'true' or coalesce(length(p_payload->>'email'),0)=0 or coalesce(length(p_payload->>'contact'),0)=0 then raise exception 'Invalid consent/contact';end if;
 interest=case p_payload->>'interest' when 'sumup' then array['sumup'] when 'vape' then array['vape'] when 'both' then array['sumup','vape'] else null end;
 if interest is null then raise exception 'Invalid interest';end if;
 request_kind=case when p_payload->>'request_type'='sumup_fee_check' and p_payload->>'interest'='sumup' then 'SumUp Gebührencheck' else 'Kontaktformular' end;
 fee_context=case when request_kind='SumUp Gebührencheck' then
  E'Angefragter SumUp-Gebührencheck\nMonatlicher Kartenumsatz laut Interessent: '||
  coalesce(nullif(p_payload->>'monthly_volume',''),'nicht angegeben')||E' EUR\nBisheriger Zahlungsanbieter: '||
  coalesce(nullif(p_payload->>'current_provider',''),'nicht angegeben')||E'\n'
  else '' end;
 select id into cid from public.nx_customers
 where lower(trim(email))=lower(trim(p_payload->>'email')) and lower(trim(company))=lower(trim(p_payload->>'company'))
 order by created_at asc limit 1;
 if cid is null then
 insert into public.nx_customers(company,contact,email,phone,street,zip,city,industry,source,notes,interests)
 values(p_payload->>'company',p_payload->>'contact',lower(p_payload->>'email'),coalesce(p_payload->>'phone',''),coalesce(p_payload->>'street',''),coalesce(p_payload->>'zip',''),coalesce(p_payload->>'city',''),coalesce(p_payload->>'industry',''),request_kind,fee_context||coalesce(p_payload->>'message',''),interest)
 returning id into cid;
 end if;
 foreach div in array interest loop
  insert into public.nx_tasks(customer_id,division,title,due_at,kind)
   values(cid,div,case when request_kind='SumUp Gebührencheck' then 'Angefragten SumUp-Gebührenvergleich vorbereiten' else 'Neue Anfrage beantworten · '||case div when 'sumup' then 'SumUp' else 'Vapes' end end,now()+interval '1 day','Aufgabe');
 end loop;
 insert into public.nx_events(customer_id,kind,description)
 values(cid,'Formularanfrage',left('Kontaktanfrage eingegangen: '||request_kind||'. Anfragebezogene Kontaktaufnahme dokumentiert; keine Werbeeinwilligung (Formularversion 2). '||fee_context||coalesce(p_payload->>'message',''),3000));
 insert into public.nx_contact_permissions(customer_id,request_contact,request_source,request_at,marketing_email)
 values(cid,true,request_kind||' v2',now(),false)
 on conflict(customer_id) do update set request_contact=true,request_source=excluded.request_source,request_at=excluded.request_at,updated_at=now();
 insert into public.nx_intake_receipts(id,customer_id) values(p_id,cid);
end;$function$;
