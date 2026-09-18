-- v2 booking page: the fleet is now presented as spec cards (photo, class,
-- length, beam, material, daily rate, description), so boats need the
-- attributes the old slot-only page never displayed.
--
-- Source of truth: design-reference/Ver 2.0 .../Sakura Tackle System.dc.html
-- frame A "P2 Armada", cross-checked against Laman Tempahan v2.dc.html.

alter table boats add column kind         text;
alter table boats add column length_ft    numeric(5,1);
alter table boats add column beam         text;
alter table boats add column material     text;
alter table boats add column daily_rate   numeric(10,2);
alter table boats add column description  text;
alter table boats add column photo_url    text;
alter table boats add column sort_order   int not null default 0;

-- Existing two boats keep their ids (trip_nights and bookings reference
-- them) and gain v2 specs. KNF 6241's capacity is corrected 12 -> 15.
update boats set
  kind = 'Kapal Tradisional', length_ft = 51, beam = '14 Kaki',
  material = 'Kayu Cengal', daily_rate = 1500, sort_order = 4,
  description = 'Bot candat saiz sederhana dalam armada kami. Diperbuat daripada kayu cengal buatan tangan orang Marang. Bot ini direka khas untuk kestabilan maksimum di tengah laut untuk memastikan kumpulan anda selesa sepanjang malam.'
where code = 'TRF 92';

update boats set
  kind = 'Kapal Tradisional', length_ft = 63, beam = '16.5 Kaki',
  material = 'Kayu Cengal, Fiberglass', daily_rate = 2300, capacity = 15, sort_order = 2,
  description = 'Bot candat terpanjang dalam armada kami. Diperbuat daripada kayu cengal buatan tangan orang Marang. Bot ini direka khas untuk kestabilan maksimum di tengah laut untuk memastikan kumpulan anda selesa sepanjang malam.'
where code = 'KNF 6241';

-- BTL 07 and PKR 1180 are not in the v2 armada. They are deactivated rather
-- than deleted: trip_nights rows reference them, and a hard delete would
-- cascade away season data for no reason. Deactivating also removes them
-- from get_public_availability, which already filters on b.active.
update boats set active = false where code in ('BTL 07', 'PKR 1180');

insert into boats (code, skipper_name, capacity, kind, length_ft, beam, material, daily_rate, sort_order, description) values
  ('PUTERA KAPAS', 'Pak Su Rahim', 8, 'Speedboat', 42, '10 Kaki', 'Fiber Glass', 2000, 1,
   'Antara speedboat yang kami kendali. Diperbuat daripada fiberglass buatan tangan orang Marang. Bot ini direka khas untuk kestabilan maksimum di tengah laut, memastikan anda selesa sepanjang malam.'),
  ('TRF 1005', 'Wan Azlan', 15, 'Kapal Tradisional', 56, '15 Kaki', 'Kayu Cengal', 2300, 3,
   'Bot candat terpanjang dalam armada kami. Diperbuat daripada kayu cengal buatan tangan orang Marang. Bot ini direka khas untuk kestabilan maksimum di tengah laut untuk memastikan kumpulan anda selesa sepanjang malam.'),
  ('TRA 1539', 'Din Kecik', 10, 'Kapal Tradisional', 51, '14 Kaki', 'Kayu Cengal', 1500, 5,
   'Bot candat saiz sederhana dalam armada kami. Diperbuat daripada kayu cengal buatan tangan orang Marang. Bot ini direka khas untuk kestabilan maksimum di tengah laut untuk memastikan kumpulan anda selesa sepanjang malam.')
on conflict (code) do nothing;

-- The display name on the card is the boat's own name, which for the
-- speedboat is not its registration code.
alter table boats add column display_name text;
update boats set display_name = 'SpeedBoat "Putera Kapas"' where code = 'PUTERA KAPAS';

-- ---------------------------------------------------------------- pricing --
-- v2 drops the deposit from RM250 to RM200 per boat. Only the package
-- default changes here; existing bookings keep the deposit_amount they were
-- created with, which is the correct behaviour for money already quoted.
update packages set deposit_per_boat = 200 where deposit_per_boat = 250;

-- ------------------------------------------------------ business details ---
-- v2 carries the real contact details from sakuratackle.com.
update org_settings set
  whatsapp_number = '601153598055',
  location        = 'Kompleks LKIM Marang, Jeti Marang, Terengganu'
where id = 1;
