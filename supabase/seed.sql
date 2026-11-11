-- Seed from packages/core mock catalog (run after migrations)
-- Safe to re-run: upserts by primary key / unique slug

insert into public.categories (id, name, slug, count, icon, color, blurb) values
  ('finance', 'Finance', 'finance', '1,248', 'finance', '#c6ff4a', 'Market signals, credit risk, and institutional research sets.'),
  ('healthcare', 'Healthcare', 'healthcare', '986', 'healthcare', '#82d8ff', 'Clinical, outcomes, and care-delivery datasets from practitioners.'),
  ('engineering', 'Engineering', 'engineering', '754', 'engineering', '#ffc873', 'Materials, systems, and applied engineering observations.'),
  ('food-culinary', 'Food & Culinary', 'food-culinary', '621', 'culinary', '#ff9b8a', 'Sensory profiles, recipes science, and food supply observations.'),
  ('energy', 'Energy', 'energy', '517', 'energy', '#a9a2ff', 'Grid load, renewables, and residential usage patterns.'),
  ('sports-fitness', 'Sports & Fitness', 'sports-fitness', '439', 'fitness', '#7ce6ba', 'Biomechanics, training load, and human performance data.')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  count = excluded.count,
  icon = excluded.icon,
  color = excluded.color,
  blurb = excluded.blurb;

insert into public.creators (
  id, user_id, name, slug, specialty, cuts, followers, initials, color, verified, verified_at, bio
) values
  ('meridian', null, 'Meridian Analytics', 'meridian-analytics', 'Financial Intelligence', 42, '18.4K', 'MA', '#c6ff4a', true, now(), 'Financial intelligence for teams building a clearer view of global markets.'),
  ('kinetic', null, 'Kinetic Intelligence', 'kinetic-intelligence', 'Human Performance', 28, '12.8K', 'KI', '#7ce6ba', true, now(), 'Human performance studio packaging clean biomechanics and training datasets.'),
  ('sensory', null, 'The Sensory Lab', 'the-sensory-lab', 'Food Science', 19, '9.6K', 'SL', '#ff9b8a', true, now(), 'Food science lab publishing sensory profiles and culinary research cuts.'),
  ('gridworks', null, 'Gridworks Research', 'gridworks-research', 'Energy Systems', 15, '7.1K', 'GR', '#a9a2ff', false, null, 'Independent energy researchers documenting residential and grid usage patterns.')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  specialty = excluded.specialty,
  cuts = excluded.cuts,
  followers = excluded.followers,
  initials = excluded.initials,
  color = excluded.color,
  verified = excluded.verified,
  verified_at = excluded.verified_at,
  bio = excluded.bio;

insert into public.datacuts (
  id, slug, title, creator_id, category_id, price, rating, reviews, size, records,
  accent, art, updated_label, format, license, description, status
) values
  (1, 'global-coffee-flavor-roast-profiles', 'Global Coffee Flavor & Roast Profiles', 'sensory', 'food-culinary',
   84, 4.9, 128, '2.4 GB', '148K', '#d8ff78', 'coffee', 'Updated 4 days ago', 'CSV', 'commercial',
   'Cupping scores, roast curves, and regional flavor notes from specialty coffee producers across 32 origins.', 'published'),
  (2, 'residential-energy-usage-patterns', 'Residential Energy Usage Patterns', 'gridworks', 'energy',
   120, 4.8, 94, '6.8 GB', '2.1M', '#b9b2ff', 'energy', 'Updated 1 week ago', 'Parquet', 'commercial',
   'Anonymized household load curves with weather overlays for demand forecasting and efficiency research.', 'published'),
  (3, 'human-movement-biomechanics', 'Human Movement Biomechanics', 'kinetic', 'sports-fitness',
   65, 4.9, 211, '1.7 GB', '86K', '#89eac2', 'motion', 'Updated yesterday', 'JSON', 'personal',
   'Motion-capture joint angles and ground-reaction forces from gait and training sessions.', 'published'),
  (4, 'market-sentiment-signal-archive', 'Market Sentiment Signal Archive', 'meridian', 'finance',
   149, 4.7, 76, '4.2 GB', '920K', '#8fd8ff', 'finance', 'Updated 2 days ago', 'CSV', 'commercial',
   'Daily sentiment features derived from filings, headlines, and social chatter for equities research.', 'published')
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  creator_id = excluded.creator_id,
  category_id = excluded.category_id,
  price = excluded.price,
  rating = excluded.rating,
  reviews = excluded.reviews,
  size = excluded.size,
  records = excluded.records,
  accent = excluded.accent,
  art = excluded.art,
  updated_label = excluded.updated_label,
  format = excluded.format,
  license = excluded.license,
  description = excluded.description,
  status = excluded.status;

-- Keep serial sequence ahead of seeded ids
select setval(pg_get_serial_sequence('public.datacuts', 'id'), (select coalesce(max(id), 1) from public.datacuts));
