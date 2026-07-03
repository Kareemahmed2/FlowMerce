# FlowMerce — Merchant Frontend

Next.js (App Router) frontend for merchants: sign up, onboard a store, manage catalog and orders, customize storefront colors, and use AI-assisted design feedback. Built to pair with a **Spring Boot** (or other) backend when you wire `NEXT_PUBLIC_API_URL` and auth.

## Features

### Authentication

- **Sign up / login** at `/signup` and `/login`.
- If **`NEXT_PUBLIC_API_KEY`** is **empty**, auth uses **`localStorage`** only (development convenience, not production-safe).
- If an API key is set, auth can call the backend via `lib/api.ts` (`NEXT_PUBLIC_API_URL`).

### Onboarding (`/onboarding`)

Multi-step wizard with inline FlowMerce styling:

1. **Brand** — name, logo  
2. **Catalog** — categories and products  
3. **Payment** — Egypt-focused merchant payout methods (bank, InstaPay, wallets, Fawry, Meeza, COD, etc.)  
4. **Design** — theme colors (background, header, footer, accent; extended palette also supports **text** and **card** in persisted state)  
5. **AI check** — Claude via **`/api/ai/chat`** (server-side `ANTHROPIC_API_KEY`)  
6. **Publish** — completes onboarding and routes to the dashboard  

On completion, store data is written to **`flowmerce_store_v1`**.

### Dashboard (`/dashboard`)

Shell with sidebar; main areas:

| Route | Description |
| ----- | ----------- |
| `/dashboard` | Overview (metrics from local store + orders where applicable) |
| `/dashboard/orders` | Order list, filters, drawer; statuses; persisted in **`flowmerce_orders_v1`** |
| `/dashboard/products` | Products from onboarded catalog / local store |
| `/dashboard/customers` | **Derived from orders** (grouped by email): segments, LTV-style stats, no hard-coded mock customers |
| `/dashboard/analytics` | Charts from **aggregated orders** (daily revenue/orders, estimated visitors, top products, payment split, funnel estimates). Replaces mock time series |
| `/dashboard/design` | **Storefront design studio** — live preview (Home / Product / Cart), presets, WCAG-style contrast checks, AI assistant via **`/api/ai/chat`** |
| `/dashboard/settings` | Store info, URL slug, checkout gateways, shipping, notifications, tax, security toggles, danger zone (pause / export / delete local data). Persisted in **`flowmerce_settings_v1`**; syncs brand + **`storeUrl`** to **`flowmerce_store_v1`** on save |

### UI & AI

- **DM Sans**, shared tokens (`#0F0E0C`, `#E8E4DE`, `#B5905A`, etc.), inline style objects for merchant screens.  
- **`/api/ai/chat`** — POST JSON `{ system?, messages[] }`; uses `ANTHROPIC_API_KEY` on the server. Safe to call from the client without exposing the key.

## Requirements

- Node.js 18+  
- npm (or pnpm / yarn)

## Getting started

```bash
npm install
```

Copy environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` as needed (see [Environment variables](#environment-variables)).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port Next prints).

### Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |

## Environment variables

| Variable | Description |
| -------- | ----------- |
| `NEXT_PUBLIC_API_URL` | Base URL of your backend API (e.g. Spring Boot). Used by `lib/api.ts` when calling signup/login and other endpoints. |
| `NEXT_PUBLIC_API_KEY` | If **empty**, local dev auth only. If set, requests can send `Authorization` to the API. |
| `ANTHROPIC_API_KEY` | **Server-only.** Powers `POST /api/ai/chat` (onboarding AI step + design assistant). Optional; without it the route returns a short fallback message. |

Never commit real secrets. Use `.env.local` (gitignored).

## Local development data (no backend)

Until the API owns persistence, the app uses the browser:

| Key | Purpose |
| --- | ------- |
| `flowmerce_local_user_v1` | Local signed-in user record (dev auth). |
| `flowmerce_store_v1` | Store payload: `brand`, `categories`, merchant `payment` methods, `colors` (including optional `text` / `card`), `published`, `storeUrl`, etc. |
| `flowmerce_orders_v1` | Orders used by Orders, Customers, and Analytics. |
| `flowmerce_settings_v1` | Dashboard **Settings** (store, checkout gateways, shipping, notifications, tax). 2FA is server-side now (`isMfaEnabled` on the user), not part of this blob. |

Clear **Application → Local Storage** in DevTools to reset (or use **Settings → Danger Zone** for structured export/delete of local data).

## Project structure (high level)

```
app/
  page.tsx                    # Landing
  login/, signup/             # Auth
  onboarding/                 # Merchant wizard
  dashboard/                  # Shell + per-route pages (orders, products, customers, analytics, design, settings)
  api/ai/chat/route.ts       # Claude proxy (server key)
components/merchant/
  onboarding/                 # Steps, types, wizard styles
  dashboard/                  # Layout, overview, placeholders where unused
  orders/, products/
  customers/                  # CustomersPage + types; data from orders
  analytics/                  # Charts + analytics-from-orders
  design/                     # Design studio, previews, styles
  settings/                   # Settings page + constants + styles
lib/
  api.ts                      # API helper when backend is configured
  design/color-utils.ts       # Contrast helpers for design studio
  local-store/
    store.ts                  # Persisted store payload
    orders.ts                 # Orders load/save
    hooks.ts                  # useFlowmerceStore, useFlowmerceOrders
    customers-from-orders.ts  # Build customer rows from orders
    analytics-from-orders.ts  # Build analytics series + aggregates from orders
    settings-types.ts
    settings-storage.ts       # Settings load/save + export/clear helpers
```

## Backend integration notes

- Replace **local auth** and **localStorage** with API sessions/JWT and server-side storage when ready.  
- **Customers / Analytics** currently **derive** from orders in dev; replace with dedicated endpoints when the backend exposes them.  
- **Settings** checkout gateways and tax are UI + local persistence until you map them to your payment/tax APIs.  
- Configure **CORS** and the real **`NEXT_PUBLIC_API_URL`** on the backend.

## License

Private project — adjust as needed.
