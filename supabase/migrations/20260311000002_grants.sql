-- Additive patch for projects that already ran init + rls without table GRANTs.
-- Safe to re-run. Fixes: permission denied for table profiles (42501)

grant usage on schema public to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

grant select on public.creators to anon, authenticated;
grant insert, update on public.creators to authenticated;

grant select on public.datacuts to anon, authenticated;
grant insert, update, delete on public.datacuts to authenticated;
grant usage, select on sequence public.datacuts_id_seq to anon, authenticated;

grant select, insert, update, delete on public.saved to authenticated;

grant select, insert, update, delete on public.verification_applications to authenticated;
