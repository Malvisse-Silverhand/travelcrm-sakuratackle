-- Replaces the package FAQ with the four questions from the v2 design
-- (`Laman Tempahan v2.dc.html`, faqSrc), at the operator's request.
--
-- `faqs` stays operator-editable in the Packages screen — this only changes
-- the current content, not where it lives. The v1 questions it replaces
-- covered bringing your own rod, bad weather, children, and paying the
-- balance; none of those are answered by the new set, so if any of them come
-- up often they are worth adding back through the admin.

update packages
set faqs = '[
  {
    "q": "Boleh ke saya nak datang trip candat sorang-sorang?",
    "a": "Buat masa sekarang trip candat Sakura Tackle tak buka trip solo. Tetapi kami akan buka."
  },
  {
    "q": "Pukul berapa perlu berkumpul di Jeti?",
    "a": "Bertolak selepas Waktu Asar dari Jeti Marang. Pulang pukul 7:00 pagi keesokannya."
  },
  {
    "q": "Berapa deposit untuk lock slot?",
    "a": "Deposit serendah RM50/pax untuk lock slot."
  },
  {
    "q": "Umpan dan candat disediakan?",
    "a": "Umpan/candat boleh beli di vending machine di jeti sekiranya tiada."
  }
]'::jsonb,
    updated_at = now()
where slug = 'candat-sotong-otai-otai';
