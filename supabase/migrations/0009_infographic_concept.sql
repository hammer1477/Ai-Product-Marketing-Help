-- Adds the "infographic" concept (numbered feature-callout layout) alongside
-- the existing premium_photo / graphic_poster concepts.
alter table creative_projects drop constraint creative_projects_concept_check;
alter table creative_projects add constraint creative_projects_concept_check
  check (concept in ('premium_photo', 'graphic_poster', 'infographic'));
