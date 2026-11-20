-- Credit pack purchases through Stripe Checkout.
--
-- One row per paid Checkout Session. The session id is the primary key, so
-- fulfilment is idempotent: the webhook and the success-page redirect can
-- both try to fulfil the same purchase, and Stripe may retry the webhook,
-- but credits are granted exactly once.

alter table credit_transactions drop constraint if exists credit_transactions_type_check;
alter table credit_transactions add constraint credit_transactions_type_check
  check (type in ('reserve', 'finalize', 'refund', 'grant', 'adjust', 'purchase'));

create table credit_purchases (
  stripe_session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null,
  credits bigint not null check (credits > 0),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null,
  created_at timestamptz not null default now()
);

create index credit_purchases_user_id_idx on credit_purchases(user_id, created_at desc);

alter table credit_purchases enable row level security;

create policy "owner read" on credit_purchases
  for select using (auth.uid() = user_id);

-- Records the purchase and grants its credits, once. Returns true when this
-- call did the granting, false when the session was already fulfilled.
create function fulfill_credit_purchase(
  p_session_id text,
  p_user_id uuid,
  p_pack_id text,
  p_credits bigint,
  p_amount_cents integer,
  p_currency text
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_inserted int;
begin
  if p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  insert into credit_purchases (stripe_session_id, user_id, pack_id, credits, amount_cents, currency)
  values (p_session_id, p_user_id, p_pack_id, p_credits, p_amount_cents, p_currency)
  on conflict (stripe_session_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  insert into credit_balances (user_id, balance, reserved)
  values (p_user_id, p_credits, 0)
  on conflict (user_id) do update
    set balance = credit_balances.balance + p_credits, updated_at = now();

  insert into credit_transactions (user_id, job_id, type, amount, status)
  values (p_user_id, null, 'purchase', p_credits, 'completed');

  return true;
end;
$$;

-- Server only: the amounts come from a Stripe session the server verified.
revoke execute on function fulfill_credit_purchase(text, uuid, text, bigint, integer, text) from public, anon, authenticated;
grant execute on function fulfill_credit_purchase(text, uuid, text, bigint, integer, text) to service_role;
