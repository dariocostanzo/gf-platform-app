# Supabase database

Database schema and policy changes are recorded as ordered SQL migrations under `supabase/migrations/`. The initial core migration adds profiles and roles, PostGIS-backed restaurant submissions, sourced restaurant safety claims, and Row Level Security policies.

The RLS tests under `supabase/tests/database/` use pgTAP to cover member, anonymous, and administrator access. The Supabase CLI is pinned in the root npm development dependencies. Start Docker and run `npm run db:start`, then `npm run db:test`; stop the stack with `npm run db:stop`. The test command was attempted, but Docker is not installed and the local PostgreSQL service could not be reached. Do not apply migrations to a hosted project before these tests pass locally or in staging.
