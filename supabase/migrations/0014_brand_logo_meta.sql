-- Logo metadata the composer needs without decoding the image: its aspect
-- ratio (to size it) and whether it's light or dark ink (to decide whether
-- it needs a contrasting chip behind it on a given background).
alter table brand_kits add column logo_aspect numeric;
alter table brand_kits add column logo_tone text check (logo_tone in ('light', 'dark'));
