-- Records which provider/model actually produced each generation, for audit
-- and cost-tracking. Phase 1 does NOT use this table to drive runtime
-- provider selection (that's env-var driven, see lib/ai/providers/factory.ts)
-- — this table is write-only bookkeeping until an admin UI exists.
create table ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  capability text not null check (capability in ('text', 'vision', 'image', 'video')),
  provider_id text not null, -- 'mock' | 'openai' | 'anthropic' | ...
  model text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Global/admin table, not user-owned. Readable by any authenticated user
-- (needed so the app can display "generated with X" if desired); writes are
-- restricted to the service role (no policy grants write to authenticated).
alter table ai_provider_configs enable row level security;

create policy "authenticated read" on ai_provider_configs
  for select using (auth.role() = 'authenticated');
