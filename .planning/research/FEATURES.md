# Features Research: Shopify App Capabilities

_Research date: 2026-03-19. Sources: shopify.dev documentation._

---

## Table Stakes (must have or app won't work)

These are non-negotiable. Missing any one of them will prevent installation, cause app rejection, or break the OAuth flow.

### 1. OAuth + Session Tokens (Complexity: Medium)
- The app must complete OAuth authorization immediately on install before any other action.
- Embedded apps must use **session tokens** (App Bridge) — not cookies, not localStorage — to authenticate frontend requests to the backend.
- Since this is a background data-reading app, use **offline access tokens** (introduced expiring variant December 2025: 1-hour TTL with 90-day refresh token). These allow the app to read data via webhooks or scheduled jobs without a logged-in merchant session.
- Online tokens are not appropriate for a background sync tool.

### 2. Three Mandatory GDPR/Privacy Webhooks (Complexity: Low — just endpoints that acknowledge)
All distributed apps must implement these POST endpoints with HMAC validation:
- `customers/data_request` — merchant's customer requests their data; app must respond within 30 days.
- `customers/redact` — merchant's customer requests deletion; app must delete within 30 days.
- `shop/redact` — store uninstalls; app must delete all shop data within 30 days.
- Must return HTTP 200-series. Must return HTTP 401 on invalid HMAC. Must be registered in `shopify.app.toml` under `[webhooks]`.
- **Even a read-only app that stores nothing still needs these endpoints.** App Store review rejects apps without them.

### 3. Privacy Policy (Complexity: Trivial)
- A valid, publicly accessible privacy policy URL is required for App Store listing.
- Must accurately describe what data is collected and retained.

### 4. Access Scopes Declaration (Complexity: Low)
- Scopes must be declared in `shopify.app.toml` and requested during OAuth.
- Requesting more scopes than needed will surface a warning during merchant install that reduces conversion.
- Minimum scopes for this app (see API Capabilities section for full list).

### 5. App Home Page / Embedded UI (Complexity: Medium)
- The app must render at least one page inside the Shopify admin (embedded via App Bridge / Polaris).
- The embedded page loads within an iframe inside `admin.shopify.com`. App Bridge handles the communication between the iframe and the Shopify admin shell (navigation, session tokens, toast notifications, modals).
- Shopify validates that the app renders correctly during review.
- Tech stack: **@shopify/app-bridge-react** + **@shopify/polaris** is the standard; Remix with Shopify CLI scaffolding is the current recommended path.

### 6. SSL / HTTPS (Complexity: None if hosted on Vercel/Render/Fly)
- All endpoints must be HTTPS with valid certificates.
- Shopify rejects non-HTTPS callback URLs.

### 7. Performance — Lighthouse Score (Complexity: Low awareness, Medium to maintain)
- App Store review tests Lighthouse performance on the merchant's storefront (not the app's pages) — weighted: product detail pages 40%, collection pages 43%, home 17%.
- A read-only embedded app that doesn't inject any storefront code will not impact these scores.
- **Avoid injecting any JavaScript into the storefront for v1.**

### 8. Supported API Version (Complexity: Low — just pin the version)
- Must use an API version that is not within 90 days of deprecation.
- Current stable: `2026-01`. Pin this in the app config and set a quarterly reminder to bump it.

---

## Differentiators (competitive advantage for a monitoring tool)

These are not required but represent the value proposition of building this specifically for IT Geeks' clients.

1. **Bulk product sync for large catalogs** — Using `bulkOperationRunQuery` to pull all 2,482 Rana Furniture products in a single background job rather than paginating 250 at a time. This is the key architectural advantage over naive REST polling.

2. **Inventory monitoring across locations** — `InventoryLevel` connects each `InventoryItem` to each `Location` with quantity states: available, on-hand, incoming, committed. A dashboard showing per-location inventory health is immediately useful to furniture merchants.

3. **Out-of-stock alerting** — `hasOutOfStockVariants` and `totalInventory` on the Product object enable threshold-based alerting without expensive variant-by-variant queries.

4. **Metafield visibility** — Furniture merchants commonly store custom fields (dimensions, materials, lead times, supplier SKUs) in metafields. Surfacing these alongside standard product data is high value and not available in native Shopify admin views.

5. **Product status change tracking** — Monitoring `status` (active/draft/archived) changes via webhooks lets IT Geeks flag accidental deactivations immediately.

6. **Multi-client architecture** — Because IT Geeks is a Platinum Partner managing multiple stores, the app's data model should be store-scoped from day one, even for v1 with a single client. This avoids a painful architectural migration later.

