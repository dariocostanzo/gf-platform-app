begin;

create function public.nearby_restaurants(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters integer,
  p_search_text text default null
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  region text,
  country_code text,
  listing_source text,
  source_reference text,
  source_license text,
  gluten_free_options text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  search_term text := nullif(pg_catalog.btrim(p_search_text), '');
  search_pattern text;
  search_escape text := E'\\';
begin
  if p_latitude is null or p_latitude < -90 or p_latitude > 90 then
    raise exception using
      errcode = '22023',
      message = 'Latitude must be between -90 and 90 degrees.';
  end if;

  if p_longitude is null or p_longitude < -180 or p_longitude > 180 then
    raise exception using
      errcode = '22023',
      message = 'Longitude must be between -180 and 180 degrees.';
  end if;

  if p_radius_meters is null or p_radius_meters < 1000 or p_radius_meters > 50000 then
    raise exception using
      errcode = '22023',
      message = 'Radius must be between 1000 and 50000 meters.';
  end if;

  if search_term is not null then
    search_term := pg_catalog.replace(search_term, search_escape, search_escape || search_escape);
    search_term := pg_catalog.replace(search_term, '%', search_escape || '%');
    search_term := pg_catalog.replace(search_term, '_', search_escape || '_');
    search_pattern := '%' || search_term || '%';
  end if;

  return query
  select
    restaurant.id,
    restaurant.name,
    restaurant.address,
    restaurant.city,
    restaurant.region,
    restaurant.country_code,
    restaurant.listing_source,
    restaurant.source_reference,
    restaurant.source_license,
    restaurant.gluten_free_options,
    extensions.st_y(restaurant.location::extensions.geometry)::double precision,
    extensions.st_x(restaurant.location::extensions.geometry)::double precision,
    extensions.st_distance(
      restaurant.location,
      extensions.st_setsrid(
        extensions.st_makepoint(p_longitude, p_latitude),
        4326
      )::extensions.geography
    )
  from public.restaurants as restaurant
  where restaurant.status = 'published'
    and extensions.st_dwithin(
      restaurant.location,
      extensions.st_setsrid(
        extensions.st_makepoint(p_longitude, p_latitude),
        4326
      )::extensions.geography,
      p_radius_meters
    )
    and (
      search_pattern is null
      or restaurant.name ilike search_pattern escape E'\\'
      or coalesce(restaurant.city, '') ilike search_pattern escape E'\\'
    )
  order by extensions.st_distance(
    restaurant.location,
    extensions.st_setsrid(
      extensions.st_makepoint(p_longitude, p_latitude),
      4326
    )::extensions.geography
  )
  limit 200;
end;
$$;

revoke all on function public.nearby_restaurants(
  double precision,
  double precision,
  integer,
  text
) from public, anon, authenticated;

grant execute on function public.nearby_restaurants(
  double precision,
  double precision,
  integer,
  text
) to anon, authenticated;

comment on function public.nearby_restaurants(
  double precision,
  double precision,
  integer,
  text
) is
  'Returns published restaurants within a validated radius. Respects caller RLS and does not infer coeliac safety.';

commit;
