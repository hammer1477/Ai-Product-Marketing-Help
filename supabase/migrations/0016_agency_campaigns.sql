-- Campaigns become one job: a strategist pass that writes the whole
-- campaign (strategy, one shared look, every ad's copy, social copy and a
-- rollout playbook), then designs every ad from it. Priced as a product of
-- its own — a strategy fee plus a per-ad price — not as N single ads.

alter table generation_jobs drop constraint if exists generation_jobs_kind_check;
alter table generation_jobs add constraint generation_jobs_kind_check
  check (kind in ('creative', 'photoshoot', 'campaign'));

alter table generation_jobs drop constraint if exists generation_jobs_target_check;
alter table generation_jobs add constraint generation_jobs_target_check check (
  (kind = 'creative' and creative_project_id is not null)
  or (kind in ('photoshoot', 'campaign') and product_id is not null)
);

alter table campaigns add column job_id uuid references generation_jobs(id) on delete set null;
alter table campaigns add column color_source text check (color_source in ('brand', 'product'));
-- The campaign plan the strategist wrote: strategy, per-ad copy and
-- placements, rollout playbook. Null until the job completes.
alter table campaigns add column plan jsonb;

-- Prices live here, never in the request.
create or replace function job_cost(p_kind text)
returns int
language sql immutable
as $$
  select case p_kind
    when 'creative' then 5
    when 'photoshoot' then 3
    when 'campaign_strategy' then 10
    when 'campaign_ad' then 5
    else null
  end;
$$;

drop function if exists reserve_campaign(uuid, uuid, text[]);

-- Creates the campaign, one creative project per angle (so each ad opens in
-- the editor) and ONE campaign job holding strategy fee + per-ad price.
create function reserve_campaign(p_user_id uuid, p_product_id uuid, p_angles text[], p_color_source text default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_unlimited boolean;
  v_campaign uuid;
  v_job uuid;
  v_count int := coalesce(array_length(p_angles, 1), 0);
  v_cost bigint;
  i int;
begin
  if not exists (select 1 from products where id = p_product_id and user_id = p_user_id) then
    raise exception 'product not found';
  end if;
  if v_count < 2 or v_count > 6 then
    raise exception 'a campaign has 2 to 6 ads';
  end if;
  if p_color_source is not null and p_color_source not in ('brand', 'product') then
    raise exception 'invalid colour source';
  end if;

  v_cost := job_cost('campaign_strategy') + job_cost('campaign_ad')::bigint * v_count;
  v_unlimited := hold_credits(p_user_id, v_cost);

  insert into campaigns (user_id, product_id, color_source)
  values (p_user_id, p_product_id, p_color_source)
  returning id into v_campaign;

  for i in 1 .. v_count loop
    insert into creative_projects (user_id, product_id, campaign_id, angle, variant_index, color_source)
    values (p_user_id, p_product_id, v_campaign, p_angles[i], i - 1, p_color_source);
  end loop;

  insert into generation_jobs (user_id, product_id, kind, params, status)
  values (p_user_id, p_product_id, 'campaign', jsonb_build_object('campaign_id', v_campaign), 'pending')
  returning id into v_job;

  update campaigns set job_id = v_job where id = v_campaign;

  insert into credit_transactions (user_id, job_id, type, amount, status)
  values (p_user_id, v_job, 'reserve', case when v_unlimited then 0 else v_cost end, 'pending');

  return v_campaign;
end;
$$;

revoke execute on function reserve_campaign(uuid, uuid, text[], text) from public, anon;
grant execute on function reserve_campaign(uuid, uuid, text[], text) to authenticated, service_role;