7. **Published-at / updated-at audit trail** — Shopify surfaces `createdAt`, `updatedAt`, `publishedAt` per product. A simple change-log view is a high-value feature with zero additional API cost.

8. **Variant option completeness checks** — Detecting SKUs with missing barcodes, prices set to $0, or options that produce nonsensical variant combinations (e.g., "N/A / N/A") is highly useful for catalog QA.

---

## Anti-Features (things to deliberately NOT build in v1)

| Anti-feature | Why not |
|---|---|
| Write/mutation capabilities | Dramatically expands OAuth scope footprint, increases security surface, requires write-scoped review, and is out of scope for a monitoring tool. |
| Storefront API / customer-facing features | Adds unauthenticated scopes, storefront injection risk, Lighthouse score impact. Zero value for a B2B monitoring tool. |
| Billing API integration | Custom/unlisted apps cannot charge merchants via Shopify Billing API. Even if building a public app later, don't design v1 around billing. |
| Webhook for every product event | `products/create`, `products/update`, `products/delete` are useful but high-volume on a 2,482-product store. Start with scheduled bulk syncs; add event webhooks once the data pipeline is stable. |
| Shopify Flow / Functions / Theme Extensions | Complex, require separate review tracks, and have no relevance to a read-only monitoring dashboard. |
| Real-time inventory streaming | Shopify has no streaming API. Real-time means polling with rate limit cost; bulk operations are the correct pattern for large catalogs. |
| Custom metafield definitions (MetafieldDefinition mutations) | Read metafields, don't own their definitions. Defining metafields in another merchant's store is intrusive and scoped under write permissions. |
| User account system / custom auth | Use Shopify session tokens exclusively. Building a separate login system creates friction and security risk. |

---

## API Capabilities

### Core Read Scopes (request only what is needed)

| Scope | Grants Access To | Required For This App |
|---|---|---|
| `read_products` | Product, ProductVariant, Collection, ResourceFeedback | Yes — core |
| `read_inventory` | InventoryLevel, InventoryItem | Yes — core |
| `read_locations` | Location | Yes — needed with read_inventory |
| `read_metaobjects` | Metaobject (custom structured metadata) | Yes — Rana Furniture likely uses these |
| `read_metaobject_definitions` | MetaobjectDefinition (schema of metaobjects) | Yes — needed to interpret metaobject data |
| `read_purchase_options` | SellingPlan | Optional — only if monitoring subscriptions |

**Note:** Standard product metafields (namespace + key on Product/Variant) are accessible under `read_products` — no extra scope needed. `read_metaobjects` is specifically for standalone Metaobject records.

### Key GraphQL Objects for This App

