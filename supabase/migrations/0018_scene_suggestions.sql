-- Photoshoot scene ideas the AI wrote for this product, kept so they're
-- there next visit (and not re-billed to the AI provider on every load).
alter table products add column scene_suggestions jsonb;
