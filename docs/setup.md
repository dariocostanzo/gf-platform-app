# Local setup

## Prerequisites

- Node.js 22.13 or newer (use an active LTS release).
- npm, included with Node.js.
- Docker Engine and Docker Compose for local Supabase database tests.
- VS Code is recommended.
- For mobile testing, use a physical Android device. The MapLibre map requires a custom development build; Expo Go does not include its native module.
- For local Android builds, install a JDK and Android SDK. An Android emulator is optional.
- For cloud Android builds, an Expo account and the EAS build service are required; check current account quotas and billing before starting a build.

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

For the first run, prepare an Android development build. Expo Go cannot load MapLibre Native, so opening this project in Expo Go will not run the map:

```sh
cd apps/mobile
npx eas-cli login
npx eas-cli build --profile development --platform android
```

The first EAS build may ask to create/link an Expo project. Check your account's build quota before starting it. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the EAS `development` environment (these are client-visible values; never add a service-role key). Install the generated APK on your Android phone, then start Metro in development-client mode:

```sh
cd apps/mobile
npx expo start --dev-client --tunnel ngrok
```

Scan the QR code using the installed Gluten-Free development app, not Expo Go. The `ngrok` tunnel provider must be installed as a development tool if Expo prompts for it.

Alternatively, after installing a JDK and Android SDK, build and install locally:

```sh
cd apps/mobile
npx expo run:android
npx expo start --dev-client
```

Expo Location requests foreground permission only. If permission is denied, restaurant search remains available and the app explains how to enable location in settings.

## Environment variables

When connecting a Supabase project, copy `apps/admin/.env.example` to `apps/admin/.env.local` and `apps/mobile/.env.example` to `apps/mobile/.env`, then fill in the project URL and publishable key. The mobile app reads published restaurant listings using the `EXPO_PUBLIC_` settings; browsing is read-only and protected by database Row Level Security. The app-specific files are read from each app's project directory. These publishable values are intended for client applications; never put a Supabase service-role key or other secret in an `EXPO_PUBLIC_` or `NEXT_PUBLIC_` variable.
