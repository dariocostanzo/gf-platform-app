import { useState } from "react";
import RestaurantDetailScreen from "./src/features/discovery/RestaurantDetailScreen";
import RestaurantDiscoveryScreen from "./src/features/discovery/RestaurantDiscoveryScreen";

export default function App() {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    null
  );

  if (selectedRestaurantId) {
    return (
      <RestaurantDetailScreen
        onBack={() => setSelectedRestaurantId(null)}
        restaurantId={selectedRestaurantId}
      />
    );
  }

  return (
    <RestaurantDiscoveryScreen
      onSelectRestaurant={setSelectedRestaurantId}
    />
  );
}
