-- Sample download + reviews summary (service_role datacuts lookup) need table GRANTs.
-- RLS bypass alone is not enough — missing GRANTs → 42501.
-- Safe to re-run. Same class as 20260318000000_service_role_creators_grant.sql.

grant select, update on public.datacuts to service_role;
