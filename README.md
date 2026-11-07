# DataOnly

Marketplace prototype for expert-curated **datacuts**. Phase 1 is a clickable mock (no auth, payments, or uploads).

Visual source: [Figma Make — DataOnly](https://www.figma.com/make/LmfXZLjhEh2TWVN9zgD9to/DataOnly).

## Monorepo

| Path | Stack |
|------|--------|
| `apps/web` | Next.js App Router (TypeScript) — SEO portal |
| `apps/mobile` | Expo + Expo Router (TypeScript) — iOS/Android |
| `packages/core` | Shared types, mock catalog, `CatalogRepository` |

Package manager: **pnpm** workspaces.

## Prerequisites

- Node.js 20+ (22 recommended)
- pnpm 10+
- For mobile: Expo Go on a device, or iOS Simulator / Android emulator

```bash
npm install -g pnpm   # if needed
pnpm install
```

## Run web

```bash
pnpm dev:web
# → http://localhost:3000
```

Routes: `/` Home · `/explore` · `/explore/[slug]` · `/creators` · `/creators/[slug]` · `/datacuts/[slug]` · `/saved` · `/search`

At ≤760px width the Make mobile shell replaces the desktop portal (same mock data). Use a wide viewport for the desktop look.

## Run mobile

```bash
pnpm dev:mobile
# Expo Dev Tools — press i / a, or scan the QR code with Expo Go
```

Same mock catalog via `@dataonly/core`. Tabs: Home, Explore, Creators, Saved (+ Search). Detail and creator storefronts are stack screens. **Buy** opens a fake confirmation modal (no charge).

## Mock data notes

- Catalog lives in `packages/core` (`mockCatalog` implements `CatalogRepository`).
- Some creators are `verified: true` for badge display only — no apply form in v0.
- Saved lists: web uses `localStorage`; mobile uses in-memory context seeded from `getInitialSavedIds()`.

## Scripts

```bash
pnpm dev:web          # Next.js
pnpm dev:mobile       # Expo
pnpm build:web        # Production web build
pnpm typecheck        # Workspace typecheck (where configured)
```
