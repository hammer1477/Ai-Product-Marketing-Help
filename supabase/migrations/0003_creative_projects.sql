-- Creative projects: one per creative concept a user is developing for a
-- product. design_schema holds the current editable Design Schema (see
-- lib/design-schema/types.ts) — the single source of truth rendered by both
-- the live preview and the Satori/resvg exporter.
create table creative_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  concept text check (concept in ('premium_photo', 'graphic_poster')),
  density text check (density in ('minimal', 'standard', 'detailed')),
  design_schema jsonb,
  created_at timestamptz not null default now()
);

create index creative_projects_user_id_idx on creative_projects(user_id);
create index creative_projects_product_id_idx on creative_projects(product_id);

alter table creative_projects enable row level security;

create policy "owner read/write" on creative_projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
