# Supabase database

Database schema and policy changes are recorded as ordered SQL migrations under `supabase/migrations/`. The initial core migration adds profiles and roles, PostGIS-backed restaurant submissions, sourced restaurant safety claims, and Row Level Security policies.

The RLS tests under `supabase/tests/database/` use pgTAP to cover member, anonymous, and administrator access. The migration and tests have not been executed because the Supabase CLI, PostgreSQL client, and Docker are not installed. Configure the Supabase CLI and local database workflow, then run `supabase test db` before applying migrations to a hosted project.
