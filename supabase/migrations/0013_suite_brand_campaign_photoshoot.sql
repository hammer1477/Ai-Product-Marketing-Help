-- The suite: brand kits, campaign packs and product photoshoots.

-- ---------------------------------------------------------------------------
-- 1) Brand kit — one per user. Applied to every new generation.
-- ---------------------------------------------------------------------------
create table brand_kits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  brand_name text,
  tagline text,
  -- How the brand talks: "warm and playful", "clinical, no exclamation marks".
  voice text,
  -- Base palette: ink (dark ground), accent, text, muted. Hex strings.
  colors jsonb,
  headline_font text,
  body_font text,
  -- Path in the product-images bucket, under the user's own folder.
  logo_path text,
  -- PNG data URI of the logo, resized small, so designs embed it directly.
  logo_data_uri text,
  updated_at timestamptz not null default now()
);

alter table brand_kits enable row level security;

create policy "owner read/write" on brand_kits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2) Generic jobs. A job is a 'creative' (renders a creative project) or a
--    'photoshoot' (one product shot). Same credits, same worker, same refunds.
-- ---------------------------------------------------------------------------
alter table generation_jobs add column kind text not null default 'creative'
  check (kind in ('creative', 'photoshoot'));
alter table generation_jobs add column params jsonb not null default '{}'::jsonb;
alter table generation_jobs add column product_id uuid references products(id) on delete cascade;
alter table generation_jobs alter column creative_project_id drop not null;
alter table generation_jobs add constraint generation_jobs_target_check
  check ((kind = 'creative' and creative_project_id is not null) or (kind = 'photoshoot' and product_id is not null));

create index generation_jobs_product_id_idx on generation_jobs(product_id);

-- ---------------------------------------------------------------------------
-- 3) Campaigns: several creative projects generated together, each with its
--    own copy angle.
-- ---------------------------------------------------------------------------
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index campaigns_user_id_idx on campaigns(user_id);
create index campaigns_product_id_idx on campaigns(product_id);

alter table campaigns enable row level security;

create policy "owner read" on campaigns
  for select using (auth.uid() = user_id);

alter table creative_projects add column campaign_id uuid references campaigns(id) on delete set null;
-- The copy angle this project was asked to take ('benefit', 'offer', ...).
alter table creative_projects add column angle text;
-- Position within its campaign, so siblings pick different designs.
alter table creative_projects add column variant_index int;

create index creative_projects_campaign_id_idx on creative_projects(campaign_id);

-- ---------------------------------------------------------------------------
-- 4) Photoshoot output.
-- ---------------------------------------------------------------------------
create table photoshoot_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  job_id uuid not null references generation_jobs(id) on delete cascade,
  scene text not null,
  storage_path text not null,
  width int not null,
  height int not null,
  created_at timestamptz not null default now()
);

create index photoshoot_images_user_id_idx on photoshoot_images(user_id, created_at desc);
create index photoshoot_images_product_id_idx on photoshoot_images(product_id);
create index photoshoot_images_job_id_idx on photoshoot_images(job_id);

alter table photoshoot_images enable row level security;

create policy "owner read" on photoshoot_images
  for select using (auth.uid() = user_id);
create policy "owner delete" on photoshoot_images
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5) Prices live in the database, never in the request: every reservation
--    path reads them from here. Keep in sync with lib/credits/pricing.ts.
-- ---------------------------------------------------------------------------
create function job_cost(p_kind text)
returns int
language sql immutable
as $$
  select case p_kind when 'creative' then 5 when 'photoshoot' then 3 else null end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Reservation helpers. Shared check-and-hold, then two entry points:
--    a batch of creative projects (a campaign) or a batch of photoshoot jobs.
--    Both are all-or-nothing: either every job is created and its credits
--    held, or nothing is.
-- ---------------------------------------------------------------------------
create function hold_credits(p_user_id uuid, p_total bigint)
returns boolean -- true when the user is unlimited (nothing held)
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance bigint;
  v_reserved bigint;
  v_unlimited boolean;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'cannot reserve credits for another user';
  end if;
  if p_total <= 0 then
    raise exception 'reserve amount must be positive';
  end if;

  select role in ('owner', 'family') into v_unlimited from profiles where id = p_user_id;
  if coalesce(v_unlimited, false) then
    return true;
  end if;

  select balance, reserved into v_balance, v_reserved
  from credit_balances where user_id = p_user_id for update;

  if v_balance is null then
    raise exception 'no credit balance found for user %', p_user_id;
  end if;
  if v_balance - v_reserved < p_total then
    raise exception 'insufficient credits: available %, requested %', v_balance - v_reserved, p_total;
  end if;

  update credit_balances set reserved = reserved + p_total, updated_at = now() where user_id = p_user_id;
  return false;
