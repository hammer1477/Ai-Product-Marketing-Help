-- Generation jobs: the state machine backing all async AI generation work.
-- Rows are created together with a credit reservation (see 0006_credits.sql)
-- in the same request, then claimed and processed by the job worker.
create table generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creative_project_id uuid not null references creative_projects(id) on delete cascade,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')) default 'pending',
  error_message text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index generation_jobs_user_id_idx on generation_jobs(user_id);
create index generation_jobs_status_idx on generation_jobs(status);
create index generation_jobs_creative_project_id_idx on generation_jobs(creative_project_id);

alter table generation_jobs enable row level security;

create policy "owner read" on generation_jobs
  for select using (auth.uid() = user_id);

-- Inserts/updates to generation_jobs only ever happen via SECURITY DEFINER
-- functions (reserve_credits creates the row; the job worker, running with
-- the service-role key, updates status) — no direct write policy is granted
-- to the authenticated role.

-- Atomically claim one pending job so the fire-and-forget trigger and the
-- cron sweeper can never both process the same job. Returns the claimed row,
-- or no rows if nothing was available to claim.
create function claim_pending_job(target_job_id uuid default null)
returns setof generation_jobs
language sql
security definer set search_path = public
as $$
  update generation_jobs
  set status = 'processing', claimed_at = now()
  where status = 'pending'
    and (target_job_id is null or id = target_job_id)
    and id = (
      select id from generation_jobs
      where status = 'pending'
        and (target_job_id is null or id = target_job_id)
      order by created_at
      limit 1
      for update skip locked
    )
  returning *;
$$;

-- Sweep jobs stuck in 'processing' past a timeout (worker crashed mid-run)
-- back to 'pending' so the cron poller can retry them, up to a retry cap
-- enforced by the caller via claimed_at age — kept simple for Phase 1.
create function reset_stuck_processing_jobs(stuck_after_minutes int default 10)
returns setof generation_jobs
language sql
security definer set search_path = public
as $$
  update generation_jobs
  set status = 'pending', claimed_at = null
  where status = 'processing'
    and claimed_at < now() - (stuck_after_minutes || ' minutes')::interval
  returning *;
$$;
