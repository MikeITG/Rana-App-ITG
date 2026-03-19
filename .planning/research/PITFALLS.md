# Pitfalls Research: Shopify App Development

**Context:** IT Geeks building a read-only embedded Shopify app. First Shopify app build.
Starting with Rana Furniture (2,482 products), then generalizing to multi-store.
**Sources:** Shopify official documentation (March 2026 versions)

---

## Critical Mistakes (will break your app)

### 1. Using outdated API versions
**What happens:** When a Shopify API version becomes unsupported, Shopify "falls forward" and
treats your requests as if you used the oldest currently-supported stable version. For **public
apps**, continued use of unsupported resources results in App Store delisting, installation
warnings shown to merchants, and temporary installation blocking.

**Shopify's release cadence:** Quarterly releases (Jan 1, Apr 1, Jul 1, Oct 1). Each stable
version is supported for a minimum of 12 months. As of 2026-03, the latest stable is `2026-01`.
The oldest still-supported version is `2025-04` (approximately — check changelog).

**Prevention:**
- Pin a specific stable version in all API calls (never use `unstable` in production)
- Calendar a quarterly review to update the pinned version before it ages out
- Subscribe to the Shopify developer changelog

---

### 2. Using deprecated Product model fields
**What changed:** The product model has migrated away from several old fields. Using deprecated
fields will eventually return errors.

| Deprecated Field | Use Instead |
|---|---|
| `bodyHtml` | `descriptionHtml` |
| `customProductType` | Standard taxonomy `category` |
| `featuredImage` | `featuredMedia` |
| `images` | `media` (now supports images, video, 3D models) |
| `priceRange` | `priceRangeV2` |
| `productPublications` | `resourcePublications` |
| `publications` | `resourcePublicationsV2` |
| `publishable_status` (REST) | `published_status` |

**For Rana Furniture specifically:** With 2,482 products and potential variants/media, always
use the current field names. Building GraphQL queries against deprecated fields will require
rework when those fields are removed.

**Prevention:** Build all GraphQL queries against the `2026-01` schema from the start.
Audit field names against the official reference before writing query files.

---

### 3. Pagination cap of 25,000 objects
**What happens:** Shopify's Admin API will only paginate through a maximum of 25,000 objects.
Counts exceeding 25,000 return `25001` as a signal that more exist — but you cannot page past
that boundary. For stores larger than this threshold, cursor-based pagination strategies must
account for this hard ceiling.

**For Rana Furniture:** 2,482 products is well under the limit, but variants + metafields could
push you toward it if you're fetching nested data deeply.

**Prevention:** Design pagination loops to handle the 25,001 sentinel value gracefully. Never
assume a `hasNextPage: false` means you got everything if you haven't validated total counts.

---

### 4. Query cost ceiling of 1,000 points per single GraphQL request
**What happens:** No matter your Shopify plan tier, a single GraphQL query cannot exceed 1,000
points. Deeply nested queries (e.g., products → variants → metafields → images) accumulate cost
quickly. Connections cost points proportional to their `first`/`last` argument.

**Cost rules:**
- Scalars/Enums: 0 points
- Objects: 1 point
- Connections: sized by `first`/`last` argument value
- Mutations: 10 points base

**Prevention:** Use Shopify's query cost estimator during development. Keep product listing
queries shallow and paginate deeper data separately.

---

### 5. Ignoring rate limit errors instead of backing off
**What happens:** If your app keeps making requests after receiving throttle errors (HTTP 429),
it cannot gracefully recover. The leaky bucket empties at 1 request/second (varies by plan),
and overflowing it locks you out until it drains.

**Rate limits by plan (GraphQL Admin API):**
- Standard: 100 pts/sec
- Advanced: 200 pts/sec
- Plus: 1,000 pts/sec
- Enterprise: 2,000 pts/sec

**Prevention:**
- Implement retry logic with at minimum a 1-second backoff on 429 responses
- Read the `X-Shopify-Shop-Api-Call-Limit` (REST) or `extensions.cost.throttleStatus`
  (GraphQL) headers on every response to track bucket state
- Cache responses — repeated identical queries for 2,482 products waste your capacity

---

## Authentication Traps

