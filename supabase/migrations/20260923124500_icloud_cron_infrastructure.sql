-- Required infrastructure only. No scheduled job and no iCloud connection until
-- the CRM owner explicitly authorizes account setup and sync activation.
create extension if not exists pg_cron;
