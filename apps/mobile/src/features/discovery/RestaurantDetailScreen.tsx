import type { RestaurantSafetyClaim } from "@glutenfree/shared";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { fetchPublishedRestaurantDetails } from "./restaurantDetails";
import type { RestaurantDetails } from "./restaurantDetails";
import { supabaseClient } from "../../lib/supabase";

interface Props {
  restaurantId: string;
  onBack: () => void;
}

type DetailState =
  | { status: "loading" }
  | { status: "ready"; details: RestaurantDetails }
  | { status: "not_found" }
  | { status: "error"; message: string };

const claimLabels: Record<RestaurantSafetyClaim["claim_type"], string> = {
  dedicated_gluten_free_kitchen: "Dedicated gluten-free kitchen",
  dedicated_preparation_area: "Dedicated preparation area",
  separate_fryer: "Separate fryer",
  cross_contamination_procedures: "Cross-contamination procedures",
  staff_knowledge: "Staff knowledge",
  gluten_free_menu_available: "Gluten-free menu available"
};

const sourceLabels: Record<RestaurantSafetyClaim["source"], string> = {
  restaurant: "Provided by the restaurant",
  community: "Reported by the community",
  independently_verified: "Independently verified"
};

export default function RestaurantDetailScreen({ restaurantId, onBack }: Props) {
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<DetailState>({ status: "loading" });

  useEffect(() => {
    if (!supabaseClient) {
      setState({
        status: "error",
        message: "Supabase is not configured for this app."
      });
      return;
    }

    const client = supabaseClient;
    const controller = new AbortController();
    setState({ status: "loading" });

    fetchPublishedRestaurantDetails(client, restaurantId, controller.signal)
      .then((details) => {
        if (!controller.signal.aborted) {
          setState(details ? { status: "ready", details } : { status: "not_found" });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred while loading this restaurant."
          });
        }
      });

    return () => controller.abort();
  }, [restaurantId, retryCount]);

  return (
    <View style={styles.screen}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to restaurant search"
        onPress={onBack}
        style={styles.backButton}
      >
        <Text style={styles.backText}>‹  Back to search</Text>
      </Pressable>

      {state.status === "loading" ? (
        <View style={styles.message}>
          <ActivityIndicator color="#176b52" />
          <Text style={styles.body}>Loading restaurant details…</Text>
        </View>
      ) : state.status === "error" || state.status === "not_found" ? (
        <View style={styles.message}>
          <Text style={styles.heading}>
            {state.status === "not_found"
              ? "Restaurant not found"
              : "Couldn’t load restaurant details"}
          </Text>
          {state.status === "error" && (
            <Text style={styles.body}>{state.message}</Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => setRetryCount((count) => count + 1)}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>RESTAURANT</Text>
          <Text style={styles.title}>{state.details.restaurant.name}</Text>
          {formatLocation(state.details.restaurant) && (
            <Text style={styles.body}>
              {formatLocation(state.details.restaurant)}
            </Text>
          )}
          {state.details.restaurant.address && (
            <Text style={styles.body}>{state.details.restaurant.address}</Text>
          )}
          {state.details.restaurant.phone && (
            <Text style={styles.body}>{state.details.restaurant.phone}</Text>
          )}
          {state.details.restaurant.website && (
            <Text style={styles.body}>{state.details.restaurant.website}</Text>
          )}

          <View style={styles.warning}>
            <Text style={styles.warningTitle}>Important safety information</Text>
            <Text style={styles.body}>
              These sourced reports are not a guarantee that a restaurant is safe
              for people with coeliac disease. Contact the restaurant to discuss
              your needs and cross-contamination procedures.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Reported safety information</Text>
          {state.details.safetyClaims.length === 0 ? (
            <Text style={styles.body}>
              No safety information has been recorded for this restaurant.
            </Text>
          ) : (
            state.details.safetyClaims.map((claim) => (
              <SafetyClaimCard key={claim.id} claim={claim} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function SafetyClaimCard({ claim }: { claim: RestaurantSafetyClaim }) {
  const recordedDate = formatDate(claim.recorded_at);
  const verifiedDate = claim.independently_verified_at
    ? formatDate(claim.independently_verified_at)
    : null;

  return (
    <View style={styles.claimCard}>
      <Text style={styles.claimTitle}>{claimLabels[claim.claim_type]}</Text>
      <Text style={styles.claimValue}>
        {claim.claim_value ? "Reported: Yes" : "Reported: No"}
      </Text>
      <Text style={styles.body}>{sourceLabels[claim.source]}</Text>
      {claim.details && <Text style={styles.details}>{claim.details}</Text>}
      <Text style={styles.metadata}>
        Recorded {recordedDate}
        {verifiedDate ? ` · Verified ${verifiedDate}` : ""}
      </Text>
    </View>
  );
}

function formatLocation(
  restaurant: RestaurantDetails["restaurant"]
): string {
  return [
    restaurant.city,
    restaurant.region,
    restaurant.country_code
  ]
    .filter(Boolean)
    .join(", ");
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "date unavailable" : date.toLocaleDateString();
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f5f7f5",
    flex: 1,
    paddingTop: 32
  },
  backButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  backText: {
    color: "#176b52",
    fontSize: 16,
    fontWeight: "700"
  },
  content: {
    padding: 20,
    paddingBottom: 36
  },
  eyebrow: {
    color: "#176b52",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 8
  },
  title: {
    color: "#173b32",
    fontSize: 28,
    fontWeight: "700",
    marginVertical: 8
  },
  heading: {
    color: "#173b32",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center"
  },
  sectionTitle: {
    color: "#173b32",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 12
  },
  body: {
    color: "#33443e",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6
  },
  warning: {
    backgroundColor: "#fff8e9",
    borderColor: "#ead7a8",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    padding: 16
  },
  warningTitle: {
    color: "#4b3b19",
    fontSize: 16,
    fontWeight: "700"
  },
  claimCard: {
    backgroundColor: "#fff",
    borderColor: "#e1e8e3",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    padding: 15
  },
  claimTitle: {
    color: "#173b32",
    fontSize: 16,
    fontWeight: "700"
  },
  claimValue: {
    color: "#176b52",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8
  },
  details: {
    color: "#33443e",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8
  },
  metadata: {
    color: "#52645d",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8
  },
  message: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24
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
  }
});
