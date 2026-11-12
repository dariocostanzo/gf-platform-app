begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(14);

insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'member@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'other@example.test'),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'admin@example.test');

insert into public.user_roles (user_id, role, assigned_by)
values ('00000000-0000-4000-8000-000000000003', 'admin', null);

insert into public.restaurants (
  id,
  name,
  country_code,
  location,
  status,
  created_by
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Member pending restaurant',
    'GB',
    extensions.st_setsrid(extensions.st_makepoint(-0.1, 51.5), 4326)::extensions.geography,
    'pending',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Other pending restaurant',
    'GB',
    extensions.st_setsrid(extensions.st_makepoint(-0.12, 51.52), 4326)::extensions.geography,
    'pending',
    '00000000-0000-4000-8000-000000000002'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Published restaurant',
    'GB',
    extensions.st_setsrid(extensions.st_makepoint(-0.14, 51.54), 4326)::extensions.geography,
    'published',
    '00000000-0000-4000-8000-000000000001'
  );

insert into public.restaurant_safety_claims (
  restaurant_id,
  claim_type,
  claim_value,
  source,
  recorded_by,
  independently_verified_by,
  independently_verified_at
)
values
  (
    '10000000-0000-4000-8000-000000000003',
    'separate_fryer',
    true,
    'restaurant',
    '00000000-0000-4000-8000-000000000003',
    null,
    null
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'dedicated_preparation_area',
    true,
    'independently_verified',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    now()
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  'a member can read only their own profile'
);
select extensions.is(
  (select count(*) from public.user_roles),
  1::bigint,
  'a member can read only their own role assignment'
);
select extensions.is(
  (select count(*) from public.restaurants where status = 'pending'),
  1::bigint,
  'a submitter can read their own pending restaurant'
);
select extensions.is(
  (
    select count(*)
    from public.restaurants
    where id = '10000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'a member cannot read another submitters pending restaurant'
);
select extensions.is(
  (select count(*) from public.restaurants where status = 'published'),
  1::bigint,
  'a member can read published restaurants'
);
select extensions.throws_ok(
  $$insert into public.user_roles (user_id, role)
    values ('00000000-0000-4000-8000-000000000001', 'admin')$$,
  '42501',
  null,
  'a member cannot grant themselves an administrator role'
);
select extensions.throws_ok(
  $$insert into public.restaurant_safety_claims (
      restaurant_id, claim_type, claim_value, source, recorded_by
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'separate_fryer',
      true,
      'community',
      '00000000-0000-4000-8000-000000000001'
    )$$,
  '42501',
  null,
  'members cannot publish safety claims directly'
);
select extensions.lives_ok(
  $$insert into public.restaurants (name, country_code, location)
    values (
      'New member submission',
      'GB',
      extensions.st_setsrid(extensions.st_makepoint(-0.16, 51.56), 4326)::extensions.geography
    )$$,
  'a member can submit a restaurant for review'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select extensions.is(
  (select count(*) from public.restaurants),
  1::bigint,
  'anonymous visitors can read published restaurants only'
);
select extensions.is(
  (select count(*) from public.restaurant_safety_claims),
  1::bigint,
  'anonymous visitors can read safety claims for published restaurants only'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);

select extensions.is(
  (select count(*) from public.restaurants),
  4::bigint,
  'an administrator can read all restaurants'
);
select extensions.is(
  (
    select count(*)
    from public.user_roles
    where user_id in (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003'
    )
  ),
  3::bigint,
  'an administrator can read each test user role assignment'
);
select extensions.is(
  (select count(*) from public.restaurant_safety_claims),
  2::bigint,
  'an administrator can read claims for published and unpublished restaurants'
);
select extensions.is(
  (
    select count(*)
    from public.restaurant_safety_claims
    where source = 'independently_verified'
      and independently_verified_by is not null
      and independently_verified_at is not null
  ),
  1::bigint,
  'independent verification is explicitly attributed and timestamped'
);

select * from extensions.finish();
rollback;
