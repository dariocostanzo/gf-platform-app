import type {
  Database,
  RestaurantSafetyClaim,
  RestaurantSummary
} from "@glutenfree/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

export interface RestaurantDetails {
  restaurant: RestaurantSummary & {
    phone: string | null;
    website: string | null;
  };
  safetyClaims: RestaurantSafetyClaim[];
}

export async function fetchPublishedRestaurantDetails(
  client: Client,
  restaurantId: string,
  signal: AbortSignal
): Promise<RestaurantDetails | null> {
  const { data: restaurant, error: restaurantError } = await client
    .from("restaurants")
    .select("id,name,address,city,region,country_code,phone,website")
    .eq("id", restaurantId)
    .eq("status", "published")
    .abortSignal(signal)
    .maybeSingle();

  if (restaurantError) {
    throw restaurantError;
  }
  if (!restaurant) {
    return null;
  }

  const { data: safetyClaims, error: safetyError } = await client
    .from("restaurant_safety_claims")
    .select(
      "id,claim_type,claim_value,source,details,recorded_at,independently_verified_at"
    )
    .eq("restaurant_id", restaurantId)
    .order("recorded_at", { ascending: false })
    .abortSignal(signal);

  if (safetyError) {
    throw safetyError;
  }

  return { restaurant, safetyClaims };
}