### 1. Using the wrong OAuth flow for embedded vs non-embedded
**What happens:** Token exchange (the modern, preferred flow) only works for **embedded apps**.
Non-embedded apps must use the authorization code grant flow. Mixing them causes integration
failures.

**For this project:** Since you're building an **embedded** app, use token exchange + Shopify
managed installation. This eliminates redirect loops and page flickers.

**Prevention:**
- Configure access scopes via Shopify CLI — this enables Shopify managed installation
- If you skip CLI scope configuration, Shopify forces you into the legacy authorization code
  grant flow, degrading UX
- Use the Shopify CLI starter app template which pre-wires correct auth boilerplate

---

### 2. Confusing session tokens with API access tokens
**What happens:** Session tokens (1-minute lifespan, fetched via App Bridge) authenticate that
the browser request comes from within the Shopify admin. They do **not** authorize calls to the
Shopify Admin API. You need a separate OAuth access token for API calls.

**Common mistake:** Using a session token as a Bearer token in Admin API calls → 401 errors.

**Prevention:**
- Session token = prove this is a legitimate embedded request from an admin user
- Access token (online or offline) = authorize API calls
- Use the Shopify app libraries (`@shopify/shopify-app-express`, etc.) which handle this
  distinction automatically

---

### 3. Session token 1-minute expiry and stale token usage
**What happens:** Session tokens expire after exactly 1 minute. Caching them or reusing them
across requests causes validation failures.

**Prevention:**
- Always fetch a fresh session token via App Bridge for each request
- Never cache session tokens server-side or in localStorage beyond a single request cycle

---

### 4. Third-party cookies breaking auth in browsers
**What happens:** Modern browsers (Safari, Firefox, Chrome with strict settings) block
third-party cookies. Embedded Shopify apps run in an iframe, making them subject to these
restrictions. Cookie-based session management breaks in this context.

**Prevention:**
- Use session tokens (App Bridge) instead of cookies for any embedded auth flow
- This is also why Shopify mandates the session token approach for embedded apps

---

### 5. Online vs offline access tokens — choosing wrong for the use case
**Distinction:**
- **Online tokens** are tied to a specific admin user, expire when that user's session ends,
  and are appropriate for user-interactive requests
- **Offline tokens** are permanent (until revoked), store-scoped, and appropriate for
  background jobs, webhooks, and automated tasks

**For this project (read-only monitoring):** You likely need an offline token to enable
background syncing of product data without requiring a user to be logged in. Building with
only online tokens will break any scheduled or webhook-triggered data refresh.

---

### 6. Not using Shopify-managed installation
**What happens:** Custom installation flows are prone to state parameter CSRF attacks, nonce
mismatches, and redirect loop bugs. Shopify managed installation handles all of this.

**Prevention:** Avoid building a custom OAuth flow. Let Shopify CLI and the managed installation
handle the installation handshake.

---

## API Gotchas

### 1. Array input maximum of 250 items
All input arguments that accept arrays are capped at 250 items. Bulk operations (e.g., fetching
products by ID list) that exceed 250 IDs will fail. Design batch operations to stay under this
limit.

### 2. `publishable_status` REST parameter deprecated as of API 2025-12
Migrate to `published_status` for all visibility/publishing checks. This affects product
filtering queries.

### 3. GraphQL vs REST — REST is the legacy path
Shopify is investing in GraphQL. New features (combined listings, contextual pricing, bundles)
are GraphQL-only. Building on REST today means migration work tomorrow.

**For Rana Furniture:** With 2,482 products and likely complex variant structures, the GraphQL
Admin API gives much better query flexibility and cost-efficiency than REST.

### 4. Webhook delivery is not guaranteed in order
Webhooks can arrive out of sequence or be delivered more than once.
- Use `X-Shopify-Triggered-At` or the payload's `updated_at` field to order events
- Use `X-Shopify-Event-Id` header to detect and deduplicate repeated deliveries

### 5. HTTP header case sensitivity in webhooks
Webhook header names are case-insensitive per HTTP spec, but apps that hardcode specific casing
(e.g., only checking `X-Shopify-Hmac-Sha256` not `x-shopify-hmac-sha256`) break on some
infrastructure. Use case-insensitive header lookups.

