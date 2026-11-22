-- The Master: one permanent, untouchable owner account.
--
-- * Exactly one Master, recorded here once and never movable: the row can't
--   be updated, deleted or joined by a second row.
-- * The Master's profile always stays 'owner' and can't be deleted, and the
--   Master's login can't be deleted (foreign key restrict) — whoever asks,
--   including other owners and the service-role key.
-- * Only the Master may grant or remove the owner role (enforced in the app,
--   whose admin actions all run server-side; see app/(dashboard)/admin).

create table app_master (
  id uuid primary key references auth.users(id) on delete restrict,
  singleton boolean not null default true unique check (singleton),
  crowned_at timestamptz not null default now()
);

alter table app_master enable row level security;
-- No policies: invisible to anon/authenticated. Read by the server only.
revoke all on app_master from public, anon, authenticated;
grant select on app_master to service_role;

insert into app_master (id) values ('1deeead7-05f8-4fe1-846d-eb935bbc555d');

create function app_master_is_permanent()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The Master is permanent and cannot be changed.';
end;
$$;

create trigger app_master_no_update before update on app_master
  for each row execute function app_master_is_permanent();
create trigger app_master_no_delete before delete on app_master
  for each row execute function app_master_is_permanent();
create trigger app_master_no_truncate before truncate on app_master
  for each statement execute function app_master_is_permanent();

create function protect_master_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from app_master where id = old.id) then
    if tg_op = 'DELETE' then
      raise exception 'The Master cannot be removed.';
    end if;
    if new.role is distinct from 'owner' then
      raise exception 'The Master''s rank cannot be changed.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_protect_master_update before update of role on profiles
  for each row execute function protect_master_profile();
create trigger profiles_protect_master_delete before delete on profiles
  for each row execute function protect_master_profile();

revoke execute on function protect_master_profile() from public, anon, authenticated;
revoke execute on function app_master_is_permanent() from public, anon, authenticated;
