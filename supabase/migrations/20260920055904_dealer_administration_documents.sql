begin;
alter table public.nx_tasks add column if not exists kind text not null default 'Aufgabe' check(kind in ('Aufgabe','Termin','Wiedervorlage'));
alter table public.nx_tasks add column if not exists notes text not null default '' check(length(notes)<=3000);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('nx-client-documents','nx-client-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','text/plain'])
on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='nx-client-documents' and (public or file_size_limit is distinct from 10485760)) then raise exception 'Unexpected document bucket configuration'; end if;
end $$;
-- Restrictive guards prevent future broad legacy policies from exposing this bucket.
create policy nx_documents_anon_guard on storage.objects as restrictive for all to anon
 using(bucket_id <> 'nx-client-documents') with check(bucket_id <> 'nx-client-documents');
create policy nx_documents_owner_guard on storage.objects as restrictive for all to authenticated
 using(bucket_id <> 'nx-client-documents' or exists(select 1 from public.nx_owner where user_id=(select auth.uid())))
 with check(bucket_id <> 'nx-client-documents' or exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
create policy nx_documents_read on storage.objects for select to authenticated using(
 bucket_id='nx-client-documents' and exists(select 1 from public.nx_owner where user_id=(select auth.uid()))
 and exists(select 1 from public.nx_customers c where c.id::text=(storage.foldername(name))[1])
);
create policy nx_documents_upload on storage.objects for insert to authenticated with check(
 bucket_id='nx-client-documents' and exists(select 1 from public.nx_owner where user_id=(select auth.uid()))
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}--[a-zA-Z0-9._ -]{1,150}$'
 and exists(select 1 from public.nx_customers c where c.id::text=(storage.foldername(name))[1])
);
create policy nx_documents_delete on storage.objects for delete to authenticated using(
 bucket_id='nx-client-documents' and exists(select 1 from public.nx_owner where user_id=(select auth.uid()))
 and exists(select 1 from public.nx_customers c where c.id::text=(storage.foldername(name))[1])
);
commit;
