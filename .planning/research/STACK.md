# Stack Research: Shopify App Development

> Researched: March 2026
> Context: Read-only embedded admin app, installable on client stores, built by IT Geeks (Shopify Platinum Partner)
> Sources: shopify.dev official documentation

---

## Recommended Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | React Router v7 (via Shopify template) | Shopify's official recommended template as of 2026 |
| Backend/Auth | `@shopify/shopify-app-react-router` | The framework adapter for React Router (replaces the older Remix adapter) |
| API Client | `@shopify/shopify-api` | Built-in via the template; used for Admin GraphQL queries |
| Session Storage | Prisma + SQLite | Default in the scaffold; swap to Prisma + PostgreSQL for production |
| UI | Polaris + App Bridge | Polaris for components, App Bridge for admin embedding |
| Language | TypeScript | Default in all official templates |
| CLI | Shopify CLI (global, v3.90+) | `npm install -g @shopify/cli` |
| Admin API Version | `2026-01` (latest stable) | `2026-04` is currently a release candidate |

---

## App Scaffold

### Create a new app

```bash
npm install -g @shopify/cli
shopify app init
```

- When prompted for a template, select **React Router** (the default and recommended choice)
- The Remix template still exists but Shopify now recommends React Router
- An extension-only template is also available (no full-stack UI)

### Development workflow

```bash
cd my-new-app
shopify app dev        # starts local server with tunnel + file watching
# Press 'p' to preview and install on your dev store
```

### Key CLI commands relevant to this project

```
shopify app init          # create new app
shopify app dev           # local dev with tunnel
shopify app deploy        # build and deploy to Shopify Partners
shopify app config link   # pull config from Developer Dashboard
shopify app env pull      # sync .env from Shopify
shopify app execute       # run Admin API GraphQL queries from CLI
shopify app logs          # stream real-time app logs
```

---

## Key Packages

### `@shopify/shopify-app-react-router`
The main framework adapter. Wraps `@shopify/shopify-api` and provides:
- `shopifyApp()` — creates the backend auth/session object
- `authenticate.admin(request)` — handles OAuth and session token validation in loaders/actions
- `AppProvider` — React component that sets up App Bridge and Polaris in the frontend
- `boundary` — utilities for error boundaries and CSP headers
- Auto-handles token refresh, session management, and security headers

### `@shopify/shopify-api`
The underlying Node.js client (no framework dependency). Provides:
- Raw GraphQL client for Admin API calls
- OAuth utilities
- Webhook handling
- Session interfaces

### `@shopify/shopify-app-remix`
**Note:** This is the older Remix-specific adapter. Shopify has moved toward `@shopify/shopify-app-react-router`. If you scaffolded an app before ~late 2025, you likely have the Remix version. The API surface is nearly identical. For new projects, use the React Router package.

### App Bridge
A JavaScript library (no separate npm install needed when using the template) that:
- Embeds your app pages inside the Shopify admin iframe
- Communicates with Shopify admin via JS message passing
- Powers navigation menus, title bars, save bars, and modal components
- Built on web components; components render in the admin UI, NOT in your component hierarchy
- Works via `AppProvider` from the framework adapter

### Polaris (`@shopify/polaris`)
Shopify's design system:
- React component library for building admin-consistent UIs
- Design tokens, icons, layout primitives
- Installed and configured automatically via the template's `AppProvider`

### Prisma + SQLite (session storage)
- The scaffold creates a SQLite database via Prisma for session storage
- `prisma/schema.prisma` contains the `Session` model
- **For production/multi-tenant use**, replace SQLite with PostgreSQL or another production database
- Shopify's `@shopify/shopify-app-react-router` accepts any Prisma-compatible session storage adapter

---

## Authentication

### Recommended approach for embedded apps (2026): Token Exchange

Shopify's current recommendation for embedded apps is:

1. **Shopify Managed Installation** — Shopify handles the app installation flow automatically
2. **Token Exchange** — Instead of traditional OAuth redirects, the app's frontend acquires a session token via App Bridge, then exchanges it server-side for an access token

This is enabled via a feature flag in `shopify.server.ts`:
```ts
shopifyApp({
  // ...
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
})
```

**Why this matters:** Token exchange eliminates OAuth redirect friction. The merchant never leaves the admin. This is the strategy featured in Shopify's starter template.

### Traditional OAuth (Authorization Code Grant) — still supported

For non-embedded apps or cases where token exchange isn't suitable:
1. Merchant installs app → request hits your `/app/routes/auth/$.tsx` splat route
2. `authenticate.admin(request)` initiates OAuth redirect to Shopify
3. Merchant approves scopes on Shopify's grant screen
4. Shopify redirects back with authorization code
5. Your app exchanges code for access token via POST to `/admin/oauth/access_token`
6. Token stored in session storage (Prisma/SQLite)

**The template handles all of this automatically** — you do not write this code manually.

