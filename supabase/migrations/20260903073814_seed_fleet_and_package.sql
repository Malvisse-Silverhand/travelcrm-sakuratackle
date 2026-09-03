-- Reference data taken verbatim from the design files' own constants:
--   BOATS + ITIN from `design-reference/Admin CRM.dc.html`
--   FAQS + includes + pricing from `design-reference/Laman Tempahan.dc.html`
-- Idempotent so a fresh `db push` against an empty project yields a working app.

insert into boats (code, skipper_name, capacity) values
  ('TRF 92',   'Pak Su Rahim', 10),
  ('KNF 6241', 'Wan Azlan',    12),
  ('BTL 07',   'Din Kecik',     8),
  ('PKR 1180', 'Hafiz Ramli',  14)
on conflict (code) do nothing;

insert into packages (
  slug, title, subtitle, price_per_pax, deposit_per_boat,
  includes, itinerary, faqs, season_start, season_end, published
) values (
  'candat-sotong-otai-otai',
  'Trip Candat Sotong Otai-Otai',
  'Tak perlu skil tinggi, janji ada hati. Kami bawa anda ke lubuk rahsia kapten otai kami.',
  180,
  250,
  '["Candat, tali dan lampu","Jaket keselamatan bersijil","Air panas, Milo dan mi segera","Juragan berpengalaman 15 tahun","Hasil dibahagi sama rata"]'::jsonb,
  '[
    {"time":"18:30","title":"Berkumpul di Jeti Marang","body":"Taklimat keselamatan dan pembahagian jaket."},
    {"time":"19:00","title":"Bertolak ke lubuk","body":"Perjalanan lebih kurang 45 minit ke kawasan tukun."},
    {"time":"20:00","title":"Mula candat","body":"Lampu dipasang. Juragan tunjuk teknik untuk yang baru."},
    {"time":"01:00","title":"Rehat dan minum","body":"Air panas, Milo dan mi segera disediakan."},
    {"time":"06:00","title":"Balik ke jeti","body":"Hasil ditimbang dan dibahagi sama rata."}
  ]'::jsonb,
  '[
    {"q":"Perlu bawa pancing sendiri?","a":"Boleh disewa dari pihak Sakura Tackle sekiranya tiada. Sila bawa baju ganti, ubat mabuk laut dan barang-barang peribadi lain"},
    {"q":"Kalau hujan atau angin kuat?","a":"Kami pantau ramalan cuaca dua hari sebelum trip. Jika trip dibatalkan atas sebab cuaca, deposit dipulangkan penuh atau ditukar ke tarikh lain."},
    {"q":"Boleh bawa kanak-kanak?","a":"Boleh, umur 8 tahun ke atas dan mesti ditemani penjaga. Jaket keselamatan saiz kecil ada atas setiap bot."},
    {"q":"Bila baki perlu dijelaskan?","a":"Baki dibayar di Jeti Marang sebelum bertolak. Tunai atau pemindahan bank, kedua-duanya diterima."}
  ]'::jsonb,
  '2027-03-01',
  '2027-09-30',
  true
)
on conflict (slug) do nothing;

-- One trip_night row per active boat per night of the 2027 season (Mac-September).
-- A night with no row is simply not offered; the operator can block individual
-- nights later via trip_nights.blocked.
insert into trip_nights (boat_id, night_date)
select b.id, d::date
from boats b
cross join generate_series('2027-03-01'::date, '2027-09-30'::date, '1 day') as d
where b.active
on conflict (boat_id, night_date) do nothing;
