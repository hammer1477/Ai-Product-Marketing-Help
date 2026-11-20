-- 1) Credit amounts become bigint. reserve_credits held the balance in `int`
--    variables (max 2,147,483,647), so any larger balance failed with an
--    integer-out-of-range error on generate. Safe to re-run if the columns
--    were already widened by hand.
alter table credit_balances alter column balance type bigint;
alter table credit_balances alter column reserved type bigint;
alter table credit_transactions alter column amount type bigint;

-- 2) Profiles get a public username and a role. 'owner' = unlimited credits.
alter table profiles add column if not exists username text;
alter table profiles add column if not exists role text not null default 'user';

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('user', 'owner'));

alter table profiles drop constraint if exists profiles_username_format;
alter table profiles add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');

create unique index if not exists profiles_username_lower_idx on profiles (lower(username));

-- The existing "owner read/write" RLS policy lets a user update any column of
-- their own row — including `role`, which would let anyone make themselves an
-- owner. Restrict client writes to the editable columns only. Inserts happen
-- via the handle_new_user trigger (security definer), never from the client.
revoke insert, update on profiles from anon, authenticated;
grant update (display_name, username) on profiles to authenticated;

-- 3) reserve_credits: bigint math, and owners skip the balance entirely.
--    For an owner the reservation is recorded with amount 0, so the existing
--    finalize_credits / refund_credits subtract nothing and need no change.
create or replace function reserve_credits(p_user_id uuid, p_amount int, p_creative_project_id uuid)
returns generation_jobs
language plpgsql
security definer set search_path = public
as $$
declare
  v_job generation_jobs;
  v_balance bigint;
  v_reserved bigint;
  v_is_owner boolean;
begin
  if p_amount <= 0 then
    raise exception 'reserve amount must be positive';
  end if;

  select role = 'owner' into v_is_owner from profiles where id = p_user_id;

  if coalesce(v_is_owner, false) then
    insert into generation_jobs (user_id, creative_project_id, status)
    values (p_user_id, p_creative_project_id, 'pending')
    returning * into v_job;

    insert into credit_transactions (user_id, job_id, type, amount, status)
    values (p_user_id, v_job.id, 'reserve', 0, 'pending');

    return v_job;
  end if;

  select balance, reserved into v_balance, v_reserved
  from credit_balances
  where user_id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'no credit balance found for user %', p_user_id;
  end if;

  if v_balance - v_reserved < p_amount then
    raise exception 'insufficient credits: available %, requested %', v_balance - v_reserved, p_amount;
  end if;

  insert into generation_jobs (user_id, creative_project_id, status)
  values (p_user_id, p_creative_project_id, 'pending')
  returning * into v_job;

  update credit_balances
  set reserved = reserved + p_amount, updated_at = now()
  where user_id = p_user_id;

  insert into credit_transactions (user_id, job_id, type, amount, status)
  values (p_user_id, v_job.id, 'reserve', p_amount, 'pending');

  return v_job;
end;
$$;

-- To make an account the owner, run once in the SQL editor (not from the app):
--   update profiles set role = 'owner'
--   where id = (select id from auth.users where email = '<your email>');
