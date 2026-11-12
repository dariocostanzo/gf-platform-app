begin;

alter table public.restaurants
  alter column created_by drop not null;

alter table public.restaurants
  drop constraint restaurants_created_by_fkey,
  add constraint restaurants_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.restaurants
  add column listing_source text not null default 'community'
    check (listing_source in ('community', 'openstreetmap')),
  add column source_reference text,
  add column source_license text,
  add column gluten_free_options text
    check (
      gluten_free_options is null
      or gluten_free_options in ('yes', 'only', 'limited')
    ),
  add constraint restaurants_source_attribution_check check (
    (
      listing_source = 'openstreetmap'
      and source_reference is not null
      and source_reference ~ '^https://www\.openstreetmap\.org/(node|way|relation)/[0-9]+$'
      and source_license is not null
      and source_license = 'ODbL-1.0'
      and gluten_free_options is not null
    )
    or (
      listing_source = 'community'
      and source_reference is null
      and source_license is null
      and gluten_free_options is null
    )
  );

create unique index restaurants_source_reference_idx
  on public.restaurants (source_reference)
  where source_reference is not null;

insert into public.restaurants (
  name,
  address,
  city,
  postal_code,
  country_code,
  location,
  status,
  listing_source,
  source_reference,
  source_license,
  gluten_free_options,
  created_by
)
values
  (
    'Hawksmoor',
    '11 Langley Street',
    'London',
    'WC2H 9JG',
    'GB',
    extensions.st_geomfromtext('POINT(-0.125749 51.513457)', 4326)::extensions.geography,
    'published',
    'openstreetmap',
    'https://www.openstreetmap.org/node/1094236528',
    'ODbL-1.0',
    'yes',
    null
  ),
  (
    'Pizza Pilgrims',
    '82 Lower Marsh',
    'London',
    'SE1 7AB',
    'GB',
    extensions.st_geomfromtext('POINT(-0.111124 51.501669)', 4326)::extensions.geography,
    'published',
    'openstreetmap',
    'https://www.openstreetmap.org/node/11784747676',
    'ODbL-1.0',
    'yes',
    null
  ),
  (
    'Cream Dream',
    '46 Bedford Street',
    'London',
    'WC2E 9HA',
    'GB',
    extensions.st_geomfromtext('POINT(-0.123686 51.510089)', 4326)::extensions.geography,
    'published',
    'openstreetmap',
    'https://www.openstreetmap.org/node/12778158730',
    'ODbL-1.0',
    'yes',
    null
  ),
  (
    'The Pie Hole',
    '252 High Holborn',
    'London',
    'WC1V 7EN',
    'GB',
    extensions.st_geomfromtext('POINT(-0.117664 51.517729)', 4326)::extensions.geography,
    'published',
    'openstreetmap',
    'https://www.openstreetmap.org/node/13137881011',
    'ODbL-1.0',
    'yes',
    null
  ),
  (
    'Bill''s',
    null,
    null,
    null,
    'GB',
    extensions.st_geomfromtext('POINT(-0.126486 51.512421)', 4326)::extensions.geography,
    'published',
    'openstreetmap',
    'https://www.openstreetmap.org/node/1494827513',
    'ODbL-1.0',
    'yes',
    null
  ),
  (
    'Honest Burgers',
    '9 Festival Terrace',
    'London',
    'SE1 8XX',
    'GB',
    extensions.st_geomfromtext('POINT(-0.116711 51.505262)', 4326)::extensions.geography,
    'published',
    'openstreetmap',
    'https://www.openstreetmap.org/node/282686485',
    'ODbL-1.0',
    'yes',
    null
  ),
  (
    'Côte Brasserie',
    'Belvedere Road',
    'London',
    'SE1 8XX',
    'GB',
    extensions.st_geomfromtext('POINT(-0.116929 51.505330)', 4326)::extensions.geography,
    'published',
    'openstreetmap',
    'https://www.openstreetmap.org/node/282686486',
    'ODbL-1.0',
    'yes',
    null
  ),
  (
    'Franco Manca',
    '2 St Paul''s Churchyard',
    'London',
    'EC4M 8AY',
    'GB',
    extensions.st_geomfromtext('POINT(-0.100277 51.513527)', 4326)::extensions.geography,
    'published',
    'openstreetmap',
    'https://www.openstreetmap.org/node/3239539398',
    'ODbL-1.0',
    'yes',
    null
  ),
  (
    'Circus',
    '27-29 Endell Street',
    'London',
    'WC2H 9BA',
    'GB',
    extensions.st_geomfromtext('POINT(-0.124613 51.514432)', 4326)::extensions.geography,
    'published',
    'openstreetmap',
    'https://www.openstreetmap.org/node/6464331588',
    'ODbL-1.0',
    'yes',
    null
  ),
  (
    'Pick & Cheese',
    null,
    null,
    null,
    'GB',
    extensions.st_geomfromtext('POINT(-0.126307 51.514067)', 4326)::extensions.geography,
    'published',
    'openstreetmap',
    'https://www.openstreetmap.org/node/6787562785',
    'ODbL-1.0',
    'yes',
    null
  );

comment on column public.restaurants.listing_source is
  'Origin of the public directory listing; this is distinct from sourced coeliac safety claims.';
comment on column public.restaurants.gluten_free_options is
  'Imported diet:gluten_free tag value when listing_source is OpenStreetMap; not a coeliac safety assessment.';

commit;
