-- How the Master is addressed: a female Master is the Mistress (and Mommy,
-- not Daddy). Null means unset, which reads as the masculine default.
alter table profiles add column if not exists gender text check (gender in ('male', 'female'));

grant update (gender) on profiles to authenticated;
