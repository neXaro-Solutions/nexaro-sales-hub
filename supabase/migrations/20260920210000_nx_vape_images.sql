-- Product photos remain private and owner-only.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('nx-vape-images','nx-vape-images',false,5000000,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5000000,allowed_mime_types=excluded.allowed_mime_types;
create policy nx_vape_images_owner_read on storage.objects for select to authenticated
using (bucket_id='nx-vape-images' and exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
create policy nx_vape_images_owner_insert on storage.objects for insert to authenticated
with check (bucket_id='nx-vape-images' and name ~ '^[0-9a-f-]{36}[.](jpg|png|webp)$'
and exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
create policy nx_vape_images_owner_update on storage.objects for update to authenticated
using (bucket_id='nx-vape-images' and exists(select 1 from public.nx_owner where user_id=(select auth.uid())))
with check (bucket_id='nx-vape-images' and exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
create policy nx_vape_images_owner_delete on storage.objects for delete to authenticated
using (bucket_id='nx-vape-images' and exists(select 1 from public.nx_owner where user_id=(select auth.uid())));
