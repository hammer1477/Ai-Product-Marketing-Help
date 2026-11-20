-- Friends of the Master: a tier below family. Not unlimited — instead a
-- one-time gift of free credits when they're first made a friend.

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('user', 'friend', 'family', 'owner'));

-- When the friend gift was given. Set once; never reset, so demoting and
-- re-promoting someone can't mint a second gift.
alter table profiles add column friend_gift_at timestamptz;

alter table credit_transactions drop constraint if exists credit_transactions_type_check;
alter table credit_transactions add constraint credit_transactions_type_check
  check (type in ('reserve', 'finalize', 'refund', 'grant', 'adjust', 'purchase', 'gift'));

-- Gives the friend gift once. Returns true when this call gave it.
create function grant_friend_gift(p_user_id uuid, p_amount bigint)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_marked int;
begin
  if p_amount <= 0 then
    raise exception 'gift must be positive';
  end if;

  update profiles set friend_gift_at = now()
  where id = p_user_id and friend_gift_at is null;
  get diagnostics v_marked = row_count;
  if v_marked = 0 then
    return false;
  end if;

  insert into credit_balances (user_id, balance, reserved)
  values (p_user_id, p_amount, 0)
  on conflict (user_id) do update
    set balance = credit_balances.balance + p_amount, updated_at = now();

  insert into credit_transactions (user_id, job_id, type, amount, status)
  values (p_user_id, null, 'gift', p_amount, 'completed');

  return true;
end;
$$;

revoke execute on function grant_friend_gift(uuid, bigint) from public, anon, authenticated;
grant execute on function grant_friend_gift(uuid, bigint) to service_role;
