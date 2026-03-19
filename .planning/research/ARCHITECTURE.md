# Architecture Research: Shopify App Structure

> Research date: 2026-03-19
> Context: Read-only embedded Shopify app for IT Geeks (Platinum Partner) — product/inventory audit tool, starting with Rana Furniture, then multi-store.

---

## App Architecture Overview

### What an Embedded App Is

A Shopify embedded app is a web application that runs inside an **iframe** within the Shopify admin. The merchant never leaves the Shopify admin UI — they see your app rendered inside the admin shell.

The key components:

1. **Your web server** — A Remix (or React Router) Node.js app hosted somewhere public (Fly.io, Render, etc.)
2. **Shopify admin iframe** — Shopify loads your app's URL inside an iframe at `admin.shopify.com/store/{shop}/apps/{app-handle}`
3. **App Bridge** — A Shopify JS library your frontend loads. It provides a message-passing channel between the iframe and the parent Shopify admin shell. It can render native admin UI elements (navigation, top bar, save bar, modals) that live *outside* the iframe but are controlled by your app's JS.
4. **Shopify Admin API** — Your backend calls this (GraphQL) to read/write store data using an access token obtained via OAuth.

### App Bridge Details

- App Bridge components are **not rendered in your React tree**. They are JavaScript messages sent to the parent Shopify admin, which renders the actual UI elements.
- On web: runs in an iframe. On mobile: runs in a WebView.
- Provides session tokens (1-minute-lived JWTs) that your frontend attaches to every request to your backend, so your backend can verify the request is legitimately from Shopify.
- Pair with Polaris (Shopify's design system) for native-feeling admin UI.

### Shopify Managed Installation (2024+ recommended approach)

Shopify now supports **Shopify Managed Installation**, which reduces OAuth redirects and page flickers during app install. Access scopes are declared in `shopify.app.toml` and Shopify handles the install flow, minimising the "OAuth dance" the merchant sees.

---

## Request Flow

```
Merchant opens app in Shopify admin
        │
        ▼
Shopify admin loads your app URL in an iframe
  (https://your-app.fly.dev/app)
        │
        ▼
App Bridge initialises in the iframe
  → fetches a session token (JWT, 1-min TTL)
        │
        ▼
Your Remix frontend makes a fetch/loader call to your backend
  Authorization: Bearer <session-token>
        │
        ▼
Your Remix backend (shopify.server.ts):
  1. Validates the session token JWT signature
     (using your app's shared secret)
  2. Extracts shop domain + user ID from JWT
  3. Looks up stored access token for that shop
     (SQLite/Postgres via Prisma)
  4. Uses access token to call Shopify GraphQL Admin API
        │
        ▼
Shopify Admin API returns product/inventory data
        │
        ▼
Your backend returns processed data to the Remix loader
        │
        ▼
Remix renders the UI — merchant sees audit results
```

### For background/server-side jobs (no user present):
Use an **offline access token** (see Session Management). Your backend can call the Admin API directly without a session token from App Bridge.

---

## Authentication & Sessions

### OAuth Flow (Authorization Code Grant — legacy/fallback)

1. Merchant clicks "Install" on the app listing
2. Shopify redirects merchant to your app's `/auth` route with a `shop` param
3. Your app redirects to `https://{shop}.myshopify.com/admin/oauth/authorize`
4. Merchant approves scopes
5. Shopify redirects back to your `redirect_uri` with an authorization `code`
6. Your backend POSTs the code to Shopify and receives an **access token**
7. Store the token in your database keyed to the shop domain
8. Merchant is redirected into the embedded app

### Recommended Modern Flow (Token Exchange)

For embedded apps using App Bridge:
- App Bridge provides a **session token** (JWT) to the frontend
- Your frontend sends this to your backend
- Your backend performs **token exchange** (OAuth 2.0 RFC 8693): sends the session token to Shopify and receives an API access token
- This avoids full OAuth redirect flows after the initial install

### Online vs Offline Access Tokens

| | Online Token | Offline Token |
|---|---|---|
| **Tied to** | A specific staff user | The store (no user) |
| **Expires** | When user's Shopify session expires | Never (until revoked) |
| **Best for** | User-context actions (acting as the merchant) | Background jobs, webhooks, automated tasks |
| **Stored** | Short-lived, may be refreshed | Long-lived, store in DB |
| **Use case for this app** | Displaying audit UI in admin | Scheduled inventory scans |

For a **read-only audit app**:
- Use an **offline token** for any scheduled/background data pulls
- Use **online token** (or session token → token exchange) for interactive admin UI sessions

### Session Token Structure (JWT)

```json
{
  "iss": "https://rana-furniture.myshopify.com/admin",
  "dest": "https://rana-furniture.myshopify.com",
  "aud": "<your-app-client-id>",
  "sub": "<staff-user-id>",
  "exp": 1234567890,
  "jti": "<random-uuid>",
  "sid": "<session-id>"
}
```

Validated by your backend using HMAC-SHA256 with your `SHOPIFY_API_SECRET`.

---

## File Structure

Typical Shopify Remix (React Router) app after `shopify app init`:

```
my-shopify-app/
├── shopify.app.toml          # App config: scopes, URLs, webhooks, extensions
├── shopify.web.toml          # Web component config
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env                      # SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES, etc.
├── Dockerfile                # For containerised deployments
├── .eslintrc.cjs
├── .graphqlrc.ts             # GraphQL codegen config
│
├── app/                      # Remix application code
│   ├── shopify.server.ts     # Core: Shopify app initialisation, auth helpers
│   ├── root.tsx              # Remix root layout
│   ├── entry.server.tsx
│   ├── entry.client.tsx
│   └── routes/
│       ├── app.tsx           # Authenticated app layout (App Bridge provider)
│       ├── app._index.tsx    # Main app page (default route inside admin)
│       ├── app.products.tsx  # Example: products route
│       ├── auth.tsx          # OAuth entry point
│       ├── auth.callback.tsx # OAuth callback handler
│       └── webhooks.*.tsx    # Webhook handlers (app/uninstalled, scopes_update)
│
├── extensions/               # App extensions (admin blocks, checkout, etc.)
│   └── my-admin-block/
│       ├── shopify.extension.toml
│       └── src/
│
└── prisma/
    ├── schema.prisma         # Session storage model (Shop, Session tables)
    └── migrations/
```

### Key Files Explained

**`app/shopify.server.ts`** — The heart of the Remix app. Initialises `@shopify/shopify-app-remix` with your API key, secret, scopes, and session storage adapter. Exports `authenticate.admin()` which you call in every authenticated loader/action.

**`app/routes/app.tsx`** — Wraps all admin-facing routes. Loads App Bridge, sets up the `AppProvider` from `@shopify/shopify-app-remix/react`. All child routes (app._index.tsx, app.products.tsx, etc.) run inside the authenticated session.

**`app/routes/app._index.tsx`** — Your app's main page. Loaders here call `authenticate.admin(request)` to get a `admin` object, then use `admin.graphql()` to query the store.

**`prisma/schema.prisma`** — Stores session data (access tokens) per shop. Default: SQLite (fine for dev, swap for Postgres in production).

---

## Local Development

### `shopify app dev` Command

```bash
shopify app dev --store rana-furniture.myshopify.com
```

What it does:
1. **Builds** the Remix app and watches for file changes
2. **Starts a tunnel** (Cloudflare tunnel by default) to expose your localhost to the public internet, giving you a URL like `https://random-id.trycloudflare.com`
3. **Registers** that tunnel URL as the app URL in your Shopify Partner account (overriding the production URL during dev)
4. **Opens** the app in your dev store automatically
5. **Syncs extensions** — any admin blocks or checkout extensions are also served via the dev server

### Tunnel Options

| Option | Command | Notes |
|---|---|---|
| **Cloudflare tunnel** (default) | `shopify app dev` | Automatic, no config needed |
| **Localhost only** | `shopify app dev --use-localhost` | No tunnel — works for most features, NOT webhooks |
| **Custom tunnel** | `shopify app dev --tunnel-url https://my-ngrok.io:3000` | Use your own ngrok/etc. |

### Why tunnels are needed

Shopify must be able to reach your app to:
- Load the iframe URL
- Deliver webhooks
- Validate OAuth callbacks

Your laptop is not publicly reachable, so the tunnel provides a public HTTPS URL that forwards to your local server.

### Key flags

```bash
shopify app dev \
  --store rana-furniture.myshopify.com \   # which dev store to use
  --config shopify.app.toml \              # which config file
  --localhost-port 3000 \                  # local port
  --reset                                  # clear cached settings (if things break)
```

---

## Deployment Options

### Supported Providers (Official Guides)

| Provider | Type | Notes |
|---|---|---|
| **Fly.io** | Container PaaS | Good Shopify support, persistent volumes for SQLite, cheap |
| **Render** | PaaS | Simple git-based deploys, managed Postgres available |
| **Google Cloud Run** | Serverless containers | Scales to zero, more GCP complexity |
| **Manual** | Any | Full control, requires your own infra setup |

### What About Vercel?

Vercel is **not in Shopify's official deployment guides** as of 2025/2026. Key considerations:
- Vercel runs serverless functions — no persistent filesystem (can't use SQLite)
- Must use an external database (Postgres via Supabase, Neon, etc.) for session storage
- Cold starts can affect the embedded app load experience
- **It works**, but requires more configuration than Fly.io or Render

### Recommended for IT Geeks Audit App

**Fly.io** is the best fit for initial deployment:
- Persistent volume for SQLite (or easy Postgres upgrade for multi-store)
- `Dockerfile` is already in the template
- Reasonable pricing for a B2B internal tool
- Good CLI tooling

### Required Environment Variables

```bash
SHOPIFY_API_KEY=<from Partners dashboard>
SHOPIFY_API_SECRET=<from Partners dashboard>
SCOPES=read_products,read_inventory
SHOPIFY_APP_URL=https://your-app.fly.dev
PORT=3000
DATABASE_URL=file:./prisma/dev.db   # or postgres://...
```

### Deployment Workflow

```bash
# 1. Push code to hosting provider
fly deploy   # or git push render main

# 2. Deploy Shopify config + extensions
shopify app deploy

# 3. Verify in Partners dashboard
# App URL, redirect URLs, scopes all updated
```

`shopify app deploy` pushes your `shopify.app.toml` settings (URLs, scopes, webhooks) to the Shopify Partners API and creates a new app version. You must run this any time you change the TOML config.

---

## Configuration (TOML)

### `shopify.app.toml` — Full Structure

```toml
# ── Identity ────────────────────────────────────────────────────────────────
name = "Rana Inventory Audit"
client_id = "abc123..."           # Your app's API key (public identifier)
application_url = "https://your-app.fly.dev"
embedded = true                   # Run inside Shopify admin iframe

handle = "rana-audit"             # URL slug: admin.shopify.com/.../apps/rana-audit

# ── Directories ─────────────────────────────────────────────────────────────
extension_directories = ["extensions/*"]
web_directories = ["web"]

# ── Access Scopes ────────────────────────────────────────────────────────────
[access_scopes]
scopes = "read_products,read_inventory,read_locations"
# optional_scopes = ["write_products"]  # request later if needed
# use_legacy_install_flow = false       # keep false for managed install

# ── Auth Redirect URLs ───────────────────────────────────────────────────────
[auth]
redirect_urls = [
  "https://your-app.fly.dev/auth/callback",
  "https://your-app.fly.dev/auth/shopify/callback",
  "http://localhost:3000/auth/callback"   # for local dev
]

# ── Webhooks ─────────────────────────────────────────────────────────────────
[webhooks]
api_version = "2025-01"

  [[webhooks.subscriptions]]
  topics = ["app/uninstalled"]
  uri = "/webhooks/app-uninstalled"

  [[webhooks.subscriptions]]
  compliance_topics = ["customers/redact", "customers/data_request", "shop/redact"]
  uri = "/webhooks/compliance"

# ── Build / Dev ──────────────────────────────────────────────────────────────
[build]
automatically_update_urls_on_dev = true
dev_store_url = "rana-furniture.myshopify.com"
```

### Key Fields for This App

| Field | Value | Why |
|---|---|---|
| `embedded = true` | true | Renders inside Shopify admin iframe |
| `scopes` | `read_products,read_inventory,read_locations` | Minimum for audit — read-only |
| `access.direct_api_mode` | `"offline"` | For background scans without user present |
| `dev_store_url` | `rana-furniture.myshopify.com` | Sets default dev store for `shopify app dev` |

---

## Build Order

Build the app in this sequence to validate each layer before adding complexity:

### Phase 1 — Scaffold & Auth (Day 1)
1. `shopify app init` → choose Remix template
2. Set up `.env` with API key/secret from Partners dashboard
3. `shopify app dev --store rana-furniture.myshopify.com`
4. Verify the app installs and the default index page loads in the admin iframe
5. Confirm `authenticate.admin()` works and returns a valid shop session

### Phase 2 — Read Products (Day 1–2)
6. Add a `app.products.tsx` route with a loader that calls `admin.graphql()` with the products query
7. Render a basic table of product titles, SKUs, and inventory quantities
8. Verify data is live from Rana Furniture

### Phase 3 — Audit Logic (Day 2–3)
9. Define what "audit checks" mean: missing descriptions, no images, zero inventory, missing barcodes, etc.
10. Write pure functions that take product data and return pass/fail results
11. Render audit results in the UI (Polaris DataTable, Badge for pass/fail)

### Phase 4 — Deploy (Day 3)
12. `fly launch` (or Render/Railway setup)
13. Set environment variables on the host
14. `shopify app deploy` to push TOML config to Shopify
15. Test via the Partners dashboard preview link

### Phase 5 — Multi-Store Generalisation
16. Ensure the session storage (Prisma) correctly isolates data by shop domain
17. Test installing on a second test store
18. Add a store selector or separate installs for each client store
19. Consider whether this becomes a Partners-distributed app or stays as custom/unlisted

### Extension Consideration (Future)
- **Admin block** extension: surface a quick audit summary card directly on the product detail page in the admin (no need to navigate to your app's main page)
- **Admin action** extension: add a "Run Audit" button to the product list page
- These are optional — the embedded app home is sufficient for the first version

---

## Sources

- [Shopify App Bridge](https://shopify.dev/docs/apps/tools/app-bridge)
- [Shopify Authentication & Authorization](https://shopify.dev/docs/apps/build/authentication-authorization)
- [Session Tokens](https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens)
- [Access Tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens)
- [App Configuration (TOML)](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration)
- [App Extensions List](https://shopify.dev/docs/apps/build/app-extensions/list-of-app-extensions)
- [Deployment Overview](https://shopify.dev/docs/apps/launch/deployment)
- [`shopify app dev` CLI reference](https://shopify.dev/docs/api/shopify-cli/app/app-dev)
- [Shopify Remix Template (GitHub)](https://github.com/Shopify/shopify-app-template-remix)
