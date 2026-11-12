import type { Database, RestaurantSummary } from "@glutenfree/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

const resultLimit = 50;
type Client = SupabaseClient<Database>;

function escapeLikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function searchPublishedRestaurants(
  client: Client,
  searchText: string,
  signal: AbortSignal
): Promise<RestaurantSummary[]> {
  const searchTerm = escapeLikeWildcards(searchText.trim());
  const selectFields = "id,name,address,city,region,country_code" as const;
  const createBaseQuery = () =>
    client
      .from("restaurants")
      .select(selectFields)
      .eq("status", "published")
      .order("name")
      .limit(resultLimit)
      .abortSignal(signal);

  if (!searchTerm) {
    const { data, error } = await createBaseQuery();
    if (error) {
      throw error;
    }

    return data;
  }

  const pattern = `%${searchTerm}%`;
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
