-- Checkout (service_role creator lookup) + Connect webhook (sync stripe_* flags)
-- need table GRANTs. RLS bypass alone is not enough — missing GRANTs → 42501.
-- Safe to re-run.

grant select, update on public.creators to service_role;
