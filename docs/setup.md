# Local setup

## Prerequisites

- Node.js 22.13 or newer (use an active LTS release).
- npm, included with Node.js.
- Docker Engine and Docker Compose for local Supabase database tests.
- VS Code is recommended.
- For mobile testing, use Expo Go on a physical device or install the Android development tools separately. An Android emulator is optional.

From the repository root, install project dependencies and check the TypeScript workspaces:

```sh
node --version
npm --version
npm install
npm run typecheck
```

The root `package-lock.json` pins the dependency tree. The Supabase CLI is a project development dependency and does not need a global installation.

If Node.js is missing, install an active LTS release using the official instructions at [nodejs.org](https://nodejs.org/), then open a new terminal and verify the two version commands above.

## Database milestone

The initial schema is documented in `supabase/migrations/`; local Supabase CLI settings are in `supabase/config.toml`. The local stack requires Docker Engine to be running and accessible to your user. Check with `docker info` before starting. On Linux, access through the `docker` group grants root-equivalent privileges; only configure that access on a machine you control.

Start the local services, apply the migrations, and run the pgTAP tests:

```sh
npm run db:start
npm run db:test
```

When finished, stop the local services:

```sh
npm run db:stop
```

Do not apply migrations to a production project before reviewing the SQL and passing the database tests against a local or staging database. The database test command requires Docker; without it, the local PostgreSQL connection will be refused.

## Run the apps

Start the administration website:

```sh
npm run dev:admin
```

Start the mobile development server:

```sh
npm run dev:mobile
```

Expo prints a QR code and connection instructions. Open it with Expo Go on a device on the same network. Mobile development requires an installed Expo Go version compatible with the project's Expo SDK.

## Environment variables

When connecting a Supabase project, copy `apps/admin/.env.example` to `apps/admin/.env.local` and `apps/mobile/.env.example` to `apps/mobile/.env`, then fill in the project URL and publishable key. The app-specific files are read from each app's project directory. These publishable values are intended for client applications; never put a Supabase service-role key or other secret in an `EXPO_PUBLIC_` or `NEXT_PUBLIC_` variable. No Supabase project is configured yet.