### Token types

| Type | Lifetime | Scope | Use case |
|---|---|---|---|
| Offline access token | Long-lived (permanent) | Store-scoped | Background jobs, webhooks, reading store data |
| Online access token | Time-limited (user session) | User + store scoped | Actions tied to a specific merchant user |

For a **read-only app that reads store data**, use **offline access tokens**.

### Session storage

- Default: Prisma + SQLite (`prisma/schema.prisma` → `Session` model)
- The `shopifyApp()` config accepts a `sessionStorage` adapter
- For production: switch to Prisma + PostgreSQL or use `@shopify/shopify-app-session-storage-postgresql`

---

## API Client

### How Admin GraphQL works in the template

`authenticate.admin(request)` returns an `admin` object with a `graphql` helper:

```ts
// In a loader or action
export async function loader({ request }) {
  const { admin } = await shopify.authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      shop {
        name
        myshopifyDomain
      }
    }
  `);

  const data = await response.json();
  return data;
}
```

This uses `@shopify/shopify-api` under the hood with the stored session token — no manual auth headers needed.

### Current Admin API version: `2026-01`

- Latest stable: `2026-01`
- Release candidate: `2026-04`
- Endpoint: `https://{store}.myshopify.com/admin/api/2026-01/graphql.json`
- Set in `shopify.server.ts` via `apiVersion: ApiVersion.January26`

### GraphQL client options

| Option | Verdict |
|---|---|
| `admin.graphql()` from `authenticate.admin()` | **Recommended** — fully managed, auto-auth |
| `@shopify/admin-api-client` | Not referenced in 2026 docs; may be for standalone use |
| Raw `fetch` with manual token | Works but bypasses all the framework's session management |
| Apollo Client / urql | Overkill for server-side API calls; can be used client-side if needed |

**Use `admin.graphql()` from `authenticate.admin()`** for all server-side Admin API calls.

---

## Distribution for Client Stores

For IT Geeks building an app installable on client stores:

- Use **public distribution** or **custom distribution** (for specific clients)
- Public apps require Shopify App Store review (can be unlisted)
- Custom apps can be installed via direct install link without App Store review — suitable for specific client engagements
- The distribution method is **permanent** — choose at app creation time
- Recommended for a reusable partner template: start as **unlisted public app** so it can be installed on any client store via a shareable install URL

---

## What NOT to Use

| Approach | Why to avoid |
|---|---|
| Next.js template | Shopify dropped Next.js as an official template; community-maintained only |
| `@shopify/shopify-app-remix` (for new projects) | Superseded by `@shopify/shopify-app-react-router` |
| Manual OAuth implementation | The template handles this; reinventing it adds security risk |
| Online access tokens for background data reads | Use offline tokens for store data access that persists beyond user sessions |
| Raw `fetch` for Admin API | Bypasses session management; use `admin.graphql()` instead |
| SQLite in production | SQLite is file-based; won't work properly in serverless/multi-instance deploys |
| Older `embedded_app_sdk` / legacy App Bridge v1/v2 | Replaced by current App Bridge (built on web components) |
| `shopify-node-api` (community package) | Use official `@shopify/shopify-api` |

---

## Confidence Levels

| Recommendation | Confidence | Notes |
|---|---|---|
| React Router template via `shopify app init` | High | Confirmed in official docs as primary recommendation |
| `@shopify/shopify-app-react-router` as main package | High | Confirmed in Admin API docs as the React Router adapter |
| Token exchange as preferred embedded auth strategy | High | Explicitly documented as "recommended whenever possible" |
| Prisma + SQLite for dev, PostgreSQL for prod | High | SQLite is default scaffold; PostgreSQL is standard production choice |
| `admin.graphql()` for API calls | High | Shown in official code examples throughout docs |
| Admin API version `2026-01` | High | Confirmed as current stable in API docs |
| Shopify CLI v3.90+ | Medium | Version 3.90.1 mentioned in changelog; exact latest not confirmed |
| App Bridge auto-included via AppProvider | High | Confirmed — no separate App Bridge install needed with the adapter |
| Polaris for UI components | High | Consistently recommended alongside App Bridge in all admin app docs |
| Public (unlisted) distribution for partner template | Medium | Based on distribution model docs; specific partner workflow not confirmed |

---

## Summary for This Project

For a **read-only embedded admin app** that reads store data and serves as a template for future IT Geeks apps:

1. Scaffold with `shopify app init` → React Router template
2. Use `@shopify/shopify-app-react-router` with token exchange auth strategy
3. Use offline access tokens (store-scoped, persistent)
4. Read data with `admin.graphql()` in route loaders — no separate GraphQL client needed
5. Use Polaris components for UI — already configured via `AppProvider`
6. Session storage: Prisma + SQLite for dev; swap to PostgreSQL before deploying to clients
7. Distribution: set up as an unlisted public app so it can be installed on any client store
