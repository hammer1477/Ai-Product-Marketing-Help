-- Credits: reserved is held against in-flight jobs, so spendable balance is
-- (balance - reserved). All writes happen through the SECURITY DEFINER
-- functions below, called via RPC with the user's session — never via
-- direct table writes, and never trusting client-provided amounts.
create table credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now()
);

alter table credit_balances enable row level security;

create policy "owner read" on credit_balances
  for select using (auth.uid() = user_id);

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references generation_jobs(id),
  type text not null check (type in ('reserve', 'finalize', 'refund', 'grant')),
  amount integer not null,
  status text not null check (status in ('pending', 'completed', 'refunded')),
  created_at timestamptz not null default now()
);

create index credit_transactions_user_id_idx on credit_transactions(user_id);
create index credit_transactions_job_id_idx on credit_transactions(job_id);

alter table credit_transactions enable row level security;

create policy "owner read" on credit_transactions
  for select using (auth.uid() = user_id);

-- Grant credits to a user (signup bonus, credit pack purchase, etc).
create function grant_credits(p_user_id uuid, p_amount int)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'grant amount must be positive';
  end if;

  insert into credit_balances (user_id, balance, reserved)
  values (p_user_id, p_amount, 0)
  on conflict (user_id) do update
    set balance = credit_balances.balance + p_amount, updated_at = now();

  insert into credit_transactions (user_id, job_id, type, amount, status)
  values (p_user_id, null, 'grant', p_amount, 'completed');
end;
$$;

-- Give every new user a starting free-tier credit grant. 20 is a Phase 1
-- placeholder — tune via this function without touching application code.
create function grant_signup_credits()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform grant_credits(new.id, 20);
  return new;
end;
$$;

create trigger on_profile_created_grant_credits
  after insert on profiles
  for each row execute function grant_signup_credits();

-- Reserve credits and create the generation_jobs row atomically. Raises if
-- the user's spendable balance (balance - reserved) is insufficient.
create function reserve_credits(p_user_id uuid, p_amount int, p_creative_project_id uuid)
returns generation_jobs
language plpgsql
security definer set search_path = public
as $$
declare
  v_job generation_jobs;
  v_balance int;
  v_reserved int;
begin
  if p_amount <= 0 then
    raise exception 'reserve amount must be positive';
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

-- Convert a pending reservation into a real debit on job success. Raises if
-- there is no matching pending reservation, making double-finalize impossible.
create function finalize_credits(p_job_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_txn credit_transactions;
begin
  select * into v_txn from credit_transactions
  where job_id = p_job_id and type = 'reserve' and status = 'pending'
  for update;

  if v_txn is null then
    raise exception 'no pending reservation found for job %', p_job_id;
  end if;

  update credit_balances
  set balance = balance - v_txn.amount, reserved = reserved - v_txn.amount, updated_at = now()
  where user_id = v_txn.user_id;

  update credit_transactions set status = 'completed' where id = v_txn.id;

  update generation_jobs set status = 'completed', completed_at = now() where id = p_job_id;
end;
$$;

-- Release a pending reservation without touching balance, on job failure.
-- Raises if there is no matching pending reservation (already resolved).
create function refund_credits(p_job_id uuid, p_error_message text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_txn credit_transactions;
begin
  select * into v_txn from credit_transactions
  where job_id = p_job_id and type = 'reserve' and status = 'pending'
  for update;

  if v_txn is null then
    raise exception 'no pending reservation found for job %', p_job_id;
  end if;

  update credit_balances
  set reserved = reserved - v_txn.amount, updated_at = now()
  where user_id = v_txn.user_id;

  update credit_transactions set status = 'refunded' where id = v_txn.id;

  update generation_jobs
  set status = 'failed', error_message = p_error_message, completed_at = now()
  where id = p_job_id;
end;
$$;