end;
$$;

-- Creates a campaign of creative projects (one per angle) and a pending job
-- for each. Returns the campaign id.
create function reserve_campaign(p_user_id uuid, p_product_id uuid, p_angles text[])
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_unlimited boolean;
  v_campaign uuid;
  v_project uuid;
  v_job uuid;
  v_cost int := job_cost('creative');
  i int;
begin
  if not exists (select 1 from products where id = p_product_id and user_id = p_user_id) then
    raise exception 'product not found';
  end if;
  if coalesce(array_length(p_angles, 1), 0) = 0 then
    raise exception 'at least one angle is required';
  end if;

  if array_length(p_angles, 1) > 6 then
    raise exception 'at most 6 ads per campaign';
  end if;

  v_unlimited := hold_credits(p_user_id, v_cost::bigint * array_length(p_angles, 1));

  insert into campaigns (user_id, product_id) values (p_user_id, p_product_id) returning id into v_campaign;

  for i in 1 .. array_length(p_angles, 1) loop
    insert into creative_projects (user_id, product_id, campaign_id, angle, variant_index)
    values (p_user_id, p_product_id, v_campaign, p_angles[i], i - 1)
    returning id into v_project;

    insert into generation_jobs (user_id, creative_project_id, product_id, kind, status)
    values (p_user_id, v_project, p_product_id, 'creative', 'pending')
    returning id into v_job;

    insert into credit_transactions (user_id, job_id, type, amount, status)
    values (p_user_id, v_job, 'reserve', case when v_unlimited then 0 else v_cost end, 'pending');
  end loop;

  return v_campaign;
end;
$$;

-- Creates one pending photoshoot job per element of p_shots (each a jsonb
-- object of job params). Returns the job ids.
create function reserve_photoshoot(p_user_id uuid, p_product_id uuid, p_shots jsonb)
returns setof uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_unlimited boolean;
  v_job uuid;
  v_shot jsonb;
  v_count int := jsonb_array_length(p_shots);
  v_cost int := job_cost('photoshoot');
begin
  if not exists (select 1 from products where id = p_product_id and user_id = p_user_id) then
    raise exception 'product not found';
  end if;
  if v_count = 0 or v_count > 8 then
    raise exception 'between 1 and 8 shots per photoshoot';
  end if;

  v_unlimited := hold_credits(p_user_id, v_cost::bigint * v_count);

  for v_shot in select * from jsonb_array_elements(p_shots) loop
    insert into generation_jobs (user_id, product_id, kind, params, status)
    values (p_user_id, p_product_id, 'photoshoot', v_shot, 'pending')
    returning id into v_job;

    insert into credit_transactions (user_id, job_id, type, amount, status)
    values (p_user_id, v_job, 'reserve', case when v_unlimited then 0 else v_cost end, 'pending');

    return next v_job;
  end loop;
end;
$$;

-- 7) Close the same hole in the original single-creative path: it took the
--    amount from the caller, so a direct RPC could reserve 1 credit per ad.
--    A floor at the real price makes the argument harmless.
create or replace function reserve_credits(p_user_id uuid, p_amount int, p_creative_project_id uuid)
returns generation_jobs
language plpgsql
security definer set search_path = public
as $$
declare
  v_job generation_jobs;
  v_amount int := greatest(p_amount, job_cost('creative'));
  v_unlimited boolean;
begin
  if not exists (select 1 from creative_projects where id = p_creative_project_id and user_id = p_user_id) then
    raise exception 'creative project not found';
  end if;

  v_unlimited := hold_credits(p_user_id, v_amount);

  insert into generation_jobs (user_id, creative_project_id, product_id, kind, status)
  select p_user_id, p_creative_project_id, product_id, 'creative', 'pending'
  from creative_projects where id = p_creative_project_id
  returning * into v_job;

  insert into credit_transactions (user_id, job_id, type, amount, status)
  values (p_user_id, v_job.id, 'reserve', case when v_unlimited then 0 else v_amount end, 'pending');

  return v_job;
end;
$$;

revoke execute on function hold_credits(uuid, bigint) from public, anon, authenticated;
revoke execute on function reserve_campaign(uuid, uuid, text[]) from public, anon;
revoke execute on function reserve_photoshoot(uuid, uuid, jsonb) from public, anon;
revoke execute on function reserve_credits(uuid, int, uuid) from public, anon;
grant execute on function hold_credits(uuid, bigint) to service_role;
grant execute on function reserve_campaign(uuid, uuid, text[]) to authenticated, service_role;
grant execute on function reserve_photoshoot(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function reserve_credits(uuid, int, uuid) to authenticated, service_role;
