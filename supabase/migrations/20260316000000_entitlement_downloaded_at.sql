-- Record first successful entitled download (blocks admin refunds afterward).
-- Set by /api/entitlements/access when a signed URL is minted; null until then.

alter table public.entitlements
  add column if not exists downloaded_at timestamptz;

comment on column public.entitlements.downloaded_at is
  'First successful download (signed URL mint). Null = not downloaded; refunds blocked when set.';
