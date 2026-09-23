-- Store business-card website as a first-class customer detail.
alter table public.nx_customers add column if not exists website text not null default '' check (length(website)<=300);
