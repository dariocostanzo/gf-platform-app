# Local setup

## Prerequisites

- Node.js 22.13 or newer (use an active LTS release).
- npm, included with Node.js.
- VS Code is recommended.
- For mobile testing, use Expo Go on a physical device or install the Android development tools separately. An Android emulator is optional.

The project has not been installed or built yet. From the repository root, run:

```sh
node --version
npm --version
npm install
npm run typecheck
```

`npm install` creates the root `package-lock.json`; commit that file so future installs use the same dependency tree.

If Node.js is missing, install an active LTS release using the official instructions at [nodejs.org](https://nodejs.org/), then open a new terminal and verify the two version commands above. This project setup does not install or configure system tools automatically.

## Database milestone

The initial schema is documented in `supabase/migrations/`. It requires a Supabase PostgreSQL project with PostGIS available. Database policy tests are in `supabase/tests/database/` and use pgTAP; after configuring the Supabase CLI and a local Supabase stack, run them with:

```sh
supabase test db
```

Do not apply migrations to a production project before reviewing the SQL and passing the database tests against a local or staging database. This repository does not yet include Supabase CLI project configuration.

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
