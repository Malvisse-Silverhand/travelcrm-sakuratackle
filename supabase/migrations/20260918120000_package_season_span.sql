-- The calendar now sells Mac 2026 through September 2027, but the package's
-- own season_start was still 2027-03-01 from the original seed.
--
-- This is not cosmetic: the Reports screen scopes its whole date range to
-- [season_start, season_end] (app/admin/(app)/reports/page.tsx), so a booking
-- taken for one of the 2026 nights would have been silently left out of every
-- report — no error, just missing revenue.
--
-- season_end already covers the far edge of the window, so only the start
-- moves. The operator can still change both in Settings.

update packages
set season_start = '2026-03-01',
    updated_at = now()
where slug = 'candat-sotong-otai-otai'
  and season_start > '2026-03-01';
