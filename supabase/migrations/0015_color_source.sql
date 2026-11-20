-- Per-ad choice of palette: the brand kit's colours, or the ones the art
-- director drew from the product photo. Null = default (brand when the kit
-- has colours). Kept on the project so regenerations keep the choice.
alter table creative_projects add column color_source text check (color_source in ('brand', 'product'));
