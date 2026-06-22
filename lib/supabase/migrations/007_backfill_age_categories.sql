-- Backfill age_categories from age_range text for existing events and resources.
--
-- Canonical buckets:
--   'expecting' — pregnant / prenatal
--   'newborn'   — 0–4 months
--   'baby'      — 4–12 months
--   'toddler'   — 1–4 years (12–48 months)
--   'all ages'  — no restriction / unspecified
--
-- Strategy: parse numbers + unit from age_range, convert to months,
-- then check which buckets the range overlaps. Keyword fallbacks for
-- non-numeric strings like "Pre-crawlers" or "Babies".
--
-- Run this AFTER 20260622_add_age_categories.sql

CREATE OR REPLACE FUNCTION activities._compute_age_categories(age_range text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  r    text;
  cats text[] := '{}';
  lo   numeric := -1;   -- lower bound in months
  hi   numeric := -1;   -- upper bound in months
  m    text[];
BEGIN
  r := lower(trim(coalesce(age_range, '')));

  IF r = '' THEN RETURN ARRAY['all ages']; END IF;
  IF r ILIKE '%all age%' OR r IN ('everyone', 'all') THEN RETURN ARRAY['all ages']; END IF;

  -- expecting
  IF r ILIKE '%pregnant%' OR r ILIKE '%prenatal%'
     OR r ILIKE '%antenatal%' OR r ILIKE '%expecting%'
  THEN
    cats := cats || ARRAY['expecting'];
  END IF;

  -- Parse "X-Y unit" (e.g. "0-12 months", "2-6 years", "1-4 years old")
  m := regexp_match(r, '([0-9]+)\s*[-]\s*([0-9]+)\s*(months?|mo|years?|yr)');
  IF m IS NOT NULL THEN
    IF m[3] ILIKE 'month%' OR m[3] ILIKE 'mo' THEN
      lo := m[1]::numeric;
      hi := m[2]::numeric;
    ELSE
      lo := m[1]::numeric * 12;
      hi := m[2]::numeric * 12;
    END IF;
  END IF;

  -- Parse "X+ unit" (e.g. "2+ years")
  IF lo = -1 THEN
    m := regexp_match(r, '([0-9]+)\s*[+]\s*(months?|mo|years?|yr)');
    IF m IS NOT NULL THEN
      IF m[2] ILIKE 'month%' OR m[2] ILIKE 'mo' THEN
        lo := m[1]::numeric; hi := 999;
      ELSE
        lo := m[1]::numeric * 12; hi := 999;
      END IF;
    END IF;
  END IF;

  -- Parse "X unit" standalone (e.g. "36 months", "2 years")
  IF lo = -1 THEN
    m := regexp_match(r, '([0-9]+)\s*(months?|mo|years?|yr)');
    IF m IS NOT NULL THEN
      IF m[2] ILIKE 'month%' OR m[2] ILIKE 'mo' THEN
        lo := m[1]::numeric; hi := m[1]::numeric;
      ELSE
        lo := m[1]::numeric * 12; hi := m[1]::numeric * 12;
      END IF;
    END IF;
  END IF;

  -- Assign buckets by checking range overlap (in months):
  --   newborn  [0,  4]
  --   baby     [4, 12]
  --   toddler [12, 48]
  IF lo >= 0 THEN
    IF lo <= 4                   THEN cats := cats || ARRAY['newborn']; END IF;
    IF lo < 12 AND hi >= 4       THEN cats := cats || ARRAY['baby'];    END IF;
    IF lo <= 48 AND hi > 13      THEN cats := cats || ARRAY['toddler']; END IF;
  END IF;

  -- Keyword fallbacks for non-numeric strings
  IF r ILIKE '%newborn%' OR r ILIKE '%pre%crawl%' OR r ILIKE '%6 week%' THEN
    IF NOT ('newborn' = ANY(cats)) THEN cats := cats || ARRAY['newborn']; END IF;
  END IF;

  IF r ILIKE '%baby%' OR r ILIKE '%babies%'
     OR (r ILIKE '%crawler%' AND NOT r ILIKE '%pre%crawl%')
  THEN
    IF NOT ('baby' = ANY(cats)) THEN cats := cats || ARRAY['baby']; END IF;
  END IF;

  IF r ILIKE '%toddler%' OR r ILIKE '%preschool%' OR r ILIKE '%pre-school%' THEN
    IF NOT ('toddler' = ANY(cats)) THEN cats := cats || ARRAY['toddler']; END IF;
  END IF;

  IF array_length(cats, 1) IS NULL THEN
    cats := ARRAY['all ages'];
  END IF;

  RETURN cats;
END;
$$;

-- Backfill events
UPDATE activities.events
SET age_categories = activities._compute_age_categories(age_range)
WHERE age_categories = '{}' OR age_categories IS NULL;

-- Backfill resources
UPDATE activities.resources
SET age_categories = activities._compute_age_categories(age_range)
WHERE age_categories = '{}' OR age_categories IS NULL;

-- DROP FUNCTION activities._compute_age_categories(text);