### 6. No Storefront API rate limits (but Admin API limits are real)
The Storefront API has no rate limits; the Admin API has strict ones. Don't mistake this — all
admin reads go through the rate-limited API.

---

## Compliance Requirements

### Mandatory GDPR Compliance Webhooks (for public apps)
All apps distributed through the Shopify App Store must implement **three compliance webhooks**:

| Webhook Topic | Purpose | Deadline to Act |
|---|---|---|
| `customers/data_request` | Merchant requests to see what customer data your app stores | Provide the data |
| `customers/redact` | Request to delete a specific customer's data | Delete within 30 days |
| `shop/redact` | Request to delete all store data after uninstall | Delete within 30 days (sent 48 hrs after uninstall) |

**Technical requirements for each endpoint:**
- Accept POST with `Content-Type: application/json`
- Validate the `X-Shopify-Hmac-Sha256` header; return `401 Unauthorized` if invalid
- Return a 2xx status code to confirm receipt
- Complete the actual data action within 30 days

**Consequences of non-implementation:** App will be rejected and require resubmission.

**Exception:** If you are legally required to retain certain data, you are not obligated to
delete it under the `customers/redact` or `shop/redact` webhooks — but you must still implement
the endpoints and respond to the requests.

### For custom apps (single-store, like starting with Rana Furniture)
Custom apps distributed to a single store do **not** require App Store review or approval.
The three GDPR compliance webhooks are mandatory for **public** App Store apps. However, it is
strongly recommended to implement them from day one, since:
1. You plan to generalize to multi-store (which will require public distribution)
2. It is much cheaper to build in compliance now than retrofit later
3. IT Geeks as a Platinum Partner should maintain professional standards

---

## Deployment Issues

### 1. Missing HTTPS / valid SSL certificate
Shopify will not deliver webhooks to HTTP endpoints. All webhook endpoints must use HTTPS with
a valid (non-self-signed) SSL certificate. This applies to development tunnels too (ngrok/
Cloudflare Tunnel provide valid certs automatically).

### 2. Using old ngrok versions or unstable tunnels during development
Shopify CLI recommends using its built-in tunnel (Cloudflare Tunnel via `shopify app dev`).
Old versions of ngrok with ephemeral domains cause issues because the tunnel URL changes on
restart, invalidating the app URL configured in the Partner Dashboard.

**Prevention:** Use `shopify app dev` which manages the tunnel automatically, or use a paid
ngrok account with a fixed subdomain.

### 3. CLI version mismatch across a team
As of Shopify CLI 3.59.0, the `@shopify/app` package is bundled with `@shopify/cli` — you no
longer install them separately. Teams that have mixed versions will encounter inconsistent
behavior.

**Prevention:** Pin the CLI version as a local dev dependency in `package.json` so all team
members run the same version.

### 4. Shopify CLI requires specific directory structure
`shopify app dev` expects a conventional directory structure to serve the web app and app
extensions simultaneously. Deviating from the scaffold structure requires custom configuration
in `shopify.app.toml`.

### 5. Environment variable management
API keys, secrets, and database URLs must not be committed to source control. Shopify CLI
uses `.env` files locally; production deployments (Vercel, Railway, Heroku) need these set as
platform environment variables. The `shopify.app.toml` file itself does **not** contain secrets
but the `.env` file does.

### 6. App URL must be publicly accessible for webhooks during testing
During development, Shopify sends webhook events to your app's registered URL. If your dev
server is not reachable (tunnel down, wrong URL registered), you will miss webhook deliveries
and have no visibility into events. Use `shopify app dev` to keep the tunnel live.

---

## App Review Blockers

### Applies to: Public App Store distribution (required when going multi-store)
Custom single-store apps bypass review. But when IT Geeks generalizes this to a multi-store
offering (or lists it on the App Store), these apply:

### 1. Missing GDPR compliance webhooks
The three mandatory webhooks (`customers/data_request`, `customers/redact`, `shop/redact`)
must be implemented and subscribed **before submission**. This is the most common mechanical
rejection reason.

### 2. Requesting excessive API scopes
Apps must follow the principle of least privilege. Requesting write scopes when the app only
reads data is a review red flag. For a read-only app, only request read scopes.

