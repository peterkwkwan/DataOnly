-- Listing stats (service_role count on saved) needs a table GRANT.
-- RLS bypass alone is not enough — missing GRANTs → 42501 → saves metric stuck at 0.
-- Safe to re-run. Same class as 20260318000000_service_role_creators_grant.sql.

grant select on public.saved to service_role;
