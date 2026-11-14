import type { Database, RestaurantSummary } from "@glutenfree/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

const resultLimit = 50;
const osmResultLimit = 500;
const osmCacheTtlMs = 10 * 60 * 1000;
const requestTimeoutMs = 8_000;
const osmEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
] as const;
type Client = SupabaseClient<Database>;
export type NearbyRestaurant =
  Database["public"]["Functions"]["nearby_restaurants"]["Returns"][number];

export type DiscoveryRestaurant = NearbyRestaurant & {
  phone: string | null;
  website: string | null;
  osm_gluten_free_tag: string | null;
};

export type RestaurantSelection = RestaurantSummary & {
  phone?: string | null;
  website?: string | null;
  osm_gluten_free_tag?: string | null;
};

export interface MapRestaurantsResult {
  restaurants: DiscoveryRestaurant[];
  tooBroad: boolean;
  truncated: boolean;
}

export interface NearbyRestaurantsResult {
  restaurants: DiscoveryRestaurant[];
  externalSourceError: string | null;
  truncated: boolean;
}

interface OpenStreetMapResult {
  restaurants: DiscoveryRestaurant[];
  truncated: boolean;
}

export type MapBounds = readonly [
  west: number,
  south: number,
  east: number,
  north: number
];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const nearbyRadiusOptions = [5000, 10000, 20000, 50000] as const;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
  remark?: string;
}

const osmCache = new Map<
  string,
  { expiresAt: number; elements: OverpassElement[] }
>();

function createTimeoutSignal(
  parentSignal: AbortSignal,
  timeoutMs: number,
  timeoutMessage: string
): {
  signal: AbortSignal;
  didTimeout: () => boolean;
  dispose: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(parentSignal.reason);
  if (parentSignal.aborted) {
    abortFromParent();
  } else {
    parentSignal.addEventListener("abort", abortFromParent, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(timeoutMessage));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      parentSignal.removeEventListener("abort", abortFromParent);
    }
  };
}

function escapeLikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function isLiveOpenStreetMapRestaurant(restaurant: {
  id: string;
}): boolean {
  return restaurant.id.startsWith("osm:");
}

/**
 * Collapses saved listings and live OpenStreetMap results that describe the
 * same place. Saved rows win because they carry a stable id, safety claims and
 * detail data; the first occurrence keeps its list position.
 */
export function mergeRestaurants<T extends RestaurantSummary>(
  restaurants: Iterable<T>
): T[] {
  const merged = new Map<string, T>();
  for (const restaurant of restaurants) {
    const key = restaurant.source_reference ?? restaurant.id;
    const existing = merged.get(key);
    if (
      !existing ||
      (isLiveOpenStreetMapRestaurant(existing) &&
        !isLiveOpenStreetMapRestaurant(restaurant))
    ) {
      merged.set(key, restaurant);
    }
  }
  return [...merged.values()];
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
  const timedSignal = createTimeoutSignal(
    signal,
    requestTimeoutMs,
    "Restaurant search timed out. Check your connection and try again."
  );
  let nameResult: Awaited<ReturnType<typeof createBaseQuery>>;
  let cityResult: Awaited<ReturnType<typeof createBaseQuery>>;
  try {
    [nameResult, cityResult] = await Promise.all([
      createBaseQuery()
        .abortSignal(timedSignal.signal)
        .ilike("name", pattern),
      createBaseQuery()
        .abortSignal(timedSignal.signal)
        .ilike("city", pattern)
    ]);
  } catch (error: unknown) {
    if (timedSignal.didTimeout()) {
      throw new Error(
        "Restaurant search timed out. Check your connection and try again."
      );
    }
    throw error;
  } finally {
    timedSignal.dispose();
  }

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
): Promise<NearbyRestaurantsResult> {
  const bounds = boundsAround(coordinates, radiusMeters);
  const databaseRequest = async () => {
    const timedSignal = createTimeoutSignal(
      signal,
      requestTimeoutMs,
      "Nearby restaurant search timed out."
    );
    try {
      const { data, error } = await client
        .rpc("nearby_restaurants", {
          p_latitude: coordinates.latitude,
          p_longitude: coordinates.longitude,
          p_radius_meters: radiusMeters,
          p_search_text: searchText.trim() || null
        })
        .abortSignal(timedSignal.signal);
      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error("Nearby restaurant search returned no result data.");
      }
      return data;
    } catch (error: unknown) {
      if (timedSignal.didTimeout()) {
        throw new Error(
          "Nearby restaurant search timed out. Check your connection and try again."
        );
      }
      throw error;
    } finally {
      timedSignal.dispose();
    }
  };
  const osmRequest = fetchOpenStreetMapRestaurants(
    bounds,
    coordinates,
    signal
  );
  // Both requests are allSettled, so an OpenStreetMap failure still leaves saved listings visible.
  const [databaseResult, osmResult] = await Promise.allSettled([
    databaseRequest(),
    osmRequest
  ]);
  if (signal.aborted) {
    throw new Error("Nearby restaurant search was cancelled.");
  }

  const databaseRestaurants =
    databaseResult.status === "fulfilled" ? databaseResult.value : [];
  const osmRestaurants =
    osmResult.status === "fulfilled" ? osmResult.value.restaurants : [];
  const sourceErrors = [
    databaseResult.status === "rejected"
      ? `Saved listings unavailable: ${describeError(databaseResult.reason)}`
      : null,
    osmResult.status === "rejected"
      ? `OpenStreetMap unavailable: ${describeError(osmResult.reason)}`
      : null
  ].filter((message): message is string => message !== null);
  const externalSourceError =
    sourceErrors.length > 0 ? sourceErrors.join(" ") : null;
  const dbRestaurants: DiscoveryRestaurant[] = databaseRestaurants.map((restaurant) => ({
    ...restaurant,
    phone: null,
    website: null,
    osm_gluten_free_tag: null
  }));
  const withinRadius = [...dbRestaurants, ...osmRestaurants].filter(
    (restaurant) => restaurant.distance_meters <= radiusMeters
  );

  return {
    restaurants: mergeRestaurants(withinRadius).sort(
      (left, right) => left.distance_meters - right.distance_meters
    ),
    externalSourceError,
    truncated: osmResult.status === "fulfilled" && osmResult.value.truncated
  };
}

function describeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

export async function fetchRestaurantsInBounds(
  bounds: MapBounds,
  center: Coordinates,
  signal: AbortSignal
): Promise<MapRestaurantsResult> {
  validateBounds(bounds);
  if (isBoundsTooBroad(bounds)) {
    return { restaurants: [], tooBroad: true, truncated: false };
  }
  const osm = await fetchOpenStreetMapRestaurants(bounds, center, signal);
  return {
    restaurants: osm.restaurants,
    tooBroad: false,
    truncated: osm.truncated
  };
}

function boundsAround(
  center: Coordinates,
  radiusMeters: number
): MapBounds {
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeDelta =
    radiusMeters /
    (111_320 * Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01));

  return [
    Math.max(-180, center.longitude - longitudeDelta),
    Math.max(-90, center.latitude - latitudeDelta),
    Math.min(180, center.longitude + longitudeDelta),
    Math.min(90, center.latitude + latitudeDelta)
  ];
}

async function fetchOpenStreetMapRestaurants(
  bounds: MapBounds,
  center: Coordinates,
  signal: AbortSignal
): Promise<OpenStreetMapResult> {
  validateBounds(bounds);

  const [west, south, east, north] = bounds;
  if (isBoundsTooBroad(bounds)) {
    return { restaurants: [], truncated: false };
  }

  const boxes =
    east >= west
      ? [[west, south, east, north] as MapBounds]
      : ([
          [west, south, 180, north],
          [-180, south, east, north]
        ] as const);
  const batches = await Promise.all(
    boxes.map((box) => fetchOverpassElements(box, signal))
  );
  // Overpass stops at osmResultLimit elements per query without saying so, so a
  // full batch means some places in that box were not returned.
  const truncated = batches.some(
    (elements) => elements.length >= osmResultLimit
  );
  const uniqueRestaurants = new Map<string, DiscoveryRestaurant>();

  for (const element of batches.flat()) {
    const restaurant = toRestaurant(element, center);
    if (restaurant) {
      uniqueRestaurants.set(restaurant.id, restaurant);
    }
  }

  return {
    restaurants: [...uniqueRestaurants.values()].sort(
      (left, right) => left.distance_meters - right.distance_meters
    ),
    truncated
  };
}

function isBoundsTooBroad([west, south, east, north]: MapBounds): boolean {
  const width = east >= west ? east - west : 360 - west + east;
  const height = north - south;
  return width > 12 || height > 8 || width * height > 24;
}