**For this project:** Since it is read-only, you should only request:
- `read_products`
- `read_inventory` (if needed)
- `read_product_listings` (if needed)
- Never request `write_products`, `write_inventory`, etc.

### 3. Not following Polaris design guidelines
The embedded app UI must use Polaris (Shopify's design system) and look visually consistent
with the Shopify admin. Apps with custom/branded UIs that clash with admin styling can be
flagged during quality review.

### 4. Missing or non-functional test credentials
Reviewers need to be able to install and test the app. Apps submitted without test credentials,
or whose review accounts don't work, are rejected immediately.

### 5. App doesn't work in the embedded admin context
If the app breaks when loaded in the Shopify admin iframe (navigation errors, blank screens,
redirect loops), it fails review. Must be tested in the actual admin context, not just
standalone.

### 6. Using unsupported API versions
App Store review checks API version currency. Apps using API versions approaching end-of-life
will receive warnings; apps on already-unsupported versions can be blocked from installation.

### 7. Not implementing App Bridge for embedded navigation
Embedded apps must use App Bridge for navigation menus, title bars, and save bars. Using
browser-native navigation (back buttons, `<a href>` tags) inside the iframe breaks the
embedded experience and violates design guidelines.

### 8. Admin link overuse / disrupting merchant workflows
Apps that register excessive admin links or disrupt merchant workflows during normal operations
are flagged during review. Use admin links sparingly.

---

## Which Phase Should Address Each

### Phase 1: Initial setup (Rana Furniture, single-store, custom app)

| Pitfall | Action |
|---|---|
| Wrong API version | Pin `2026-01` in `shopify.app.toml` from day one |
| Deprecated product fields | Use `media` not `images`, `descriptionHtml` not `bodyHtml`, etc. |
| Wrong auth flow | Use Shopify CLI + token exchange from scaffold |
| Online vs offline token | Decide now: offline token for background sync |
| Rate limits | Implement retry + backoff from first API call |
| 25,000 pagination cap | Build paginator with sentinel handling |
| SSL / HTTPS | Use `shopify app dev` tunnel; no manual ngrok config |
| GDPR webhooks (stub) | Implement stub endpoints now, even if not required yet |
| Scope minimization | Request only `read_products` + what's strictly needed |
| Polaris | Use Polaris components from the start |

### Phase 2: Multi-store generalization

| Pitfall | Action |
|---|---|
| GDPR webhooks (full) | Complete full implementation with 30-day action logic |
| Session isolation | Ensure per-store session/token storage (never share tokens between stores) |
| Rate limit per store | Rate limits are per store per app — monitor each store independently |
| App review prep | Test GDPR endpoints, review Polaris compliance, verify scope list |
| API version currency | Confirm still on supported version before submission |

### Phase 3: App Store submission (if applicable)

| Pitfall | Action |
|---|---|
| Missing test credentials | Create reviewer account with access |
| Broken embedded experience | Full QA in Shopify admin iframe |
| Scope justification | Document why each scope is needed |
| App Bridge navigation | Audit all navigation for App Bridge compliance |
| API version check | Must be on supported version at submission time |

---

## Quick Reference: The 10 Things That Will Bite You

1. **Session tokens expire in 1 minute** — never cache them
2. **Session tokens != API access tokens** — they serve different purposes
3. **Third-party cookie blocking** — embedded apps must use session tokens, not cookies
4. **25,000 object pagination ceiling** — no way around it
5. **1,000 point single query ceiling** — keep queries shallow
6. **API versions expire** — calendar quarterly updates
7. **Three GDPR webhooks are mandatory** for App Store (build them now)
8. **Webhook delivery is not ordered or exactly-once** — handle duplicates and reordering
9. **Offline tokens for background jobs, online tokens for user-interactive flows**
10. **Deprecated product fields** — never use `images`, `priceRange`, `bodyHtml`, `featuredImage`

---

*Researched: March 2026. Sources: Shopify developer documentation (shopify.dev).*
*Primary docs consulted: privacy-law-compliance, authentication-authorization, api/usage/rate-limits,*
*api/usage/versioning, apps/build/webhooks, apps/build/admin, apps/distribution, apps/launch.*
