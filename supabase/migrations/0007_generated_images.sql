-- Final rendered output of a generation job: the high-res PNG (via Satori +
-- resvg) plus a snapshot of the exact Design Schema that produced it, so
-- re-exports and history stay reproducible even after the project's draft
-- schema is edited further.
create table generated_images (
  id uuid primary key default gen_random_uuid(),
  creative_project_id uuid not null references creative_projects(id) on delete cascade,
  job_id uuid not null references generation_jobs(id),
  storage_path text not null,
  design_schema jsonb not null,
  width integer not null,
  height integer not null,
  created_at timestamptz not null default now()
);

create index generated_images_creative_project_id_idx on generated_images(creative_project_id);
create index generated_images_job_id_idx on generated_images(job_id);

alter table generated_images enable row level security;

create policy "owner read via creative_project" on generated_images
  for select using (
    exists (
      select 1 from creative_projects
      where creative_projects.id = generated_images.creative_project_id
        and creative_projects.user_id = auth.uid()
    )
  );

-- Per-call AI usage/cost, for the audit trail required by spec section 13.
create table generation_usage (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references generation_jobs(id),
  capability text not null check (capability in ('text', 'vision', 'image', 'video')),
  provider_id text not null,
  cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

create index generation_usage_job_id_idx on generation_usage(job_id);

alter table generation_usage enable row level security;

create policy "owner read via job" on generation_usage
  for select using (
    exists (
      select 1 from generation_jobs
      where generation_jobs.id = generation_usage.job_id
        and generation_jobs.user_id = auth.uid()
    )
  );

-- Lets users flag a bad generation (spec section 8: "Allow users to flag
-- incorrect generations").
create table user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_image_id uuid references generated_images(id),
  rating text check (rating in ('good', 'bad')),
  comment text,
  created_at timestamptz not null default now()
);

create index user_feedback_user_id_idx on user_feedback(user_id);

alter table user_feedback enable row level security;

create policy "owner read/write" on user_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
