alter table profiles     enable row level security;
alter table preferences  enable row level security;
alter table garments     enable row level security;
alter table outfits      enable row level security;
alter table outfit_items enable row level security;
alter table feedback     enable row level security;
alter table upload_jobs  enable row level security;

create policy "own profile"     on profiles    for all using (id = auth.uid())      with check (id = auth.uid());
create policy "own preferences" on preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own garments"    on garments    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own outfits"     on outfits     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own feedback"    on feedback    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own jobs"        on upload_jobs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own outfit items" on outfit_items for all
  using (exists (select 1 from outfits o where o.id = outfit_id and o.user_id = auth.uid()))
  with check (
    exists (select 1 from outfits o where o.id = outfit_id and o.user_id = auth.uid())
    and exists (select 1 from garments g where g.id = garment_id and g.user_id = auth.uid())
  );
