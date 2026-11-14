import type { RestaurantSummary } from "@glutenfree/shared";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import NearbyMap from "./NearbyMap";
import type {
  Coordinates,
  DiscoveryRestaurant,
  MapRestaurantsResult,
  MapBounds,
  NearbyRestaurant,
  RestaurantSelection
} from "./restaurantDiscovery";
import {
  fetchNearbyRestaurants,
  fetchRestaurantsInBounds,
  mergeRestaurants,
  nearbyRadiusOptions,
  searchPublishedRestaurants
} from "./restaurantDiscovery";
import { supabaseClient } from "../../lib/supabase";

type LoadState<T> =
  | { status: "loading" }
  | {
      status: "ready";
      results: T;
      warning?: string | null;
      truncated?: boolean;
    }
  | { status: "error"; message: string };

const osmTruncatedMessage =
  "OpenStreetMap returned more places than can be shown for this area. Zoom in on the map to see more.";

type LocationState =
  | { status: "loading" }
  | { status: "ready"; coordinates: Coordinates }
  | { status: "denied" }
  | { status: "error"; message: string };

interface Props {
  onSelectRestaurant: (restaurant: RestaurantSelection) => void;
}

const radiusLabels = new Map<number, string>([
  [5000, "5 km"],
  [10000, "10 km"],
  [20000, "20 km"],
  [50000, "50 km"]
]);

// Nearby and map results are filtered on the device; saved search goes to Supabase.
function matchesSearchTerm(restaurant: RestaurantSummary, term: string) {
  return (
    !term ||
    `${restaurant.name} ${restaurant.city ?? ""}`
      .toLocaleLowerCase()
      .includes(term)
  );
}

