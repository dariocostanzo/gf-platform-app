begin;

create extension if not exists postgis with schema extensions;

create type public.app_role as enum ('member', 'admin');
create type public.restaurant_status as enum (
  'pending',
  'published',
  'rejected',
  'archived'
);
create type public.safety_claim_type as enum (
  'dedicated_gluten_free_kitchen',
  'dedicated_preparation_area',
  'separate_fryer',
  'cross_contamination_procedures',
  'staff_knowledge',
  'gluten_free_menu_available'
);
create type public.safety_information_source as enum (
  'restaurant',
  'community',
  'independently_verified'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (
    display_name is null or char_length(display_name) <= 80
  ),
  avatar_url text check (
    avatar_url is null or char_length(avatar_url) <= 2048
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id) on delete set null,
  primary key (user_id, role)
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  address text check (address is null or char_length(address) <= 300),
  city text check (city is null or char_length(city) <= 120),
  region text check (region is null or char_length(region) <= 120),
  postal_code text check (postal_code is null or char_length(postal_code) <= 32),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  phone text check (phone is null or char_length(phone) <= 40),
  website text check (website is null or char_length(website) <= 2048),
  location extensions.geography(Point, 4326) not null,
  status public.restaurant_status not null default 'pending',
  created_by uuid not null default auth.uid()
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurant_safety_claims (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  claim_type public.safety_claim_type not null,
  claim_value boolean not null,
  source public.safety_information_source not null,
  details text check (details is null or char_length(details) <= 2000),
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  independently_verified_by uuid references public.profiles (id) on delete restrict,
  independently_verified_at timestamptz,
  constraint independently_verified_claim_has_verifier check (
    (
      source = 'independently_verified'
      and independently_verified_by is not null
      and independently_verified_at is not null
    )
    or (
      source <> 'independently_verified'
      and independently_verified_by is null
      and independently_verified_at is null
    )
  )
);

create index restaurants_location_idx
  on public.restaurants using gist (location);
create index restaurants_status_city_idx
  on public.restaurants (status, country_code, city);
create index restaurants_created_by_idx
  on public.restaurants (created_by);
create index restaurant_safety_claims_restaurant_idx
  on public.restaurant_safety_claims (restaurant_id, recorded_at desc);

create function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(pg_catalog.left(new.raw_user_meta_data ->> 'display_name', 80), '')
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'member');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_safety_claims enable row level security;

create policy "Users can read their own profile and admins can read all profiles"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.has_role(auth.uid(), 'admin')));

create policy "Users can update their own profile and admins can update profiles"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.has_role(auth.uid(), 'admin')))
  with check (id = (select auth.uid()) or (select public.has_role(auth.uid(), 'admin')));

create policy "Users can read their own roles and admins can read all roles"
  on public.user_roles for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.has_role(auth.uid(), 'admin'))
  );

create policy "Published restaurants are public and submitters can read their submissions"
  on public.restaurants for select to anon, authenticated
  using (
    status = 'published'
    or created_by = (select auth.uid())
    or (select public.has_role(auth.uid(), 'admin'))
  );

create policy "Authenticated users can submit restaurants for review"
  on public.restaurants for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and status = 'pending'
  );

create policy "Admins can manage restaurants"
  on public.restaurants for all to authenticated
  using ((select public.has_role(auth.uid(), 'admin')))
  with check ((select public.has_role(auth.uid(), 'admin')));

create policy "Published restaurant safety claims are public"
  on public.restaurant_safety_claims for select to anon, authenticated
  using (
    exists (
      select 1
      from public.restaurants
      where restaurants.id = restaurant_safety_claims.restaurant_id
        and restaurants.status = 'published'
    )
    or (select public.has_role(auth.uid(), 'admin'))
  );

create policy "Admins can manage restaurant safety claims"
  on public.restaurant_safety_claims for all to authenticated
  using ((select public.has_role(auth.uid(), 'admin')))
  with check ((select public.has_role(auth.uid(), 'admin')));

revoke all on public.profiles, public.user_roles, public.restaurants,
  public.restaurant_safety_claims from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.restaurants to anon, authenticated;
grant insert (name, address, city, region, postal_code, country_code, phone, website, location)
  on public.restaurants to authenticated;
grant update, delete on public.restaurants to authenticated;
grant select on public.restaurant_safety_claims to anon, authenticated;
grant insert, update, delete on public.restaurant_safety_claims to authenticated;

comment on table public.user_roles is
  'Role assignments are not writable by client roles; grant elevated roles only through trusted server-side administration.';
comment on table public.restaurant_safety_claims is
  'Sourced claims describe information, not a guarantee of coeliac safety; independent claims require a verifier and timestamp.';

commit;
