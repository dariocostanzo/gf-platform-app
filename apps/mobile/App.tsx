import { useState } from "react";
import { StyleSheet, View } from "react-native";
import RestaurantDetailScreen from "./src/features/discovery/RestaurantDetailScreen";
import RestaurantDiscoveryScreen from "./src/features/discovery/RestaurantDiscoveryScreen";
import type { RestaurantSelection } from "./src/features/discovery/restaurantDiscovery";

const styles = StyleSheet.create({
  discovery: {
    flex: 1
  },
  hidden: {
    display: "none"
  }
});

export default function App() {
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<RestaurantSelection | null>(null);

  // Discovery stays mounted behind the detail view so search text, radius,
  // map view and the loaded results survive "Back to search".
  return (
    <>
      <View
        style={[styles.discovery, selectedRestaurant && styles.hidden]}
      >
        <RestaurantDiscoveryScreen onSelectRestaurant={setSelectedRestaurant} />
      </View>
      {selectedRestaurant && (
        <RestaurantDetailScreen
          onBack={() => setSelectedRestaurant(null)}
          initialRestaurant={selectedRestaurant}
        />
      )}
    </>
  );
}