async function getCurrentPositionWithTimeout() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Getting your location took too long. You can still search by restaurant or city."
              )
            ),
          15_000
        );
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export default function RestaurantDiscoveryScreen({
  onSelectRestaurant
}: Props) {
  const [searchText, setSearchText] = useState("");
  const [radiusMeters, setRadiusMeters] = useState<number>(5000);
  const [view, setView] = useState<"list" | "map">("list");
  const [retryCount, setRetryCount] = useState(0);
  const [locationRetryCount, setLocationRetryCount] = useState(0);
  const [location, setLocation] = useState<LocationState>({ status: "loading" });
  const [nearby, setNearby] = useState<LoadState<DiscoveryRestaurant[]>>({
    status: "loading"
  });
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [mapSearch, setMapSearch] = useState<LoadState<MapRestaurantsResult>>({
    status: "ready",
    results: { restaurants: [], tooBroad: false, truncated: false }
  });
  const [search, setSearch] = useState<LoadState<RestaurantSummary[]>>({
    status: "ready",
    results: []
  });

  useEffect(() => {
    let active = true;

    async function loadLocation() {
      setLocation({ status: "loading" });
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (!active) {
          return;
        }
        if (!permission.granted) {
          setLocation({ status: "denied" });
          return;
        }

        const position = await getCurrentPositionWithTimeout();
        if (active) {
          setLocation({
            status: "ready",
            coordinates: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
          });
        }
      } catch (error: unknown) {
        if (active) {
          setLocation({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred while getting your location."
          });
        }
      }
    }

    void loadLocation();
    return () => {
      active = false;
    };
  }, [locationRetryCount]);

  useEffect(() => {
    if (!supabaseClient) {
      setNearby({
        status: "error",
        message: "Supabase is not configured for this app."
      });
      return;
    }
    if (location.status !== "ready") {
      setNearby({ status: "ready", results: [] });
      return;
    }

    const controller = new AbortController();
    const client = supabaseClient;
    setNearby({ status: "loading" });
    fetchNearbyRestaurants(
      client,
      location.coordinates,
      radiusMeters,
      controller.signal
    )
      .then(({ restaurants, externalSourceError, truncated }) => {
        if (!controller.signal.aborted) {
          setNearby({
            status: "ready",
            results: restaurants,
            warning: externalSourceError,
            truncated
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setNearby({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred while loading nearby restaurants."
          });
        }
      });

    return () => controller.abort();
  }, [location, radiusMeters, retryCount]);

  const handleMapBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
  }, []);

  useEffect(() => {
    if (view !== "map" || !mapBounds || location.status !== "ready") {
      return;
    }

    const controller = new AbortController();
    setMapSearch({ status: "loading" });
    fetchRestaurantsInBounds(
      mapBounds,
      location.coordinates,
      controller.signal
    )
      .then((results) => {
        if (!controller.signal.aborted) {
          setMapSearch({ status: "ready", results });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setMapSearch({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred while loading restaurants on the map."
          });
        }
      });

    return () => controller.abort();
  }, [location, mapBounds, retryCount, view]);

  useEffect(() => {
    const term = searchText.trim();
    if (!term) {
      setSearch({ status: "ready", results: [] });
      return;
    }
    if (!supabaseClient) {
      setSearch({
        status: "error",
        message: "Supabase is not configured for this app."
      });
      return;
    }

    const client = supabaseClient;
    const controller = new AbortController();
    setSearch({ status: "loading" });
    const timeout = setTimeout(() => {
      searchPublishedRestaurants(client, term, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) {
            setSearch({ status: "ready", results });
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setSearch({
              status: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "An unexpected error occurred while searching restaurants."
            });
          }
        });
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [retryCount, searchText]);

  const nearbyRestaurants = nearby.status === "ready" ? nearby.results : [];
  const searchResults = search.status === "ready" ? search.results : [];
  const searchTerm = searchText.trim().toLocaleLowerCase();
  const mapRestaurants = useMemo(
    () =>
      mergeRestaurants(
        [
          ...nearbyRestaurants,
          ...(mapSearch.status === "ready"
            ? mapSearch.results.restaurants
            : [])
        ].filter((restaurant) => matchesSearchTerm(restaurant, searchTerm))
      ),
    [mapSearch, nearbyRestaurants, searchTerm]
  );
  const listRestaurants = useMemo(() => {
    if (!searchTerm) {
      return nearbyRestaurants;
    }

    // Nearby matches come first so their distance survives deduplication
    // against the search results, which carry no distance.
    return mergeRestaurants([
      ...nearbyRestaurants.filter((restaurant) =>
        matchesSearchTerm(restaurant, searchTerm)
      ),
      ...searchResults
    ]);
  }, [nearbyRestaurants, searchResults, searchTerm]);
  const mapSearchFailures = [
    mapSearch.status === "error" ? mapSearch.message : null,
    nearby.status === "error" ? nearby.message : null,
    nearby.status === "ready" ? nearby.warning ?? null : null
  ].filter((message): message is string => message !== null);
  const mapSearchError =
    mapSearchFailures.length > 0
      ? [...new Set(mapSearchFailures)].join(" ")
      : null;
  const mapSearchNotice =
    (mapSearch.status === "ready" && mapSearch.results.truncated) ||
    (nearby.status === "ready" && nearby.truncated)
      ? osmTruncatedMessage
      : null;
  const listLoading = searchTerm
    ? search.status === "loading"
    : nearby.status === "loading";
  const listError = searchTerm
    ? search.status === "error"
      ? search.message
      : null
    : nearby.status === "error"
      ? nearby.message
      : null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DISCOVER</Text>
        <Text style={styles.title}>Find a place to eat</Text>
        <Text style={styles.description}>
          Find restaurants nearby, search by name or city, or pan the map to
          explore OpenStreetMap listings worldwide.
        </Text>
        <TextInput
          accessibilityLabel="Search restaurants by name or city"
          autoCapitalize="none"
          onChangeText={setSearchText}
          placeholder="Restaurant or city"
          placeholderTextColor="#718078"
          returnKeyType="search"
          style={styles.searchInput}
          value={searchText}
        />
        <View style={styles.nearbyHeading}>
          <Text style={styles.nearbyLabel}>
            {view === "map"
              ? "Map area · Explore restaurants worldwide"
              : location.status === "ready"
              ? `Near you · Within ${radiusLabels.get(radiusMeters)}`
              : "Nearby restaurants"}
          </Text>
          <Text style={styles.privacyNote}>
            Nearby searches send your location coordinates to Supabase, and a
            search box around them to OpenStreetMap. Map searches send the
            visible map area to OpenStreetMap. This app does not save your
            location.
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.radiusOptions}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {nearbyRadiusOptions.map((radius) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: radius === radiusMeters }}
              key={radius}
              onPress={() => setRadiusMeters(radius)}
              style={[
                styles.radiusOption,
                radius === radiusMeters && styles.radiusOptionSelected
              ]}
            >
              <Text
                style={[
                  styles.radiusText,
                  radius === radiusMeters && styles.radiusTextSelected
                ]}
              >
                {radiusLabels.get(radius)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.viewSwitch}>
          <ViewModeButton
            active={view === "list"}
            label="List"
            onPress={() => setView("list")}
          />
          <ViewModeButton
            active={view === "map"}
            disabled={location.status !== "ready"}
            label="Map"
            onPress={() => setView("map")}
          />
        </View>
      </View>

      <View style={styles.results}>
        {view === "map" && location.status === "ready" ? (
          <NearbyMap
            center={location.coordinates}
            onBoundsChange={handleMapBoundsChange}
            onReadMore={onSelectRestaurant}
            radiusMeters={radiusMeters}
            restaurants={mapRestaurants}
            searchError={mapSearchError}
            searchNotice={mapSearchNotice}
            searchLoading={
              mapBounds !== null && mapSearch.status === "loading"
            }
            searchTooBroad={
              mapSearch.status === "ready" && mapSearch.results.tooBroad
            }
            onRetry={() => setRetryCount((count) => count + 1)}
          />
        ) : view === "map" ? (
          <LocationPrompt
            location={location}
            onRetry={() => setLocationRetryCount((count) => count + 1)}
          />
        ) : (
          <>
            {location.status === "loading" && !searchTerm && (
              <View style={styles.locationStatus}>
                <ActivityIndicator color="#176b52" />
                <Text style={styles.messageText}>
                  Finding restaurants near you…
                </Text>
              </View>
            )}
            {location.status === "denied" && !searchTerm && (
              <LocationPrompt
                location={location}
                onRetry={() => setLocationRetryCount((count) => count + 1)}
              />
            )}
            {location.status === "error" && !searchTerm && (
              <LocationPrompt
                location={location}
                onRetry={() => setLocationRetryCount((count) => count + 1)}
              />
            )}
            {listLoading ? (
              <View style={styles.locationStatus}>
                <ActivityIndicator color="#176b52" />
                <Text style={styles.messageText}>Loading restaurants…</Text>
              </View>
            ) : listError ? (
              <View style={styles.message}>
                <Text style={styles.errorTitle}>Couldn’t load restaurants</Text>
                <Text style={styles.messageText}>{listError}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setRetryCount((count) => count + 1)}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {nearby.status === "ready" && nearby.warning && (
                  <Text accessibilityRole="alert" style={styles.sourceWarning}>
                    Some restaurant sources could not be loaded. Available
                    listings are shown below. {nearby.warning}
                  </Text>
                )}
                {!searchTerm &&
                  nearby.status === "ready" &&
                  nearby.truncated && (
                    <Text style={styles.sourceWarning}>
                      {osmTruncatedMessage}
                    </Text>
                  )}
                <FlatList
                  contentContainerStyle={
                    listRestaurants.length === 0 ? styles.emptyList : undefined
                  }
                  data={listRestaurants}
                  keyExtractor={(restaurant) => restaurant.id}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    location.status === "loading" && !searchTerm ? undefined : (
                      <Text style={styles.messageText}>
                        {searchTerm
                          ? "No published restaurants found. Try a different name or city."
                          : "No restaurants found within this radius yet."}
                      </Text>
                    )
                  }
                  renderItem={({ item }) => (
                    <RestaurantCard
                      distanceMeters={
                        isNearbyRestaurant(item)
                          ? item.distance_meters
                          : undefined
                      }
                      onPress={() => onSelectRestaurant(item)}
                      restaurant={item}
                    />
                  )}
                  showsVerticalScrollIndicator={false}
                />
              </>
            )}
            {location.status !== "loading" && (
              <Text style={styles.safetyNote}>
                Listings and community reports are not a guarantee of coeliac
                safety.
              </Text>
            )}
            <OpenStreetMapAttribution />
          </>
        )}
      </View>
    </View>
  );
}

