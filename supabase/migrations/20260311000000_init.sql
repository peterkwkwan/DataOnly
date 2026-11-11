-- DataOnly Alpha schema: profiles/creators, categories, datacuts, saved, verification

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  role text not null default 'user' check (role in ('user', 'creator', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  count text not null default '0',
  icon text not null,
  color text not null,
  blurb text not null default ''
);

create table if not exists public.creators (
  id text primary key,
  user_id uuid unique references public.profiles (id) on delete set null,
  name text not null,
  slug text not null unique,
  specialty text not null default '',
  cuts integer not null default 0,
  followers text not null default '0',
  initials text not null default '??',
  color text not null default '#c6ff4a',
  verified boolean not null default false,
  verified_at timestamptz,
  revoked_at timestamptz,
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.datacuts (
  id bigserial primary key,
  slug text not null unique,
  title text not null,
  creator_id text not null references public.creators (id) on delete cascade,
  category_id text not null references public.categories (id),
  price numeric(10, 2) not null default 0,
  rating numeric(3, 2) not null default 0,
  reviews integer not null default 0,
  size text not null default '',
  records text not null default '',
  accent text not null default '#c6ff4a',
  art text not null default 'data',
  updated_label text not null default 'Updated recently',
  format text not null default 'CSV',
  license text not null default 'personal' check (license in ('personal', 'commercial')),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved (
  user_id uuid not null references public.profiles (id) on delete cascade,
  datacut_id bigint not null references public.datacuts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, datacut_id)
);

create table if not exists public.verification_applications (
  id uuid primary key default gen_random_uuid(),
  creator_id text not null references public.creators (id) on delete cascade,
  status text not null default 'draft'
    check (status in (
      'draft', 'submitted', 'under_review', 'needs_more_info',
      'approved', 'rejected', 'revoked'
    )),
  identity text not null default '',
  industries text[] not null default '{}',
  portfolio_links text[] not null default '{}',
  credentials text,
  attestation_accepted_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  info_request_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists datacuts_status_idx on public.datacuts (status);
create index if not exists datacuts_creator_idx on public.datacuts (creator_id);
create index if not exists datacuts_category_idx on public.datacuts (category_id);
create index if not exists verification_status_idx on public.verification_applications (status);
create index if not exists saved_user_idx on public.saved (user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep creators.cuts roughly in sync with published listings
create or replace function public.refresh_creator_cut_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid text;
begin
  cid := coalesce(new.creator_id, old.creator_id);
  update public.creators
  set cuts = (
    select count(*)::int from public.datacuts
    where creator_id = cid and status = 'published'
  ),
  updated_at = now()
  where id = cid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists datacuts_cut_count on public.datacuts;
create trigger datacuts_cut_count
  after insert or update of status or delete on public.datacuts
  for each row execute function public.refresh_creator_cut_count();
