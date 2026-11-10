-- product-images: private bucket, user-scoped by a `<user_id>/...` path
-- prefix. Users can only read/write within their own folder.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do nothing;

create policy "owner insert product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner read product images"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- generated-images: public-read bucket (so exported posters have a stable
-- public URL to download/share). Writes only ever happen via the
-- service-role client in the job worker, which bypasses RLS entirely — no
-- insert/update/delete policy is granted to authenticated/anon here.
insert into storage.buckets (id, name, public)
values ('generated-images', 'generated-images', true)
on conflict (id) do nothing;