function validateBounds([west, south, east, north]: MapBounds): void {
  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north) ||
    west < -180 ||
    west > 180 ||
    east < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    south >= north
  ) {
    throw new Error("The map returned invalid search bounds.");
  }
}

async function fetchOverpassElements(
  bounds: MapBounds,
  signal: AbortSignal
): Promise<OverpassElement[]> {
  const cacheKey = bounds.map((value) => value.toFixed(3)).join(",");
  const cached = osmCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.elements;
  }
  if (cached) {
    osmCache.delete(cacheKey);
  }

  const [west, south, east, north] = bounds;
  const query = [
    "[out:json][timeout:25][maxsize:16777216];",
    "(",
    `nwr["amenity"~"^(restaurant|cafe|fast_food|pub|food_court|bar|ice_cream)$"](${south},${west},${north},${east});`,
    ");",
    `out center tags ${osmResultLimit};`
  ].join("");
  const failures: string[] = [];

  for (const endpoint of osmEndpoints) {
    const timedSignal = createTimeoutSignal(
      signal,
      requestTimeoutMs,
      "OpenStreetMap search timed out."
    );
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "*/*",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "GlutenFreeMobile/1.0"
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: timedSignal.signal
      });
      if (!response.ok) {
        failures.push(`${endpoint} returned HTTP ${response.status}`);
        continue;
      }

      const result = (await response.json()) as OverpassResponse;
      if (!Array.isArray(result.elements)) {
        throw new Error("OpenStreetMap returned an invalid response.");
      }
      // Overpass reports timeouts and runtime errors with HTTP 200 and a partial
      // or empty result. Treat those as failures so they are neither cached nor shown as "no places".
      if (result.remark && /error/i.test(result.remark)) {
        throw new Error(`${endpoint} reported: ${result.remark}`);
      }

      osmCache.set(cacheKey, {
        expiresAt: Date.now() + osmCacheTtlMs,
        elements: result.elements
      });
      while (osmCache.size > 12) {
        const oldestKey = osmCache.keys().next().value;
        if (oldestKey === undefined) {
          break;
        }
        osmCache.delete(oldestKey);
      }

      return result.elements;
    } catch (error: unknown) {
      if (signal.aborted) {
        throw error;
      }
      failures.push(
        timedSignal.didTimeout()
          ? `${endpoint} timed out`
          : error instanceof Error
            ? error.message
            : "Unknown OpenStreetMap error"
      );
    } finally {
      timedSignal.dispose();
    }
  }

  throw new Error(
    `Could not load OpenStreetMap restaurants. ${failures.join("; ")}`
  );
}

function toRestaurant(
  element: OverpassElement,
  center: Coordinates
): DiscoveryRestaurant | null {
  const tags = element.tags;
  if (!tags) {
    return null;
  }
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const name = tags.name?.trim();
  if (
    !name ||
    latitude === undefined ||
    longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const glutenFreeTag = tags["diet:gluten_free"] ?? null;
  const glutenFreeOptions =
    glutenFreeTag === "yes" ||
    glutenFreeTag === "only" ||
    glutenFreeTag === "limited"
      ? glutenFreeTag
      : null;
  const houseNumber = tags["addr:housenumber"];
  const street = tags["addr:street"];
  const address = [houseNumber, street].filter(Boolean).join(" ") || null;
  const sourceReference = `https://www.openstreetmap.org/${element.type}/${element.id}`;

  return {
    id: `osm:${element.type}:${element.id}`,
    name,
    address,
    city:
      tags["addr:city"] ??
      tags["addr:town"] ??
      tags["addr:village"] ??
      tags["addr:suburb"] ??
      null,
    region: tags["addr:state"] ?? tags["addr:county"] ?? null,
    country_code: tags["addr:country"] ?? "",
    listing_source: "openstreetmap",
    source_reference: sourceReference,
    source_license: "ODbL-1.0",
    gluten_free_options: glutenFreeOptions,
    osm_gluten_free_tag: glutenFreeTag,
    latitude,
    longitude,
    distance_meters: distanceBetween(center, { latitude, longitude }),
    phone: tags.phone ?? tags["contact:phone"] ?? null,
    website: tags.website ?? tags["contact:website"] ?? null
  };
}

function distanceBetween(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
