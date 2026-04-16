-- Daily purge of soft-deleted proposals + FK cascade guarantees
--
-- The in-app Delete action sets deleted_at = now() and moves the proposal
-- to /proposals/deleted for a 30-day grace period. The UI copy promises
-- they're removed permanently after 30 days. This migration makes that
-- promise true:
--   1. Guarantees every child-of-proposals FK is ON DELETE CASCADE so a
--      hard delete actually succeeds instead of erroring on a FK violation.
--   2. Adds a daily pg_cron job that hard-deletes rows past the grace
--      window. Runs at 03:17 UTC — off-peak, off the :00 minute so we're
--      not competing with every other app's hourly job.
--
-- Safe to re-run: we drop any prior cron scheduling and re-apply cascade
-- before scheduling fresh.

-- =========================================================================
-- 1. Force ON DELETE CASCADE on all child FKs pointing at public.proposals
-- =========================================================================
--
-- Schema was bootstrapped in the Supabase dashboard outside version
-- control, so we don't know the exact constraint names. Look them up
-- dynamically, drop them, re-add with CASCADE. Idempotent.

do $$
declare
  rec record;
begin
  for rec in
    select
      c.conname as conname,
      n.nspname || '.' || t.relname as qualified_table,
      a.attname as column_name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_class ref_t on ref_t.oid = c.confrelid
    join pg_namespace ref_n on ref_n.oid = ref_t.relnamespace
    join unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a
      on a.attrelid = c.conrelid
      and a.attnum = k.attnum
    where c.contype = 'f'
      and ref_n.nspname = 'public'
      and ref_t.relname = 'proposals'
      and n.nspname = 'public'
      and c.confdeltype <> 'c' -- skip anything already on-delete-cascade
  loop
    execute format(
      'alter table %s drop constraint %I',
      rec.qualified_table, rec.conname
    );
    execute format(
      'alter table %s add constraint %I foreign key (%I) references public.proposals(id) on delete cascade',
      rec.qualified_table, rec.conname, rec.column_name
    );
  end loop;
end $$;

-- =========================================================================
-- 2. pg_cron purge job
-- =========================================================================
--
-- pg_cron ships as an extension in Supabase-hosted; enable it into the
-- extensions schema (Supabase's convention) if it isn't already.

create extension if not exists pg_cron with schema extensions;

-- Drop any prior scheduling of this job. Idempotent.
do $$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job where jobname = 'purge-deleted-proposals'
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end $$;

-- Schedule: daily at 03:17 UTC.
-- Cron format: 'MM HH DD Mon DoW'.
select cron.schedule(
  'purge-deleted-proposals',
  '17 3 * * *',
  $purge$
    delete from public.proposals
    where deleted_at is not null
      and deleted_at < (now() - interval '30 days');
  $purge$
);

-- Inspect with:
--   select * from cron.job where jobname = 'purge-deleted-proposals';
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'purge-deleted-proposals')
--     order by start_time desc limit 10;
