-- Two content fixes the operator asked for.
--
-- 1. Boat photos. The v2 design left the five fleet cards as placeholder drop
--    zones, so they have been rendering grey boxes. These are the operator's
--    own photos, already published on sakuratackle.com, so they are linked
--    rather than copied into Supabase Storage — there is no admin uploader for
--    boat photos yet (the v2 design never updated the console), and copying
--    them would create a second copy to keep in sync with no way to manage it.
--
--    Note TRA 1539's file is named "TFA-1539.jpeg" upstream — a typo in their
--    media library, not a wrong boat. Left as-is because renaming it there
--    would break the link.
--
-- 2. Trip timing. The FAQ and the calendar's slot card both say "Bertolak
--    selepas Waktu Asar. Pulang 7:00 pagi keesokannya", but the itinerary
--    still described an 18:30 gathering and a 06:00 return. The operator
--    confirmed the Asar/7:00 timing is correct, so the itinerary moves to
--    match. The two middle steps keep their clock times; only the bookends
--    were wrong.

update boats set photo_url = 'https://sakuratackle.com/wp-content/uploads/2026/02/Speedboat.jpeg' where code = 'PUTERA KAPAS';
update boats set photo_url = 'https://sakuratackle.com/wp-content/uploads/2026/02/KNF-6241.jpeg'  where code = 'KNF 6241';
update boats set photo_url = 'https://sakuratackle.com/wp-content/uploads/2026/02/TRF-1005.jpeg'  where code = 'TRF 1005';
update boats set photo_url = 'https://sakuratackle.com/wp-content/uploads/2026/02/TRF-92.jpeg'    where code = 'TRF 92';
update boats set photo_url = 'https://sakuratackle.com/wp-content/uploads/2026/02/TFA-1539.jpeg'  where code = 'TRA 1539';

update packages
set itinerary = '[
  {
    "time": "Sebelum Asar",
    "title": "Berkumpul di Jeti Marang",
    "body": "Taklimat keselamatan dan pembahagian jaket."
  },
  {
    "time": "Selepas Asar",
    "title": "Bertolak ke lubuk",
    "body": "Perjalanan lebih kurang 45 minit ke kawasan tukun."
  },
  {
    "time": "20:00",
    "title": "Mula candat",
    "body": "Lampu dipasang. Juragan tunjuk teknik untuk yang baru."
  },
  {
    "time": "01:00",
    "title": "Rehat dan minum",
    "body": "Air panas, Milo dan mi segera disediakan."
  },
  {
    "time": "07:00",
    "title": "Balik ke jeti",
    "body": "Hasil ditimbang dan dibahagi sama rata."
  }
]'::jsonb,
    updated_at = now()
where slug = 'candat-sotong-otai-otai';
