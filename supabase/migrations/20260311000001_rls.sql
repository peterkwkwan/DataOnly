-- Basic RLS: public read published; owners write; verification queue admin stub

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.creators enable row level security;
alter table public.datacuts enable row level security;
alter table public.saved enable row level security;
alter table public.verification_applications enable row level security;

-- Helper: current user is admin (stub — set profiles.role = 'admin' in dashboard SQL)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.owns_creator(creator_row_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.creators c
    where c.id = creator_row_id and c.user_id = auth.uid()
  );
$$;

-- Profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid() or public.is_admin());

-- Categories: public read; admin write
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
  for select using (true);

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- Creators: public read; owner update; authenticated insert own; admin all
drop policy if exists "creators_public_read" on public.creators;
create policy "creators_public_read" on public.creators
  for select using (true);

drop policy if exists "creators_owner_insert" on public.creators;
create policy "creators_owner_insert" on public.creators
  for insert with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "creators_owner_update" on public.creators;
create policy "creators_owner_update" on public.creators
  for update using (user_id = auth.uid() or public.is_admin());

-- Datacuts: public read published; owners read/write own; admin all
drop policy if exists "datacuts_public_read_published" on public.datacuts;
create policy "datacuts_public_read_published" on public.datacuts
  for select using (
    status = 'published'
    or public.owns_creator(creator_id)
    or public.is_admin()
  );

drop policy if exists "datacuts_owner_insert" on public.datacuts;
create policy "datacuts_owner_insert" on public.datacuts
  for insert with check (public.owns_creator(creator_id) or public.is_admin());

drop policy if exists "datacuts_owner_update" on public.datacuts;
create policy "datacuts_owner_update" on public.datacuts
  for update using (public.owns_creator(creator_id) or public.is_admin());

drop policy if exists "datacuts_owner_delete" on public.datacuts;
create policy "datacuts_owner_delete" on public.datacuts
  for delete using (public.owns_creator(creator_id) or public.is_admin());

-- Saved: owner only
drop policy if exists "saved_owner_all" on public.saved;
create policy "saved_owner_all" on public.saved
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Verification applications: owner CRUD; admin review queue
drop policy if exists "verification_owner_select" on public.verification_applications;
create policy "verification_owner_select" on public.verification_applications
  for select using (public.owns_creator(creator_id) or public.is_admin());

drop policy if exists "verification_owner_insert" on public.verification_applications;
create policy "verification_owner_insert" on public.verification_applications
  for insert with check (public.owns_creator(creator_id) or public.is_admin());

drop policy if exists "verification_owner_update" on public.verification_applications;
create policy "verification_owner_update" on public.verification_applications
  for update using (public.owns_creator(creator_id) or public.is_admin());

drop policy if exists "verification_admin_delete" on public.verification_applications;
create policy "verification_admin_delete" on public.verification_applications
  for delete using (public.is_admin());