**Product**
- `title`, `handle`, `status` (active/draft/archived), `vendor`, `productType`, `tags`
- `totalInventory`, `hasOutOfStockVariants`, `variantsCount`
- `options` (e.g., Color, Size)
- `variants` (connection) — see below
- `metafields` (connection, namespace + key + value)
- `collections` (connection)
- `media` (images, video, 3D models)
- `createdAt`, `updatedAt`, `publishedAt`, `onlineStoreUrl`
- `resourcePublications` (which sales channels it's published to)

**ProductVariant**
- `sku`, `barcode`, `price`, `compareAtPrice`
- `inventoryQuantity`, `inventoryItem`
- `selectedOptions` (the option values, e.g., "Red / Large")
- `weight`, `weightUnit`
- `metafields`

**InventoryLevel** (requires `read_inventory`)
- Connects one `InventoryItem` to one `Location`
- `quantities` — multiple named states: available, on_hand, incoming, committed, reserved
- `updatedAt`

**InventoryItem**
- `sku`, `tracked`, `unitCost`, `countryCodeOfOrigin`

**Location**
- `name`, `address`, `isActive`, `fulfillmentService`

**Metafield** (on any resource)
- `namespace`, `key`, `type`, `value`, `jsonValue`
- `ownerType` — which resource type owns it (PRODUCT, PRODUCTVARIANT, etc.)

### Products Query Filters (useful for incremental sync)
- `updated_at:>TIMESTAMP` — pull only products changed since last sync
- `status:active` — filter by publication state
- `out_of_stock_somewhere:true` — quickly surface inventory issues
- `inventory_total:<N` — low-stock threshold queries
- `vendor:NAME`, `product_type:TYPE` — supplier/category segmentation

---

## Rate Limits & Bulk Operations

### Standard GraphQL Rate Limits (cost-based leaky bucket)

| Plan | Restore Rate | Max Bucket |
|---|---|---|
| Basic/Standard | 100 points/sec | ~1,000 burst |
| Advanced Shopify | 200 points/sec | ~2,000 burst |
| Shopify Plus | 1,000 points/sec | ~10,000 burst |
| Enterprise (CCs) | 2,000 points/sec | ~20,000 burst |

- **Single query hard cap: 1,000 points**, regardless of plan. A query fetching 250 products with variants + metafields can easily hit this.
- Response headers include throttle status: current available points and max capacity.
- On throttle: catch the `THROTTLED` error code and back off 1 second before retry.
- **Rana Furniture (2,482 products) at 250/page = 10 paginated requests minimum for titles alone. With variants + inventory + metafields, each page is expensive.**

### Bulk Operations Pattern (correct approach for large catalogs)

Bulk operations bypass per-query cost limits and rate limits entirely. Use for all full syncs.

**How it works:**
1. Call `bulkOperationRunQuery` mutation with a query that includes at least one connection field.
2. The operation runs server-side asynchronously. Poll `currentBulkOperation { status }` or subscribe to `bulk_operations/finish` webhook.
3. When status = `COMPLETED`, fetch the `url` field — it's a download link to a JSONL file.
4. Parse the JSONL file: each line is a JSON object representing one node. Related objects (e.g., variants of a product) include a `__parentId` field.
5. `url` and `partialDataUrl` expire after **7 days**.

**Constraints:**
- One active bulk query per shop at a time (plus one bulk mutation).
- Max connection depth: 2 levels of nesting.
- Max connections in one query: 5.
- Enabling object grouping in JSONL output slows operations and increases timeout risk — avoid.
- No separate rate limit; these are designed for large exports like 2,482+ products.

**Recommended sync strategy for this app:**
- Full bulk sync on install (all products + variants + inventory + metafields).
- Scheduled bulk sync nightly or every N hours for full refresh.
- Incremental sync via `updated_at` filter using standard paginated queries (250/page) for near-real-time updates between bulk syncs.
- `products/update` and `inventory_levels/update` webhooks for event-driven delta updates once the pipeline is stable.

---

## Dependencies Between Features

```
OAuth / Access Token
    └── Everything else depends on this

Offline Access Token
    └── Background sync jobs (bulk operations, scheduled queries)
    └── Webhook handlers (GDPR, product events)

read_products scope
    └── Product list / detail views
    └── Variant data
    └── Collection membership
    └── Product metafields (included in this scope)

read_inventory scope
    └── InventoryLevel queries
    └── Per-location stock views
    └── Out-of-stock alerts
        └── Depends on: read_locations (to name locations)

read_metaobjects scope
    └── Metaobject display (standalone custom content objects)
    └── read_metaobject_definitions (to interpret schema)

Bulk Operation query
    └── Depends on: offline access token (background job, no user session)
    └── Depends on: all relevant read scopes declared at install time
    └── Produces: JSONL file on Shopify's CDN (your backend downloads it)
    └── Powers: full catalog sync, initial data load

Incremental sync (paginated products query with updated_at filter)
    └── Depends on: offline token + read_products + read_inventory
    └── Depends on: storing last_synced_at timestamp per shop

App Home Page (embedded admin UI)
    └── Depends on: App Bridge (session tokens)
    └── Depends on: your backend having already synced data to display
    └── Depends on: Polaris components for Shopify-native look/feel

GDPR Webhooks
    └── Independent of all other features
    └── Must be functional before app can be published
    └── Must validate HMAC on every request
```

### Critical path for v1:
1. OAuth + offline token storage
2. GDPR webhooks (unblocks App Store submission)
3. Bulk operation on install (seeds the database)
4. App home page showing product/inventory data from local DB
5. Scheduled re-sync job

Everything else is iterative on top of this foundation.

---

## App Distribution Note for IT Geeks

As a Shopify Platinum Partner, IT Geeks has two viable paths:

- **Custom app (recommended for v1):** Installed on a single store (or multiple stores in the same Plus org). No Shopify approval required. Cannot use Billing API. Fastest path to getting Rana Furniture live.
- **Public/unlisted app:** Requires Shopify review. Enables Billing API for recurring charges. Required if IT Geeks wants to roll this out to all partner clients as a paid product.

For v1 with Rana Furniture: build as a custom app. Design the data model to be multi-tenant from the start so the transition to a public/partner app is an ops change, not a re-architecture.
