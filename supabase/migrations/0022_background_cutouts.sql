-- Feature 4: Product Background Remover — the optional cutout asset library.
--
-- Additive only: one new table. No existing table, policy or function is
-- touched. The PNG files themselves live in the existing private
-- `product-images` bucket under the user's own `<user_id>/cutouts/` folder,
-- which the bucket's existing owner-folder policies (0008) already cover.

create table background_cutouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  -- Path in the product-images bucket: `<user_id>/cutouts/<uuid>.png`.
  storage_path text not null unique,
  width int not null check (width > 0),
  height int not null check (height > 0),
  bytes int not null check (bytes > 0),
  created_at timestamptz not null default now()
);

create index background_cutouts_user_id_idx on background_cutouts(user_id, created_at desc);

alter table background_cutouts enable row level security;

create policy "owner read" on background_cutouts
  for select using (auth.uid() = user_id);
create policy "owner insert" on background_cutouts
  for insert with check (auth.uid() = user_id and storage_path like auth.uid()::text || '/cutouts/%');
create policy "owner update" on background_cutouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner delete" on background_cutouts
  for delete using (auth.uid() = user_id);
