import {
  Camera,
  Map as MapLibreMap,
  Marker
} from "@maplibre/maplibre-react-native";
import type {
  CameraRef,
  MapRef,
  ViewStateChangeEvent
} from "@maplibre/maplibre-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { NativeSyntheticEvent } from "react-native";
import type {
  Coordinates,
  DiscoveryRestaurant,
  MapBounds,
  RestaurantSelection
} from "./restaurantDiscovery";

const mapStyleUrl = "https://tiles.openfreemap.org/styles/liberty";

interface Props {
  center: Coordinates;
  radiusMeters: number;
  restaurants: DiscoveryRestaurant[];
  onBoundsChange: (bounds: MapBounds) => void;
  onReadMore: (restaurant: RestaurantSelection) => void;
  searchError: string | null;
  searchNotice: string | null;
  searchLoading: boolean;
  searchTooBroad: boolean;
  onRetry: () => void;
}

export default function NearbyMap({
  center,
  radiusMeters,
  restaurants,
  onBoundsChange,
  onReadMore,
  searchError,
  searchNotice,
  searchLoading,
  searchTooBroad,
  onRetry
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const boundsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousRadius = useRef(radiusMeters);
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<DiscoveryRestaurant | null>(null);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (boundsTimeout.current) {
        clearTimeout(boundsTimeout.current);
      }
    },
    []
  );

  useEffect(() => {
    if (previousRadius.current === radiusMeters) {
      return;
    }
    previousRadius.current = radiusMeters;
    const latitudeDelta = radiusMeters / 111_320;
    const longitudeDelta =
      radiusMeters /
      (111_320 *
        Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01));
    cameraRef.current?.fitBounds(
      [
        center.longitude - longitudeDelta,
        center.latitude - latitudeDelta,
        center.longitude + longitudeDelta,
        center.latitude + latitudeDelta
      ],
      {
        padding: { top: 48, right: 48, bottom: 48, left: 48 },
        duration: 350
      }
    );
  }, [center, radiusMeters]);

  const reportCurrentBounds = () => {
    mapRef.current
      ?.getViewState()
      .then(({ bounds }) => onBoundsChange(bounds))
      .catch((error: unknown) => {
        console.error("Could not read the current map bounds.", error);
      });
  };

  const handleRegionDidChange = (
    event: NativeSyntheticEvent<ViewStateChangeEvent>
  ) => {
    if (boundsTimeout.current) {
      clearTimeout(boundsTimeout.current);
    }
    const bounds = event.nativeEvent.bounds;
    boundsTimeout.current = setTimeout(() => onBoundsChange(bounds), 450);
  };

  const openDirections = (url: string) => {
    setDirectionsError(null);
    Linking.openURL(url)
      .then(() => setDirectionsOpen(false))
      .catch((error: unknown) => {
        console.error("Could not open the selected maps app.", error);
        setDirectionsError(
          "Couldn’t open that maps app. Check that a browser or maps app is available."
        );
      });
  };

  const selectedLocation = selectedRestaurant
    ? `${selectedRestaurant.latitude},${selectedRestaurant.longitude}`
    : null;
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeDelta =
    radiusMeters /
    (111_320 * Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01));

  return (
    <View style={styles.container}>
      <MapLibreMap
        attribution
        compass
        logo
        mapStyle={mapStyleUrl}
        onDidFinishLoadingMap={reportCurrentBounds}
        onRegionDidChange={handleRegionDidChange}
        ref={mapRef}
        scaleBar
        style={StyleSheet.absoluteFill}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            bounds: [
              center.longitude - longitudeDelta,
              center.latitude - latitudeDelta,
              center.longitude + longitudeDelta,
              center.latitude + latitudeDelta
            ],
            padding: { top: 48, right: 48, bottom: 48, left: 48 }
          }}
        />
        <Marker
          anchor="center"
          id="user-location"
          lngLat={[center.longitude, center.latitude]}
        >
          <View style={styles.userMarker} />
        </Marker>
        {restaurants.map((restaurant) => (
          <Marker
            anchor="bottom"
            id={restaurant.id}
            key={restaurant.id}
            lngLat={[restaurant.longitude, restaurant.latitude]}
            onPress={() => setSelectedRestaurant(restaurant)}
          >
            <View style={styles.pin}>
              <View style={styles.pinCircle}>
                <View style={styles.pinCenter} />
              </View>
              <View style={styles.pinTail} />
            </View>
          </Marker>
        ))}
        {selectedRestaurant && (
          <Marker
            anchor="bottom"
            id={`preview-${selectedRestaurant.id}`}
            lngLat={[
              selectedRestaurant.longitude,
              selectedRestaurant.latitude
            ]}
          >
            <View style={styles.preview}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close restaurant preview"
                onPress={() => setSelectedRestaurant(null)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
              <Text style={styles.name}>{selectedRestaurant.name}</Text>
              <Text style={styles.address}>
                {[selectedRestaurant.address, selectedRestaurant.city]
                  .filter(Boolean)
                  .join(", ") || "Address not available"}
              </Text>
              <Text style={styles.address}>
                {formatDistance(selectedRestaurant.distance_meters)} away
              </Text>
              {selectedRestaurant.listing_source === "openstreetmap" && (
                <Text style={styles.provenance}>
                  {selectedRestaurant.osm_gluten_free_tag ??
                  selectedRestaurant.gluten_free_options
                    ? `OSM diet:gluten_free=${
                        selectedRestaurant.osm_gluten_free_tag ??
                        selectedRestaurant.gluten_free_options
                      }. Not safety-verified.`
                    : "No gluten-free options tag is recorded in OSM. Not safety-verified."}
                </Text>
              )}
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onReadMore(selectedRestaurant)}
                  style={styles.primaryAction}
                >
                  <Text style={styles.primaryActionText}>Read more</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setDirectionsError(null);
                    setDirectionsOpen(true);
                  }}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>Get directions</Text>
                </Pressable>
              </View>
            </View>
          </Marker>
        )}
      </MapLibreMap>

      {(searchLoading || searchError || searchTooBroad || searchNotice) && (
        <View style={styles.searchStatus}>
          {searchLoading ? (
            <Text style={styles.searchStatusText}>
              Searching this map area…
            </Text>
          ) : searchTooBroad ? (
            <Text style={styles.searchStatusText}>
              Zoom in to search this area for restaurants.
            </Text>
          ) : searchError ? (
            <>
              <Text style={styles.searchStatusText}>{searchError}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onRetry}
                style={styles.searchRetry}
              >
                <Text style={styles.searchRetryText}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.searchStatusText}>{searchNotice}</Text>
          )}
        </View>
      )}

      <View style={styles.mapAttribution}>
        <Text style={styles.mapAttributionText}>
          © OpenStreetMap contributors · © OpenFreeMap
        </Text>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setDirectionsOpen(false)}
        transparent
        visible={directionsOpen}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.directionsSheet}>
            <Text style={styles.directionsTitle}>Choose a maps app</Text>
            <Text style={styles.directionsSubtitle}>
              Directions to {selectedRestaurant?.name}
            </Text>
            <DirectionOption
              label="Google Maps"
              onPress={() =>
                selectedLocation &&
                openDirections(
                  `https://www.google.com/maps/dir/?api=1&destination=${selectedLocation}`
                )
              }
            />
            <DirectionOption
              label="Apple Maps"
              onPress={() =>
                selectedLocation &&
                openDirections(`https://maps.apple.com/?daddr=${selectedLocation}`)
              }
            />
            <DirectionOption
              label="OpenStreetMap"
              onPress={() =>
                selectedRestaurant &&
                openDirections(
                  `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${center.latitude},${center.longitude};${selectedRestaurant.latitude},${selectedRestaurant.longitude}`
                )
              }
            />
            {Platform.OS === "android" && (
              <DirectionOption
                label="Other installed map apps"
                onPress={() =>
                  selectedLocation &&
                  openDirections(
                    `geo:${selectedLocation}?q=${encodeURIComponent(
                      `${selectedLocation}(${selectedRestaurant?.name ?? "Restaurant"})`
                    )}`
                  )
                }
              />
            )}
            {directionsError && (
              <Text accessibilityRole="alert" style={styles.error}>
                {directionsError}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => setDirectionsOpen(false)}
              style={styles.cancelAction}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters / 100) * 100} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

