-- Package cover images, uploaded from the Page Builder (Screen 8). Unlike
-- receipts, these must be publicly readable — the cover photo renders
-- directly on the public booking page's hero section as a plain <img src>,
-- which needs a fully public URL, not a signed one.

insert into storage.buckets (id, name, public)
values ('package-covers', 'package-covers', true)
on conflict (id) do nothing;

create policy "anyone can view package covers"
on storage.objects for select
using (bucket_id = 'package-covers');

create policy "operator uploads package covers"
on storage.objects for insert
with check (bucket_id = 'package-covers' and private.is_operator());

create policy "operator updates package covers"
on storage.objects for update
using (bucket_id = 'package-covers' and private.is_operator())
with check (bucket_id = 'package-covers' and private.is_operator());

create policy "operator deletes package covers"
on storage.objects for delete
using (bucket_id = 'package-covers' and private.is_operator());
