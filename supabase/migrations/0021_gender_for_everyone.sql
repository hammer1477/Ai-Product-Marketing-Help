-- Every account has a gender, chosen at sign-up and editable on the profile
-- page. New accounts get it from the sign-up metadata; anything unexpected
-- is stored as null rather than failing the sign-up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, gender)
  values (
    new.id,
    new.raw_user_meta_data->>'display_name',
    case when new.raw_user_meta_data->>'gender' in ('male', 'female') then new.raw_user_meta_data->>'gender' end
  );
  return new;
end;
$$;