function DirectionOption({
  label,
  onPress
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.directionOption}
    >
      <Text style={styles.directionOptionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
    overflow: "hidden",
    position: "relative"
  },
  userMarker: {
    backgroundColor: "#2675e8",
    borderColor: "#fff",
    borderRadius: 12,
    borderWidth: 3,
    height: 22,
    width: 22
  },
  pin: {
    alignItems: "center",
    height: 38,
    justifyContent: "flex-start",
    width: 32
  },
  pinCircle: {
    alignItems: "center",
    backgroundColor: "#d62828",
    borderColor: "#fff",
    borderRadius: 15,
    borderWidth: 2,
    height: 30,
    justifyContent: "center",
    width: 30,
    zIndex: 1
  },
  pinCenter: {
    backgroundColor: "#fff",
    borderRadius: 4,
    height: 8,
    width: 8
  },
  pinTail: {
    backgroundColor: "#d62828",
    height: 12,
    marginTop: -8,
    transform: [{ rotate: "45deg" }],
    width: 12
  },
  mapAttribution: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 4,
    bottom: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: "absolute"
  },
  mapAttributionText: {
    color: "#33443e",
    fontSize: 10
  },
  searchStatus: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: "#e1e8e3",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: "absolute",
    right: 12,
    top: 10
  },
  searchStatusText: {
    color: "#33443e",
    flexShrink: 1,
    fontSize: 12
  },
  searchRetry: {
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  searchRetryText: {
    color: "#176b52",
    fontSize: 12,
    fontWeight: "700"
  },
  preview: {
    backgroundColor: "#fff",
    borderColor: "#e1e8e3",
    borderRadius: 16,
    borderWidth: 1,
    elevation: 8,
    marginBottom: 8,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    width: 280
  },
  closeButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    height: 32,
    justifyContent: "center",
    width: 32,
    zIndex: 1
  },
  closeText: {
    color: "#52645d",
    fontSize: 26,
    lineHeight: 30
  },
  name: {
    color: "#173b32",
    fontSize: 19,
    fontWeight: "700",
    paddingRight: 30
  },
  address: {
    color: "#52645d",
    fontSize: 14,
    marginTop: 6
  },
  provenance: {
    color: "#52645d",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: "#176b52",
    borderRadius: 10,
    flex: 1,
    padding: 12
  },
  primaryActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700"
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: "#eef3ef",
    borderRadius: 10,
    flex: 1,
    padding: 12
  },
  secondaryActionText: {
    color: "#173b32",
    fontSize: 14,
    fontWeight: "700"
  },
  modalBackdrop: {
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
    justifyContent: "flex-end"
  },
  directionsSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 10,
    padding: 24,
    paddingBottom: 36
  },
  directionsTitle: {
    color: "#173b32",
    fontSize: 20,
    fontWeight: "700"
  },
  directionsSubtitle: {
    color: "#52645d",
    fontSize: 14,
    marginBottom: 6
  },
  directionOption: {
    backgroundColor: "#f1f4f2",
    borderRadius: 10,
    padding: 14
  },
  directionOptionText: {
    color: "#173b32",
    fontSize: 16,
    fontWeight: "600"
  },
  cancelAction: {
    alignItems: "center",
    padding: 12
  },
  cancelText: {
    color: "#176b52",
    fontSize: 15,
    fontWeight: "700"
  },
  error: {
    color: "#b42318",
    fontSize: 14
  }
});
