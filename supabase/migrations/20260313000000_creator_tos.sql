-- Creator Terms of Service acceptance (Alpha).
-- Stores when + which version a creator accepted. Re-accept when CREATOR_TOS_VERSION bumps.

alter table public.profiles
  add column if not exists tos_accepted_at timestamptz,
  add column if not exists tos_version text;
