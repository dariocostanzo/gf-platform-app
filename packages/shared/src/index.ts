export const safetyInformationSources = [
  "restaurant",
  "community",
  "independently_verified"
] as const;

export type SafetyInformationSource = (typeof safetyInformationSources)[number];

export interface SourcedSafetyClaim<T> {
  value: T;
  source: SafetyInformationSource;
  recordedAt: string;
  independentlyVerifiedAt?: string;
}

export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          city: string | null;
          region: string | null;
          postal_code: string | null;
          country_code: string;
          phone: string | null;
          website: string | null;
          location: string;
          listing_source: "community" | "openstreetmap";
          source_reference: string | null;
          source_license: string | null;
          gluten_free_options: "yes" | "only" | "limited" | null;
          status: Database["public"]["Enums"]["restaurant_status"];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          city?: string | null;
          region?: string | null;
          postal_code?: string | null;
          country_code: string;
          phone?: string | null;
          website?: string | null;
          location: string;
          listing_source?: "community" | "openstreetmap";
          source_reference?: string | null;
          source_license?: string | null;
          gluten_free_options?: "yes" | "only" | "limited" | null;
          status?: Database["public"]["Enums"]["restaurant_status"];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["restaurants"]["Insert"]>;
        Relationships: [];
      };
      restaurant_safety_claims: {
        Row: {
          id: string;
          restaurant_id: string;
          claim_type: Database["public"]["Enums"]["safety_claim_type"];
          claim_value: boolean;
          source: Database["public"]["Enums"]["safety_information_source"];
          details: string | null;
          recorded_by: string;
          recorded_at: string;
          independently_verified_by: string | null;
          independently_verified_at: string | null;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          claim_type: Database["public"]["Enums"]["safety_claim_type"];
          claim_value: boolean;
          source: Database["public"]["Enums"]["safety_information_source"];
          details?: string | null;
          recorded_by: string;
          recorded_at?: string;
          independently_verified_by?: string | null;
          independently_verified_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["restaurant_safety_claims"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      nearby_restaurants: {
        Args: {
          p_latitude: number;
          p_longitude: number;
          p_radius_meters: number;
          p_search_text?: string | null;
        };
        Returns: Array<{
          id: string;
          name: string;
          address: string | null;
          city: string | null;
          region: string | null;
          country_code: string;
          listing_source: "community" | "openstreetmap";
          source_reference: string | null;
          source_license: string | null;
          gluten_free_options: "yes" | "only" | "limited" | null;
          latitude: number;
          longitude: number;
          distance_meters: number;
        }>;
      };
    };
    Enums: {
      restaurant_status: "pending" | "published" | "rejected" | "archived";
      safety_claim_type:
        | "dedicated_gluten_free_kitchen"
        | "dedicated_preparation_area"
        | "separate_fryer"
        | "cross_contamination_procedures"
        | "staff_knowledge"
        | "gluten_free_menu_available";
      safety_information_source:
        | "restaurant"
        | "community"
        | "independently_verified";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type RestaurantSummary = Pick<
  Database["public"]["Tables"]["restaurants"]["Row"],
  | "id"
  | "name"
  | "address"
  | "city"
  | "region"
  | "country_code"
  | "listing_source"
  | "source_reference"
  | "source_license"
  | "gluten_free_options"
>;

export type RestaurantSafetyClaim = Pick<
  Database["public"]["Tables"]["restaurant_safety_claims"]["Row"],
  | "id"
  | "claim_type"
  | "claim_value"
  | "source"
  | "details"
  | "recorded_at"
  | "independently_verified_at"
>;
