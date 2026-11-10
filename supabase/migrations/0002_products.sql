-- Products: the canonical, user-owned source of truth for everything the
-- orchestration engine is allowed to treat as "verified". AI-inferred fields
-- live separately on product_images and must be explicitly approved before
-- influencing generated copy.
create table products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  category text,
  ai_suggested_category text,
  category_confirmed boolean not null default false,
  description text,
  attributes jsonb not null default '{}'::jsonb, -- user-entered specs/ingredients/benefits/price/etc.
  objective text,       -- e.g. 'brand-awareness' | 'promo' | 'launch'
  target_platform text, -- e.g. 'instagram-square' | 'facebook-feed'
  created_at timestamptz not null default now()
);

create index products_user_id_idx on products(user_id);

alter table products enable row level security;

create policy "owner read/write" on products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Product images: raw AI vision analysis is stored here, never promoted to
-- `products` fields automatically. analysis_approved_at is set only via the
-- explicit approve-analysis endpoint, after user review.
create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  storage_path text not null,
  is_primary boolean not null default false,
  ai_analysis jsonb,
  ai_analysis_confidence numeric,
  analysis_approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index product_images_product_id_idx on product_images(product_id);

alter table product_images enable row level security;

create policy "owner read/write via product" on product_images
  for all using (
    exists (select 1 from products where products.id = product_images.product_id and products.user_id = auth.uid())
  )
  with check (
    exists (select 1 from products where products.id = product_images.product_id and products.user_id = auth.uid())
  );
