insert into storage.buckets (id, name, public) values
  ('garments-original','garments-original', false),
  ('garments-cutout','garments-cutout', false)
on conflict do nothing;

-- Path convention: {user_id}/{garment_id}.{ext}
create policy "own originals" on storage.objects for all
  using (bucket_id = 'garments-original' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'garments-original' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own cutouts" on storage.objects for all
  using (bucket_id = 'garments-cutout' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'garments-cutout' and (storage.foldername(name))[1] = auth.uid()::text);