function LocationPrompt({
  location,
  onRetry
}: {
  location: LocationState;
  onRetry: () => void;
}) {
  const openSettings = () => {
    Linking.openSettings().catch((error: unknown) => {
      console.error("Could not open location settings.", error);
    });
  };

  return (
    <View style={styles.locationPrompt}>
      <Text style={styles.errorTitle}>
        {location.status === "denied"
          ? "Location access is off"
          : location.status === "error"
            ? "Couldn’t get your location"
            : "Getting your location…"}
      </Text>
      <Text style={styles.messageText}>
        {location.status === "denied"
          ? "Allow location while using the app to find restaurants near you. You can still search by restaurant or city."
          : location.status === "error"
            ? location.message
            : "Your location is sent to Supabase and OpenStreetMap to find nearby restaurants. This app does not save it."}
      </Text>
      {location.status === "denied" ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={openSettings}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Open location settings</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={styles.secondaryRetryButton}
          >
            <Text style={styles.secondaryRetryText}>Try location again</Text>
          </Pressable>
        </>
      ) : location.status === "error" ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : (
        <ActivityIndicator color="#176b52" />
      )}
    </View>
  );
}

function ViewModeButton({
  active,
  disabled = false,
  label,
  onPress
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.viewMode,
        active && styles.viewModeActive,
        disabled && styles.viewModeDisabled
      ]}
    >
      <Text
        style={[
          styles.viewModeText,
          active && styles.viewModeTextActive,
          disabled && styles.viewModeTextDisabled
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RestaurantCard({
  distanceMeters,
  restaurant,
  onPress
}: {
  distanceMeters?: number;
  restaurant: RestaurantSelection;
  onPress: () => void;
}) {
  const locality = [restaurant.city, restaurant.region, restaurant.country_code]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View details for ${restaurant.name}`}
      onPress={onPress}
      style={styles.card}
    >
      <Text style={styles.restaurantName}>{restaurant.name}</Text>
      {locality.length > 0 && <Text style={styles.locality}>{locality}</Text>}
      {restaurant.address && (
        <Text style={styles.address}>{restaurant.address}</Text>
      )}
      {distanceMeters !== undefined && (
        <Text style={styles.address}>{formatDistance(distanceMeters)} away</Text>
      )}
      {restaurant.listing_source === "openstreetmap" ? (
        <Text style={styles.listingNote}>
          OpenStreetMap listing ·{" "}
          {restaurant.osm_gluten_free_tag ?? restaurant.gluten_free_options
            ? `diet:gluten_free=${
                restaurant.osm_gluten_free_tag ??
                restaurant.gluten_free_options
              }`
            : "No gluten-free options tag recorded"}{" "}
          · Not safety-verified
        </Text>
      ) : (
        <Text style={styles.listingNote}>
          Published listing · Check safety details
        </Text>
      )}
    </Pressable>
  );
}

function isNearbyRestaurant(
  restaurant: RestaurantSummary | NearbyRestaurant
): restaurant is NearbyRestaurant {
  return (
    "distance_meters" in restaurant &&
    typeof restaurant.distance_meters === "number"
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters / 100) * 100} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

function OpenStreetMapAttribution() {
  return (
    <Text
      accessibilityRole="link"
      onPress={() =>
        Linking.openURL("https://www.openstreetmap.org/copyright").catch(
          (error: unknown) =>
            console.error("Could not open OpenStreetMap attribution.", error)
        )
      }
      style={styles.attribution}
    >
      © OpenStreetMap contributors · ODbL 1.0 · openstreetmap.org/copyright
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f5f7f5",
    flex: 1,
    paddingTop: 24
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 14
  },
  eyebrow: {
    color: "#176b52",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2
  },
  title: {
    color: "#173b32",
    fontSize: 27,
    fontWeight: "700",
    marginTop: 6
  },
  description: {
    color: "#33443e",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5
  },
  searchInput: {
    backgroundColor: "#f1f4f2",
    borderColor: "#d8e0db",
    borderRadius: 12,
    borderWidth: 1,
    color: "#173b32",
    fontSize: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  nearbyHeading: {
    marginTop: 12
  },
  nearbyLabel: {
    color: "#173b32",
    fontSize: 14,
    fontWeight: "700"
  },
  privacyNote: {
    color: "#52645d",
    fontSize: 11,
    marginTop: 3
  },
  radiusOptions: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 10
  },
  radiusOption: {
    borderColor: "#d8e0db",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  radiusOptionSelected: {
    backgroundColor: "#176b52",
    borderColor: "#176b52"
  },
  radiusText: {
    color: "#33443e",
    fontSize: 13,
    fontWeight: "600"
  },
  radiusTextSelected: {
    color: "#fff"
  },
  viewSwitch: {
    backgroundColor: "#f1f4f2",
    borderRadius: 10,
    flexDirection: "row",
    padding: 3
  },
  viewMode: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    paddingVertical: 8
  },
  viewModeActive: {
    backgroundColor: "#176b52"
  },
  viewModeDisabled: {
    opacity: 0.45
  },
  viewModeText: {
    color: "#33443e",
    fontSize: 14,
    fontWeight: "600"
  },
  viewModeTextActive: {
    color: "#fff"
  },
  viewModeTextDisabled: {
    color: "#718078"
  },
  results: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center"
  },
  card: {
    backgroundColor: "#fff",
    borderColor: "#e1e8e3",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16
  },
  restaurantName: {
    color: "#173b32",
    fontSize: 17,
    fontWeight: "700"
  },
  locality: {
    color: "#33443e",
    fontSize: 14,
    marginTop: 6
  },
  address: {
    color: "#52645d",
    fontSize: 13,
    marginTop: 4
  },
  listingNote: {
    color: "#52645d",
    fontSize: 12,
    marginTop: 12
  },
  sourceWarning: {
    backgroundColor: "#fff8e9",
    color: "#4b3b19",
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10
  },
  message: {
    alignItems: "center",
    gap: 12,
    padding: 24
  },
  locationPrompt: {
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    padding: 24
  },
  locationStatus: {
    alignItems: "center",
    gap: 10,
    padding: 16
  },
  messageText: {
    color: "#52645d",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center"
  },
  errorTitle: {
    color: "#173b32",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center"
  },
  retryButton: {
    backgroundColor: "#176b52",
    borderRadius: 10,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 11
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700"
  },
  secondaryRetryButton: {
    borderRadius: 10,
    marginTop: 2,
    paddingHorizontal: 18,
    paddingVertical: 9
  },
  secondaryRetryText: {
    color: "#176b52",
    fontSize: 14,
    fontWeight: "700"
  },
  safetyNote: {
    color: "#52645d",
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    textAlign: "center"
  },
  attribution: {
    color: "#52645d",
    fontSize: 10,
    paddingBottom: 6,
    textAlign: "center"
  }
});
