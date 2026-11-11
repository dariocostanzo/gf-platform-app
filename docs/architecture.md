# Architecture decisions

## Workspace layout

- `apps/mobile`: Expo and React Native application.
- `apps/admin`: Next.js administration website.
- `packages/shared`: framework-neutral TypeScript domain types shared by the apps.
- `supabase/migrations`: future, ordered PostgreSQL schema and Row Level Security migrations.

The repository uses npm workspaces rather than adding a monorepo management dependency. App-specific user interfaces and infrastructure integrations stay in their respective apps; shared code is limited to cross-app domain concepts.

## Backend and trust boundaries

Supabase Auth and PostgreSQL/PostGIS are the planned identity and data foundations. Client apps will use publishable keys and receive only permissions granted by Row Level Security. Service-role credentials, moderation actions, and other privileged operations must stay server-side.

Restaurant safety information must retain its source (restaurant, community, or independent verification) and relevant dates. Ratings must not be used to calculate or assert coeliac safety. Food lookup data and automated analysis must also identify uncertainty and must not infer safety from absent ingredient or allergen data.

The initial database migration creates profiles from Supabase Auth users, keeps role assignments out of client write access, restricts restaurant submissions to pending review, and exposes only published restaurants and their safety claims to the public. Administrator role provisioning is deliberately a trusted-operator task; there is no public signup path to administrator access.

## Future growth

Restaurant discovery, reviews, travel content, and later social features should be modeled as distinct domain areas with explicit ownership and moderation. Social media, follows, reactions, and feeds are intentionally deferred; their later addition should not require putting feed or social concerns into the restaurant or safety models.

Maps and product lookups should be integrated behind small app-level services. Before production, verify OpenStreetMap tile/geocoding policies and Open Food Facts attribution, licensing, data quality, and usage limits.
