-- A newly created customer is available for both sales areas by default.
-- Existing opportunities and historical customer data are not modified.
alter table public.nx_customers alter column interests set default array['sumup','vape']::text[];
