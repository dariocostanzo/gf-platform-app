import type { RestaurantSummary } from "@glutenfree/shared";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import RestaurantDetailScreen from "./src/features/discovery/RestaurantDetailScreen";
import { searchPublishedRestaurants } from "./src/features/discovery/restaurantDiscovery";
import { supabaseClient } from "./src/lib/supabase";

type DiscoveryState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "ready"; restaurants: RestaurantSummary[] }
  | { status: "error"; message: string };

export default function App() {
  const [searchText, setSearchText] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    null
  );
  const [discovery, setDiscovery] = useState<DiscoveryState>(
    supabaseClient ? { status: "loading" } : { status: "unconfigured" }
  );

  useEffect(() => {
    if (!supabaseClient) {
      setDiscovery({ status: "unconfigured" });
      return;
    }

    const client = supabaseClient;
    const controller = new AbortController();
    setDiscovery({ status: "loading" });
    const timeout = setTimeout(() => {
      searchPublishedRestaurants(client, searchText, controller.signal)
        .then((restaurants) => {
          if (!controller.signal.aborted) {
            setDiscovery({ status: "ready", restaurants });
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setDiscovery({
              status: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "An unexpected error occurred while loading restaurants."
            });
          }
        });
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [retryCount, searchText]);

  if (selectedRestaurantId) {
    return (
      <RestaurantDetailScreen
        onBack={() => setSelectedRestaurantId(null)}
        restaurantId={selectedRestaurantId}
      />
    );
  }

  const restaurants = discovery.status === "ready" ? discovery.restaurants : [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DISCOVER</Text>
        <Text style={styles.title}>Find a place to eat</Text>
        <Text style={styles.description}>
          Search published restaurant listings by name or city.
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
      </View>

      <View style={styles.results}>
        {discovery.status === "loading" && (
          <View style={styles.message}>
            <ActivityIndicator color="#176b52" />
            <Text style={styles.messageText}>Loading restaurants…</Text>
          </View>
        )}

        <FlatList
          contentContainerStyle={
            restaurants.length === 0 ? styles.emptyList : undefined
          }
          data={restaurants}
          keyExtractor={(restaurant) => restaurant.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            discovery.status === "ready" ? (
              <Text style={styles.messageText}>
                No published restaurants found. Try a different name or city.
              </Text>
            ) : discovery.status === "error" ? (
              <View style={styles.message}>
                <Text style={styles.errorTitle}>Couldn’t load restaurants</Text>
                <Text style={styles.messageText}>{discovery.message}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setRetryCount((count) => count + 1)}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : discovery.status === "unconfigured" ? (
              <View style={styles.message}>
                <Text style={styles.errorTitle}>Connect a Supabase project</Text>
                <Text style={styles.messageText}>
                  Add the project URL and publishable key to the mobile app’s
                  environment file to load restaurant listings.
                </Text>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <RestaurantCard
              onPress={() => setSelectedRestaurantId(item.id)}
              restaurant={item}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
        <Text style={styles.safetyNote}>
          Listings and community reports are not a guarantee of coeliac safety.
        </Text>
      </View>
    </View>
  );
}

function RestaurantCard({
  restaurant,
  onPress
}: {
  restaurant: RestaurantSummary;
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
      {restaurant.address && <Text style={styles.address}>{restaurant.address}</Text>}
      <Text style={styles.listingNote}>Published listing · Check safety details</Text>
    </Pressable>
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
    paddingTop: 40,
    paddingBottom: 20
  },
  eyebrow: {
    color: "#176b52",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2
  },
  title: {
    color: "#173b32",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8
  },
  description: {
    color: "#33443e",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8
  },
  searchInput: {
    backgroundColor: "#f1f4f2",
    borderColor: "#d8e0db",
    borderRadius: 12,
    borderWidth: 1,
    color: "#173b32",
    fontSize: 16,
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  results: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16
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
  message: {
    alignItems: "center",
    gap: 12,
    padding: 24
  },
  messageText: {
    color: "#52645d",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  errorTitle: {
    color: "#173b32",
    fontSize: 18,
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
    fontSize: 15,
    fontWeight: "700"
  },
  safetyNote: {
    color: "#52645d",
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    textAlign: "center"
  }
});
