-- 1) Roles: 'user' (pays per credit), 'family' (unlimited credits, no admin
--    access), 'owner' (unlimited credits + admin portal).
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('user', 'family', 'owner'));

-- 2) Admin credit adjustments are logged as their own transaction type.
alter table credit_transactions drop constraint if exists credit_transactions_type_check;
alter table credit_transactions add constraint credit_transactions_type_check
  check (type in ('reserve', 'finalize', 'refund', 'grant', 'adjust'));

-- Add (positive) or remove (negative) credits. Removal can't take the balance
-- below what's currently reserved for in-flight jobs. Server-only (see 4).
create or replace function admin_adjust_credits(p_user_id uuid, p_amount bigint)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance bigint;
  v_reserved bigint;
begin
  if p_amount = 0 then
    raise exception 'amount must not be zero';
  end if;

  insert into credit_balances (user_id, balance, reserved)
  values (p_user_id, 0, 0)
  on conflict (user_id) do nothing;

  select balance, reserved into v_balance, v_reserved
  from credit_balances where user_id = p_user_id for update;

  if v_balance + p_amount < v_reserved then
    raise exception 'cannot remove % credits: only % available', -p_amount, v_balance - v_reserved;
  end if;

  update credit_balances
  set balance = balance + p_amount, updated_at = now()
  where user_id = p_user_id
  returning balance into v_balance;

  insert into credit_transactions (user_id, job_id, type, amount, status)
  values (p_user_id, null, 'adjust', p_amount, 'completed');

  return v_balance;
end;
$$;

-- 3) reserve_credits: owner AND family are unlimited, and a signed-in caller
--    can only reserve against their own account (it used to trust p_user_id).
create or replace function reserve_credits(p_user_id uuid, p_amount int, p_creative_project_id uuid)
returns generation_jobs
language plpgsql
security definer set search_path = public
as $$
declare
  v_job generation_jobs;
  v_balance bigint;
  v_reserved bigint;
  v_unlimited boolean;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'cannot reserve credits for another user';
  end if;

  if p_amount <= 0 then
    raise exception 'reserve amount must be positive';
  end if;

  select role in ('owner', 'family') into v_unlimited from profiles where id = p_user_id;

  if coalesce(v_unlimited, false) then
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

-- 4) SECURITY FIX. Postgres lets every role EXECUTE new functions, and
--    Supabase exposes them as RPCs — so any signed-in user could call
--    grant_credits on themselves, or finalize/refund/claim jobs. Only the
--    server (service_role key) may call these now. reserve_credits stays
--    callable by signed-in users because the generate route runs it with the
--    user's session; the auth.uid() check above keeps it to their own account.
revoke execute on function grant_credits(uuid, int) from public, anon, authenticated;
revoke execute on function admin_adjust_credits(uuid, bigint) from public, anon, authenticated;
revoke execute on function finalize_credits(uuid) from public, anon, authenticated;
revoke execute on function refund_credits(uuid, text) from public, anon, authenticated;
revoke execute on function claim_pending_job(uuid) from public, anon, authenticated;
revoke execute on function reset_stuck_processing_jobs(int) from public, anon, authenticated;
revoke execute on function reserve_credits(uuid, int, uuid) from public, anon;

grant execute on function grant_credits(uuid, int) to service_role;
grant execute on function admin_adjust_credits(uuid, bigint) to service_role;
grant execute on function finalize_credits(uuid) to service_role;
grant execute on function refund_credits(uuid, text) to service_role;
grant execute on function claim_pending_job(uuid) to service_role;
grant execute on function reset_stuck_processing_jobs(int) to service_role;
grant execute on function reserve_credits(uuid, int, uuid) to authenticated, service_role;
