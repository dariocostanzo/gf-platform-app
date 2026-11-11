# Supabase database

Database schema and policy changes will be added as ordered SQL migrations under `supabase/migrations/`. Each migration should be reviewable, safe to apply in sequence, and include Row Level Security policies for any client-accessible table.

No Supabase project, schema, credentials, or migration has been created in this foundation milestone. Add the Supabase CLI and local database workflow only when implementing the backend milestone; test migrations and policies before applying them to a hosted project.
