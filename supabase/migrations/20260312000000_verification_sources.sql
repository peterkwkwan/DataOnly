-- Verified sources (Alpha): structured evidence links for verification applications.
-- Leaves portfolio_links text[] in place; UI stops writing it.

alter table public.verification_applications
  add column if not exists sources jsonb not null default '[]'::jsonb;
