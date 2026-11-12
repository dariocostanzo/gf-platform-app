import { createClient } from "@supabase/supabase-js";
import type { Database } from "@glutenfree/shared";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseClient =
  supabaseUrl && supabasePublishableKey
    ? createClient<Database>(supabaseUrl, supabasePublishableKey)
    : null;
