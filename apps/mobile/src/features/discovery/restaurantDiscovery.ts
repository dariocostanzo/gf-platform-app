import type { Database, RestaurantSummary } from "@glutenfree/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

const resultLimit = 50;
type Client = SupabaseClient<Database>;
export type NearbyRestaurant =
  Database["public"]["Functions"]["nearby_restaurants"]["Returns"][number];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const nearbyRadiusOptions = [5000, 10000, 20000, 50000] as const;

function escapeLikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function searchPublishedRestaurants(
  client: Client,
  searchText: string,
  signal: AbortSignal
): Promise<RestaurantSummary[]> {
  const searchTerm = searchText.trim();
  if (!searchTerm) {
    return [];
  }

  const escapedSearchTerm = escapeLikeWildcards(searchTerm);
  const selectFields =
    "id,name,address,city,region,country_code,listing_source,source_reference,source_license,gluten_free_options" as const;
  const createBaseQuery = () =>
    client
      .from("restaurants")
      .select(selectFields)
      .eq("status", "published")
      .order("name")
      .limit(resultLimit)
      .abortSignal(signal);

  const pattern = `%${escapedSearchTerm}%`;
  const [nameResult, cityResult] = await Promise.all([
    createBaseQuery().ilike("name", pattern),
    createBaseQuery().ilike("city", pattern)
  ]);

  if (nameResult.error) {
    throw nameResult.error;
  }
  if (cityResult.error) {
    throw cityResult.error;
  }

  const uniqueRestaurants = new Map<string, RestaurantSummary>();
  for (const restaurant of [...nameResult.data, ...cityResult.data]) {
    uniqueRestaurants.set(restaurant.id, restaurant);
  }

  return [...uniqueRestaurants.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, resultLimit);
}

export async function fetchNearbyRestaurants(
  client: Client,
  coordinates: Coordinates,
  radiusMeters: number,
  signal: AbortSignal,
  searchText = ""
): Promise<NearbyRestaurant[]> {
  const { data, error } = await client
    .rpc("nearby_restaurants", {
      p_latitude: coordinates.latitude,
      p_longitude: coordinates.longitude,
      p_radius_meters: radiusMeters,
      p_search_text: searchText.trim() || null
    })
    .abortSignal(signal);

  if (error) {
    throw error;
  }

  return data;
}
