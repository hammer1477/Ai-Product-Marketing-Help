-- The latest render of a project's design as the user saved it. Generated
-- images are snapshots of what the AI made; this follows the user's edits,
-- so grids, campaigns and thumbnails show the design as it is now.
alter table creative_projects add column preview_path text;
alter table creative_projects add column preview_width int;
alter table creative_projects add column preview_height int;
