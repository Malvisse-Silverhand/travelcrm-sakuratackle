-- Page builder (PB1): pages built in /admin/pages with Puck, published at
-- their own address, plus a media library.
--
-- Who can edit: admins (role 'operator') and editors (role 'editor').
-- Vendors cannot. private.is_operator() is unchanged, so editors still see
-- nothing of bookings, customers, payments or settings.

create or replace function private.is_page_editor() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_active and role in ('operator', 'editor')
  )
$$;
grant execute on function private.is_page_editor() to anon, authenticated;

-- ===== Pages ================================================================
create table if not exists site_pages (
  id uuid primary key default gen_random_uuid(),
  -- One URL segment: /<slug>. Lowercase letters, digits and dashes.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  title text not null check (char_length(title) between 1 and 120),
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  og_image text check (og_image ~ '^https://'),
  noindex boolean not null default false,
  -- Puck data: { root, content, zones }.
  draft jsonb not null default '{"root":{"props":{}},"content":[]}',
  published jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Addresses the site already uses (app/ routes) cannot be taken by a page.
alter table site_pages add constraint site_pages_slug_not_reserved check (
  slug not in ('admin', 'api', 'book', 'my-booking', 'reviews', 'polisi', 'resit',
               'destinasi', 'preview', 'sitemap', 'robots', 'icon', 'apple-icon',
               'favicon', 'brand', 'intro', 'help', 'images', '_next', 'tempah')
);

alter table site_pages enable row level security;
create policy "anyone reads published pages" on site_pages
  for select using (status = 'published');
create policy "page editors read all pages" on site_pages
  for select using (private.is_page_editor());
create policy "page editors insert pages" on site_pages
  for insert with check (private.is_page_editor());
create policy "page editors update pages" on site_pages
  for update using (private.is_page_editor()) with check (private.is_page_editor());
create policy "page editors delete pages" on site_pages
  for delete using (private.is_page_editor());

-- Every publish is kept, so a page can be put back as it was (PB3: restore).
create table if not exists site_page_revisions (
  id bigint generated always as identity primary key,
  page_id uuid not null references site_pages(id) on delete cascade,
  data jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references profiles(id) on delete set null
);
create index if not exists site_page_revisions_page on site_page_revisions (page_id, published_at desc);
alter table site_page_revisions enable row level security;
create policy "page editors manage revisions" on site_page_revisions
  for all using (private.is_page_editor()) with check (private.is_page_editor());

-- ===== Media library ========================================================
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do nothing;
create policy "anyone views site media" on storage.objects
  for select using (bucket_id = 'site-media');
create policy "page editors upload site media" on storage.objects
  for insert with check (bucket_id = 'site-media' and private.is_page_editor());
create policy "page editors delete site media" on storage.objects
  for delete using (bucket_id = 'site-media' and private.is_page_editor());

create table if not exists site_media (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  url text not null check (url ~ '^https://'),
  alt text not null check (char_length(alt) between 1 and 200),
  width int,
  height int,
  bytes int,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table site_media enable row level security;
create policy "page editors manage media" on site_media
  for all using (private.is_page_editor()) with check (private.is_page_editor());

-- ===== Activity =============================================================
create or replace function private.trg_site_pages_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform private.log_activity('page.deleted', 'page', old.id::text, format('Page /%s deleted', old.slug));
    return old;
  end if;
  if new.status = 'published' and new.published_at is distinct from old.published_at then
    perform private.log_activity('page.published', 'page', new.id::text,
      format('Page /%s published (%s)', new.slug, new.title));
  elsif new.status = 'draft' and old.status = 'published' then
    perform private.log_activity('page.unpublished', 'page', new.id::text, format('Page /%s unpublished', new.slug));
  end if;
  return new;
end;
$$;
drop trigger if exists site_pages_activity on site_pages;
create trigger site_pages_activity after update or delete on site_pages
  for each row execute function private.trg_site_pages_activity();
