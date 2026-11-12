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
          status: Database["public"]["Enums"]["restaurant_status"];
          created_by: string;
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
          status?: Database["public"]["Enums"]["restaurant_status"];
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["restaurants"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      restaurant_status: "pending" | "published" | "rejected" | "archived";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type RestaurantSummary = Pick<
  Database["public"]["Tables"]["restaurants"]["Row"],
  "id" | "name" | "address" | "city" | "region" | "country_code"
>;
