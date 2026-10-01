alter table public.nx_customers
  add column if not exists acquisition_source text not null default 'Direkt',
  add column if not exists utm_medium text not null default '',
  add column if not exists utm_campaign text not null default '',
  add column if not exists utm_term text not null default '',
  add column if not exists utm_content text not null default '',
  add column if not exists gclid text not null default '',
  add column if not exists landing_page text not null default '',
  add column if not exists lead_status text not null default 'Neu',
  add column if not exists conversion_value numeric(12,2) not null default 0;

alter table public.nx_intake_receipts
  add column if not exists attribution jsonb not null default '{}'::jsonb;

alter table public.nx_customers
  drop constraint if exists nx_customers_lead_status_check;

alter table public.nx_customers
  add constraint nx_customers_lead_status_check
  check (lead_status in ('Neu','Kontaktiert','Termin','Angebot','Gewonnen','Verloren'));

create or replace function public.nx_submit_intake(p_id uuid, p_ip_hash text, p_payload jsonb)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  cid uuid;
  count_now int;
  limit_key text;
  interest text[];
  div text;
  request_kind text;
  fee_context text;
  attribution jsonb;
  acquisition text;
begin
  if current_user <> 'service_role' then raise insufficient_privilege; end if;
  if p_id is null or p_ip_hash is null or length(p_ip_hash) <> 64 then raise exception 'Invalid request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,0));
  if exists(select 1 from public.nx_intake_receipts where id=p_id) then return; end if;
  delete from public.nx_intake_limits where window_start < now()-interval '2 days';
  foreach limit_key in array array[
    p_ip_hash||':'||to_char(now(),'YYYYMMDDHH24')||':'||(extract(minute from now())::int/15)::text,
    'global:'||to_char(now(),'YYYYMMDDHH24')
  ] loop
    insert into public.nx_intake_limits(key,window_start,count) values(limit_key,now(),1)
    on conflict(key) do update set count=public.nx_intake_limits.count+1 returning count into count_now;
    if count_now > (case when limit_key like 'global:%' then 100 else 5 end) then raise exception 'rate_limited'; end if;
  end loop;

  if (p_payload->>'consent') is distinct from 'true'
     or coalesce(length(p_payload->>'email'),0)=0
     or coalesce(length(p_payload->>'contact'),0)=0
  then raise exception 'Invalid consent/contact'; end if;

  interest = case p_payload->>'interest'
    when 'sumup' then array['sumup']
    when 'vape' then array['vape']
    when 'both' then array['sumup','vape']
    else null end;
  if interest is null then raise exception 'Invalid interest'; end if;

  request_kind = case
    when p_payload->>'request_type'='sumup_fee_check' and p_payload->>'interest'='sumup' then 'SumUp Angebotsanfrage'
    when p_payload->>'request_type'='sumup_consultation' and p_payload->>'interest'='sumup' then 'SumUp Beratung'
    else 'Kontaktformular' end;

  fee_context = case when request_kind='SumUp Angebotsanfrage' then
    E'Angefragter SumUp-Gebührencheck\\nMonatlicher Kartenumsatz laut Interessent: '||
    coalesce(nullif(p_payload->>'monthly_volume',''),'nicht angegeben')||E' EUR\\nBisheriger Zahlungsanbieter: '||
    coalesce(nullif(p_payload->>'current_provider',''),'nicht angegeben')||E'\\n'
    else '' end;

  acquisition = coalesce(nullif(left(p_payload->>'utm_source',100),''), case when coalesce(p_payload->>'gclid','')<>'' then 'google' else 'Direkt' end);
  attribution = jsonb_strip_nulls(jsonb_build_object(
    'source', acquisition,
    'medium', nullif(left(p_payload->>'utm_medium',100),''),
    'campaign', nullif(left(p_payload->>'utm_campaign',200),''),
    'term', nullif(left(p_payload->>'utm_term',200),''),
    'content', nullif(left(p_payload->>'utm_content',200),''),
    'gclid', nullif(left(p_payload->>'gclid',255),''),
    'landing_page', nullif(left(p_payload->>'landing_page',500),''),
    'captured_at', now()
  ));

  select id into cid from public.nx_customers
  where lower(trim(email))=lower(trim(p_payload->>'email'))
    and lower(trim(company))=lower(trim(p_payload->>'company'))
  order by created_at asc limit 1;

  if cid is null then
    insert into public.nx_customers(
      company,contact,email,phone,street,zip,city,industry,source,notes,interests,
      acquisition_source,utm_medium,utm_campaign,utm_term,utm_content,gclid,landing_page,lead_status
    ) values(
      p_payload->>'company',p_payload->>'contact',lower(p_payload->>'email'),coalesce(p_payload->>'phone',''),
      coalesce(p_payload->>'street',''),coalesce(p_payload->>'zip',''),coalesce(p_payload->>'city',''),coalesce(p_payload->>'industry',''),
      request_kind,fee_context||coalesce(p_payload->>'message',''),interest,
      acquisition,coalesce(p_payload->>'utm_medium',''),coalesce(p_payload->>'utm_campaign',''),coalesce(p_payload->>'utm_term',''),
      coalesce(p_payload->>'utm_content',''),coalesce(p_payload->>'gclid',''),coalesce(p_payload->>'landing_page',''),'Neu'
    ) returning id into cid;
  else
    update public.nx_customers set
      acquisition_source=acquisition,
      utm_medium=coalesce(p_payload->>'utm_medium',''),
      utm_campaign=coalesce(p_payload->>'utm_campaign',''),
      utm_term=coalesce(p_payload->>'utm_term',''),
      utm_content=coalesce(p_payload->>'utm_content',''),
      gclid=coalesce(p_payload->>'gclid',''),
      landing_page=coalesce(p_payload->>'landing_page',''),
      updated_at=now()
    where id=cid;
  end if;

  foreach div in array interest loop
    insert into public.nx_tasks(customer_id,division,title,due_at,kind)
    values(cid,div,case
      when request_kind='SumUp Angebotsanfrage' then 'Angefragten SumUp-Gebührenvergleich vorbereiten'
      when request_kind='SumUp Beratung' then 'Neue SumUp-Beratungsanfrage beantworten'
      else 'Neue Anfrage beantworten · '||case div when 'sumup' then 'SumUp' else 'Vapes' end
    end,now()+interval '1 day','Aufgabe');
  end loop;

  insert into public.nx_events(customer_id,kind,description)
  values(cid,'Formularanfrage',left(
    'Kontaktanfrage eingegangen: '||request_kind||'. Anfragebezogene Kontaktaufnahme dokumentiert; keine Werbeeinwilligung (Formularversion 3). '
    || case when acquisition<>'Direkt' then 'Quelle: '||acquisition||case when coalesce(p_payload->>'utm_campaign','')<>'' then ' · Kampagne: '||p_payload->>'utm_campaign' else '' end||'. ' else '' end
    || fee_context||coalesce(p_payload->>'message',''),3000));

  insert into public.nx_contact_permissions(customer_id,request_contact,request_source,request_at,marketing_email)
  values(cid,true,request_kind||' v3',now(),false)
  on conflict(customer_id) do update set request_contact=true,request_source=excluded.request_source,request_at=excluded.request_at,updated_at=now();

  insert into public.nx_intake_receipts(id,customer_id,attribution) values(p_id,cid,attribution);
end;
$function$;
