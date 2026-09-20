-- Authorized diagnostic only. All synthetic rows are rolled back. No storage bytes are uploaded.
begin;
select set_config('nx.test_owner',(select user_id::text from public.nx_owner),true);
select set_config('nx.test_customer',gen_random_uuid()::text,true);
select set_config('request.jwt.claim.sub',current_setting('nx.test_owner'),true);
set local role authenticated;
insert into public.nx_customers(id,company,city,interests) values(current_setting('nx.test_customer')::uuid,'NX transactional access test','Test',array['vape']);
insert into public.nx_tasks(customer_id,division,title,due_at,kind,notes) values(current_setting('nx.test_customer')::uuid,'vape','Testtermin',now(),'Termin','Synthetic test only');
insert into storage.objects(bucket_id,name,owner_id,metadata) values('nx-client-documents',current_setting('nx.test_customer')||'/'||gen_random_uuid()::text||'--test.txt',current_setting('nx.test_owner'),'{"size":4,"mimetype":"text/plain"}');
do $$ begin
 if (select count(*) from storage.objects where bucket_id='nx-client-documents' and name like current_setting('nx.test_customer')||'/%') <> 1 then raise exception 'Owner cannot read document'; end if;
 if not public.is_staff() then raise exception 'Existing owner lost staff access'; end if;
 begin
   insert into storage.objects(bucket_id,name) values('nx-client-documents','00000000-0000-4000-8000-000000000099/00000000-0000-4000-8000-000000000098--test.txt');
   raise exception 'Unknown customer upload unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000000099','email',(select email from public.staff_users where active limit 1))::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.nx_customers) then raise exception 'Foreign account can read CRM'; end if;
 if exists(select 1 from storage.objects where bucket_id='nx-client-documents') then raise exception 'Foreign account can read documents'; end if;
 if public.is_staff() then raise exception 'Forged email authorized foreign account'; end if;
 begin
   insert into storage.objects(bucket_id,name) values('nx-client-documents',current_setting('nx.test_customer')||'/'||gen_random_uuid()::text||'--denied.txt');
   raise exception 'Foreign account uploaded document';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='nx-client-documents') then raise exception 'Anonymous document read allowed'; end if;
 if public.is_staff() then raise exception 'Anonymous staff authorization allowed'; end if;
 begin
   perform id from public.nx_customers;
   raise exception 'Anonymous CRM read allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.place_dealer_order(jsonb,text)','execute') or has_function_privilege('authenticated','public.dispatch_admin_push()','execute') then raise exception 'Unnecessary legacy RPC permission remains'; end if;
end $$;
rollback;
select 'PASS: owner access; foreign/anonymous denial; unknown customer denial; staff ID binding; revoked RPCs; test rows rolled back' as verification;
