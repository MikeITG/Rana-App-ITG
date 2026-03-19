# Phase 1 Research: Project Setup & Data Pipeline

**Phase:** 1 — Setup & Data Pipeline
**Requirements addressed:** SETUP-01, SETUP-02, SETUP-03, SETUP-04, PULL-01, PULL-02, PULL-03, PULL-04, PULL-05, PULL-06, PULL-07
**Researched:** 2026-03-19
**Context:** CLI data tool, NOT an embedded Shopify admin app. No Polaris, no App Bridge, no iframe. Reads data via Shopify Admin API (GraphQL) and saves to local CSV/JSON files.

---

## 1. Shopify Custom App Creation (SETUP-01)

Mike creates this once in the Rana Furniture Shopify admin. No Partners dashboard needed — this is a store-level custom app used purely for API access.

### Step-by-step (Mike does this)

1. Log in to Rana Furniture Shopify admin
2. Go to **Settings → Apps and sales channels**
3. Click **Develop apps** (may need to enable custom app development first — click "Allow custom app development" if prompted)
4. Click **Create an app**
5. Enter app name: `Rana PM Monitor` — select yourself as app developer
6. Click **Configure Admin API scopes**
7. Select these scopes (read-only only):
   - `read_products` — products, variants, metafields, collections, media
   - `read_inventory` — inventory levels and items
   - `read_locations` — location names/addresses (needed with read_inventory)
8. Click **Save**
9. Click **Install app** — review the warning, click Install to confirm
10. Go to **API credentials** tab
11. Click **"Reveal token once"** — copy it immediately and store it securely

**Critical:** The token (format: `shpat_XXXXXX`) is displayed ONLY ONCE. If you miss it, you must uninstall and reinstall the app to generate a new one.

### What scopes cover

| Scope | What it unlocks |
|-------|----------------|
| `read_products` | Products, variants, metafields on products/variants, media/images, collections |
| `read_inventory` | InventoryLevel, InventoryItem, quantities per location |
| `read_locations` | Location names, addresses, active status |

Note: Standard product metafields (namespace + key on Product/Variant) are covered under `read_products` — no extra scope needed for `custom.*` metafields.

---

## 2. Node.js Project Setup (SETUP-02, SETUP-03)

This is a plain CLI tool — no Shopify CLI, no React Router template, no Polaris.

### Package decisions

| Need | Package | Why |
|------|---------|-----|
| GraphQL requests | `node-fetch` (or native `fetch` in Node 18+) | Raw HTTP calls — no need for @shopify/shopify-api which is overkill for a CLI tool |
| Environment variables | `dotenv` | Standard .env loading |
| CSV export | `csv-stringify` | Part of the node-csv ecosystem, stream-based, no dependencies, battle-tested |
| JSONL line streaming | Node built-in `readline` + `https` | No package needed; stream directly from remote URL |

### Project scaffold

```bash
mkdir rana-shopify-monitor
cd rana-shopify-monitor
npm init -y
npm install dotenv csv-stringify
```

### `.env` file (NEVER commit this)

```
SHOPIFY_STORE=y01sdh-0b.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_XXXXXX
SHOPIFY_API_VERSION=2026-01
```

### `.gitignore`

```
.env
snapshots/
node_modules/
```

### `src/config.js`

```javascript
import 'dotenv/config';

export const config = {
  store: process.env.SHOPIFY_STORE,
  token: process.env.SHOPIFY_ACCESS_TOKEN,
  apiVersion: process.env.SHOPIFY_API_VERSION || '2026-01',
  get endpoint() {
    return `https://${this.store}/admin/api/${this.apiVersion}/graphql.json`;
  },
};

if (!config.store || !config.token) {
  console.error('ERROR: Missing SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN in .env');
  process.exit(1);
}
```

### `src/client.js` — GraphQL client wrapper

```javascript
import { config } from './config.js';

export async function graphql(query, variables = {}) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();

  // Check for throttle errors
  if (json.errors) {
    const throttled = json.errors.find(e => e.extensions?.code === 'THROTTLED');
    if (throttled) {
      throw Object.assign(new Error('THROTTLED'), { isThrottle: true, extensions: json.extensions });
    }
    throw new Error(JSON.stringify(json.errors));
  }

  return json;
}
```

### `src/index.js` — CLI entry point

```javascript
import { pull } from './pull.js';

const command = process.argv[2];

switch (command) {
  case 'pull':
    await pull();
    break;
  default:
    console.log('Usage: node src/index.js pull');
}
```

### `package.json` — use ES modules

```json
{
  "name": "rana-shopify-monitor",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "pull": "node src/index.js pull"
  },
  "dependencies": {
    "csv-stringify": "^6.6.0",
    "dotenv": "^16.0.0"
  }
}
```

---

## 3. GraphQL Bulk Operations (PULL-01 through PULL-05)

### Why bulk operations (not paginated queries)

With 2,482 products, each with variants, metafields, and inventory, paginated queries (250 products/page × 10 pages) would be slow and expensive in API cost. The 1,000-point single query ceiling makes deeply nested paginated queries impractical.

Bulk operations:
- Run server-side asynchronously — no per-query rate limit cost during execution
- Handle any catalog size
- Return a JSONL download URL when done
- In API 2026-01+: up to 5 concurrent bulk queries per shop

### Step 1: Trigger the bulk operation

```javascript
const BULK_QUERY = `
mutation {
  bulkOperationRunQuery(
    query: """
    {
      products {
        edges {
          node {
            id
            title
            handle
            status
            vendor
            productType
            tags
            descriptionHtml
            totalInventory
            createdAt
            updatedAt
            publishedAt
            media(first: 10) {
              edges {
                node {
                  id
                  mediaContentType
                  status
                }
              }
            }
            metafields(first: 20) {
              edges {
                node {
                  namespace
                  key
                  value
                  type
                }
              }
            }
            variants {
              edges {
                node {
                  id
                  sku
                  barcode
                  price
                  compareAtPrice
                  inventoryQuantity
                  inventoryPolicy
                  weight
                  weightUnit
                  title
                  selectedOptions {
                    name
                    value
                  }
                  inventoryItem {
                    id
                    tracked
                  }
                }
              }
            }
          }
        }
      }
    }
    """
  ) {
    bulkOperation {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}
`;
```

**Important constraint:** Bulk operations support maximum 2 levels of nesting depth and maximum 5 connections total. The query above uses `media`, `metafields`, and `variants` as three nested connections on product — all within limits.

**Inventory levels are a separate concern:** Because InventoryLevel requires a 3rd nesting level (product → variant → inventoryItem → inventoryLevels), you cannot fetch inventory levels in the same bulk operation as products/variants. Run a separate bulk operation for inventory (see Section 5 below).

### Step 2: Poll for completion

In API 2026-01+, use the operation-specific query (not `currentBulkOperation` which is deprecated):

```javascript
const POLL_QUERY = `
query BulkOperationStatus($id: ID!) {
  bulkOperation(id: $id) {
    id
    status
    errorCode
    createdAt
    completedAt
    objectCount
    fileSize
    url
    partialDataUrl
  }
}
`;

async function pollBulkOperation(operationId) {
  console.log('Polling bulk operation...');

  while (true) {
    const result = await graphql(POLL_QUERY, { id: operationId });
    const op = result.data.bulkOperation;

    console.log(`  Status: ${op.status} | Objects: ${op.objectCount}`);

    if (op.status === 'COMPLETED') {
      return op.url;
    }

    if (op.status === 'FAILED') {
      throw new Error(`Bulk operation failed: ${op.errorCode}`);
    }

    if (op.status === 'CANCELED') {
      throw new Error('Bulk operation was canceled');
    }

    // Poll every 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}
```

Possible status values: `CREATED`, `RUNNING`, `COMPLETED`, `CANCELING`, `CANCELED`, `EXPIRED`, `FAILED`

### Step 3: Download and parse the JSONL file

The URL points to a Google Cloud Storage file. Use Node's built-in `https` + `readline` to stream parse it without loading the whole file into memory.

```javascript
import https from 'https';
import readline from 'readline';

export async function downloadJsonl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const rl = readline.createInterface({
        input: response,
        crlfDelay: Infinity,
      });

      const products = new Map();   // id → product object
      const variants = [];          // all variant records
      const mediaByProduct = {};    // productId → media array
      const metafieldsByProduct = {}; // productId → metafield array

      rl.on('line', (line) => {
        if (!line.trim()) return;
        const obj = JSON.parse(line);

        if (obj.__parentId) {
          // Child object — determine type by ID prefix
          const id = obj.id || '';

          if (id.includes('/ProductVariant/')) {
            variants.push({ ...obj, productId: obj.__parentId });
          } else if (id.includes('/MediaImage/') || obj.mediaContentType) {
            if (!mediaByProduct[obj.__parentId]) mediaByProduct[obj.__parentId] = [];
            mediaByProduct[obj.__parentId].push(obj);
          } else if (obj.namespace !== undefined) {
            // Metafield
            if (!metafieldsByProduct[obj.__parentId]) metafieldsByProduct[obj.__parentId] = [];
            metafieldsByProduct[obj.__parentId].push(obj);
          }
        } else {
          // Root object (product)
          products.set(obj.id, obj);
        }
      });

      rl.on('close', () => {
        resolve({ products, variants, mediaByProduct, metafieldsByProduct });
      });

      rl.on('error', reject);
    }).on('error', reject);
  });
}
```

### JSONL structure example

The JSONL file outputs one JSON object per line. Child objects include `__parentId`:

```jsonl
{"id":"gid://shopify/Product/1921569226808","title":"Rana Sofa","status":"ACTIVE","totalInventory":5}
{"id":"gid://shopify/ProductVariant/19435458986123","sku":"RS-001","price":"999.00","inventoryPolicy":"DENY","__parentId":"gid://shopify/Product/1921569226808"}
{"id":"gid://shopify/ProductVariant/19435458986124","sku":"RS-002","price":"1099.00","inventoryPolicy":"DENY","__parentId":"gid://shopify/Product/1921569226808"}
{"id":"gid://shopify/MediaImage/abc123","mediaContentType":"IMAGE","status":"READY","__parentId":"gid://shopify/Product/1921569226808"}
{"namespace":"custom","key":"out_of_stock_behavior_bp","value":"Allow back orders","__parentId":"gid://shopify/Product/1921569226808"}
```

Note: The `__parentId` always refers to the immediate parent's `id` from the line above. Objects can only be 2 levels deep in bulk queries (product → variant), so variant children (like variant metafields) need a separate bulk operation.

---

## 4. Rate Limit Handling (SETUP-04)

### How Shopify GraphQL rate limiting works

Shopify uses a "leaky bucket" algorithm:
- Each query has a **cost** (requestedQueryCost)
- The bucket has a **maximum capacity** (typically 1,000 points on Basic/Standard plans)
- Points **restore** at a rate per second (50 points/sec on Basic plans)
- If the bucket is full, you get a `THROTTLED` error

### Reading throttle status from response

Every GraphQL response includes cost metadata:

```json
{
  "data": { ... },
  "extensions": {
    "cost": {
      "requestedQueryCost": 12,
      "actualQueryCost": 10,
      "throttleStatus": {
        "maximumAvailable": 1000,
        "currentlyAvailable": 880,
        "restoreRate": 50
      }
    }
  }
}
```

### Retry/backoff implementation

```javascript
// src/client.js — enhanced with retry
export async function graphqlWithRetry(query, variables = {}, maxRetries = 5) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const json = await graphql(query, variables);

      // Proactively check available capacity
      const available = json.extensions?.cost?.throttleStatus?.currentlyAvailable;
      if (available !== undefined && available < 100) {
        // Getting close to limit — pause briefly
        const waitMs = Math.ceil((100 - available) / 50) * 1000;
        console.log(`  Low API capacity (${available} pts) — waiting ${waitMs}ms`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }

      return json;

    } catch (err) {
      if (err.isThrottle) {
        attempt++;
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000); // max 30s
        console.log(`  THROTTLED — retry ${attempt}/${maxRetries} in ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        throw err; // non-throttle errors: don't retry
      }
    }
  }

  throw new Error(`Max retries (${maxRetries}) exceeded on throttled request`);
}
```

**Key points:**
- Bulk operations themselves do NOT count against rate limits during execution — only the trigger mutation and poll queries do
- The recommended base backoff is 1 second; use exponential backoff for repeated throttles
- For polling (every 3 seconds), the poll query costs very few points and won't trigger throttling

---

## 5. Separate Bulk Operation for Inventory (PULL-04)

Because bulk operations only support 2 levels of nesting, you cannot fetch `inventoryLevels` inside a `variants` connection inside `products`. Inventory must be fetched in a separate bulk query.

```javascript
// Fetch inventory levels per location for all inventory items
const INVENTORY_BULK_QUERY = `
mutation {
  bulkOperationRunQuery(
    query: """
    {
      inventoryItems {
        edges {
          node {
            id
            sku
            tracked
            variant {
              id
              sku
              product {
                id
                title
              }
            }
            inventoryLevels {
              edges {
                node {
                  id
                  quantities(names: ["available", "on_hand", "incoming", "committed"]) {
                    name
                    quantity
                  }
                  location {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
    """
  ) {
    bulkOperation {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}
`;
```

This gives you inventory quantities per location for every inventory item (linked to variant and product).

**Note:** In API 2026-01, you can run up to 5 bulk queries concurrently. You could trigger the products bulk operation and the inventory bulk operation at the same time, then poll both.

---

## 6. The Key GraphQL Fields (PULL-02, PULL-03, PULL-05)

### Product fields (all from `read_products` scope)

```graphql
products {
  edges {
    node {
      id
      title
      handle
      status           # ACTIVE | DRAFT | ARCHIVED
      vendor
      productType      # empty for all Rana products currently
      tags
      descriptionHtml  # NOT bodyHtml (deprecated)
      totalInventory
      hasOutOfStockVariants
      variantsCount { count }
      createdAt
      updatedAt
      publishedAt
      onlineStoreUrl

      media(first: 10) {          # NOT images (deprecated)
        edges {
          node {
            id
            mediaContentType  # IMAGE | VIDEO | EXTERNAL_VIDEO | MODEL_3D
            status           # READY | FAILED | PROCESSING | UPLOADED
          }
        }
      }

      metafields(first: 20) {
        edges {
          node {
            namespace    # e.g., "custom"
            key          # e.g., "out_of_stock_behavior_bp"
            value        # the string value
            type         # e.g., "single_line_text_field"
          }
        }
      }
    }
  }
}
```

### Variant fields (PULL-02)

```graphql
variants {
  edges {
    node {
      id
      sku
      barcode
      price
      compareAtPrice
      inventoryQuantity   # total across all locations
      inventoryPolicy     # DENY | CONTINUE
      weight
      weightUnit          # KILOGRAMS | GRAMS | POUNDS | OUNCES
      title
      selectedOptions {
        name
        value
      }
      inventoryItem {
        id
        tracked
      }
    }
  }
}
```

### Key metafields for Rana (PULL-03)

| Namespace.Key | Purpose | Audit use |
|--------------|---------|-----------|
| `custom.out_of_stock_behavior_bp` | OOS behavior from NetSuite | CRITICAL — AUDIT-02 policy mismatch |
| `custom.internal_id` | NetSuite Internal ID | Cross-reference with NetSuite |
| `custom.product_next_available_date` | Expected restock date | Discontinued check |
| `custom.product_first_live_date` | First live date | Audit trail |
| `custom.product_dimension` | H x W x D | Completeness check |
| `custom.product_style` | Style category | Completeness check |
| `custom.unique_feature` | Feature bullets | Completeness check |
| `custom.warranty_eligibility` | Protection plan tier | Completeness check |
| `custom.vendor_product_number` | Vendor SKU | Cross-reference |
| `custom.floor_sample` | Floor sample flag | Inventory logic |

To filter metafields in a non-bulk query (faster for targeted lookups):

```graphql
metafields(namespace: "custom", keys: ["out_of_stock_behavior_bp", "internal_id"], first: 5) {
  edges {
    node {
      namespace
      key
      value
    }
  }
}
```

### Field names to use vs. avoid

| Use This | NOT This | Why |
|----------|----------|-----|
| `descriptionHtml` | `bodyHtml` | Deprecated |
| `media` | `images` | Deprecated |
| `priceRangeV2` | `priceRange` | Deprecated |
| `resourcePublications` | `productPublications` | Deprecated |
| `featuredMedia` | `featuredImage` | Deprecated |

---

## 7. CSV Generation (PULL-06)

Use `csv-stringify` — synchronous API for simplicity at this scale.

### Installation

```bash
npm install csv-stringify
```

### Export pattern

```javascript
import { stringify } from 'csv-stringify/sync';
import fs from 'fs';
import path from 'path';

export function exportCsv(records, columns, filename) {
  const outputDir = './exports';
  fs.mkdirSync(outputDir, { recursive: true });

  const csv = stringify(records, {
    header: true,
    columns: columns,
  });

  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, csv, 'utf8');
  console.log(`  Exported ${records.length} rows to ${filepath}`);
}

// Usage: export products.csv
exportCsv(products, [
  { key: 'id', header: 'Shopify ID' },
  { key: 'title', header: 'Title' },
  { key: 'status', header: 'Status' },
  { key: 'vendor', header: 'Vendor' },
  { key: 'productType', header: 'Product Type' },
  { key: 'tags', header: 'Tags' },
  { key: 'totalInventory', header: 'Total Inventory' },
  { key: 'variantCount', header: 'Variant Count' },
  { key: 'mediaCount', header: 'Image Count' },
  { key: 'hasDescription', header: 'Has Description' },
  { key: 'outOfStockBehavior', header: 'OOS Behavior (Metafield)' },
  { key: 'updatedAt', header: 'Last Updated' },
], 'products.csv');

// Usage: export variants.csv
exportCsv(variants, [
  { key: 'productId', header: 'Product ID' },
  { key: 'productTitle', header: 'Product Title' },
  { key: 'id', header: 'Variant ID' },
  { key: 'sku', header: 'SKU' },
  { key: 'barcode', header: 'Barcode' },
  { key: 'price', header: 'Price' },
  { key: 'compareAtPrice', header: 'Compare At Price' },
  { key: 'inventoryQuantity', header: 'Total Inventory' },
  { key: 'inventoryPolicy', header: 'Inventory Policy' },
  { key: 'weight', header: 'Weight' },
  { key: 'weightUnit', header: 'Weight Unit' },
], 'variants.csv');

// Usage: export inventory.csv
exportCsv(inventoryRows, [
  { key: 'productId', header: 'Product ID' },
  { key: 'variantId', header: 'Variant ID' },
  { key: 'sku', header: 'SKU' },
  { key: 'locationId', header: 'Location ID' },
  { key: 'locationName', header: 'Location' },
  { key: 'available', header: 'Available' },
  { key: 'onHand', header: 'On Hand' },
  { key: 'incoming', header: 'Incoming' },
  { key: 'committed', header: 'Committed' },
], 'inventory.csv');
```

---

## 8. Raw JSON Snapshots (PULL-07)

Save timestamped snapshots to `/snapshots/` for change detection later (Phase 3).

```javascript
import fs from 'fs';
import path from 'path';

export function saveSnapshot(data, label = 'pull') {
  const snapshotsDir = './snapshots';
  fs.mkdirSync(snapshotsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${timestamp}-${label}.json`;
  const filepath = path.join(snapshotsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  Snapshot saved: ${filepath}`);
  return filepath;
}

export function loadLatestSnapshot(label = 'pull') {
  const snapshotsDir = './snapshots';
  const files = fs.readdirSync(snapshotsDir)
    .filter(f => f.endsWith(`-${label}.json`))
    .sort()
    .reverse();

  if (!files.length) return null;
  return JSON.parse(fs.readFileSync(path.join(snapshotsDir, files[0]), 'utf8'));
}
```

---

## 9. Complete Pull Flow (`src/pull.js`)

```javascript
import { graphqlWithRetry } from './client.js';
import { downloadJsonl } from './jsonl.js';
import { exportCsv } from './csv.js';
import { saveSnapshot } from './snapshot.js';

const BULK_PRODUCTS_MUTATION = `/* ... (see Section 3) */`;
const BULK_INVENTORY_MUTATION = `/* ... (see Section 5) */`;
const POLL_QUERY = `/* ... (see Section 3) */`;

export async function pull() {
  console.log('Starting data pull...\n');

  // 1. Trigger products bulk operation
  console.log('1/5 Triggering products bulk operation...');
  const productResult = await graphqlWithRetry(BULK_PRODUCTS_MUTATION);
  const productErrors = productResult.data.bulkOperationRunQuery.userErrors;
  if (productErrors.length) throw new Error(JSON.stringify(productErrors));
  const productOpId = productResult.data.bulkOperationRunQuery.bulkOperation.id;

  // 2. Trigger inventory bulk operation (can run concurrently in 2026-01)
  console.log('2/5 Triggering inventory bulk operation...');
  const inventoryResult = await graphqlWithRetry(BULK_INVENTORY_MUTATION);
  const inventoryOpId = inventoryResult.data.bulkOperationRunQuery.bulkOperation.id;

  // 3. Poll both until complete
  console.log('3/5 Polling for completion...');
  const [productUrl, inventoryUrl] = await Promise.all([
    pollBulkOperation(productOpId),
    pollBulkOperation(inventoryOpId),
  ]);

  // 4. Download and parse JSONL
  console.log('4/5 Downloading and parsing JSONL files...');
  const { products, variants, mediaByProduct, metafieldsByProduct } =
    await downloadJsonl(productUrl);
  const { inventoryLevels } = await downloadInventoryJsonl(inventoryUrl);

  // 5. Assemble data and export
  console.log('5/5 Exporting CSV files and saving snapshot...');

  const productRows = Array.from(products.values()).map(p => ({
    ...p,
    mediaCount: (mediaByProduct[p.id] || []).length,
    variantCount: variants.filter(v => v.productId === p.id).length,
    outOfStockBehavior: (metafieldsByProduct[p.id] || [])
      .find(m => m.key === 'out_of_stock_behavior_bp')?.value ?? '',
    hasDescription: p.descriptionHtml ? 'yes' : 'no',
  }));

  exportCsv(productRows, productColumns, 'products.csv');
  exportCsv(variants, variantColumns, 'variants.csv');
  exportCsv(inventoryLevels, inventoryColumns, 'inventory.csv');

  saveSnapshot({ products: productRows, variants, inventoryLevels });

  console.log(`\nDone. ${productRows.length} products, ${variants.length} variants pulled.`);
}
```

---

## 10. Key Decisions & Tradeoffs

| Decision | Choice | Rationale |
|----------|--------|-----------|
| GraphQL client | Raw `fetch` | @shopify/shopify-api is built for embedded apps with OAuth; overkill for a CLI with a static token |
| Bulk vs. paginated | Bulk operations | 2,482 products with nested data exceeds single-query cost limits; bulk is the only scalable approach |
| Inventory in separate bulk | Yes | 3-level nesting (product→variant→inventoryLevels) is not supported in bulk queries |
| Concurrent bulk operations | Yes (API 2026-01 supports 5) | Trigger products + inventory simultaneously, poll both |
| JSONL parsing | Stream (readline) | Avoids loading potentially large files into memory |
| CSV library | csv-stringify | No dependencies, synchronous API is simple enough for this scale |
| Node version | 18+ | Native `fetch` available; no need for node-fetch |
| Module system | ESM (`"type": "module"`) | Cleaner imports; no CommonJS interop issues |

---

## 11. What Mike Needs to Do Before Code Can Run (SETUP-01)

Mike creates the custom app. This is a prerequisite — code cannot be tested without the token.

Checklist for Mike:
- [ ] Log in to y01sdh-0b.myshopify.com admin
- [ ] Settings → Apps and sales channels → Develop apps
- [ ] Enable custom app development (if not already enabled)
- [ ] Create app named "Rana PM Monitor"
- [ ] Configure scopes: `read_products`, `read_inventory`, `read_locations`
- [ ] Install the app
- [ ] Click "Reveal token once" — copy and store it immediately
- [ ] Share token with developer (via 1Password or secure channel — NOT Slack/email)

---

## 12. Potential Pitfalls for This Phase

| Pitfall | What happens | Prevention |
|---------|-------------|------------|
| Token shown only once | If you don't copy it immediately, you must reinstall the app (generates a new token) | Copy immediately after revealing, store in 1Password |
| 3rd nesting level in bulk query | userErrors returned: "Max connections exceeded" | Keep inventory as a separate bulk operation |
| `images` field (deprecated) | Will stop working in a future API version | Use `media` instead |
| `bodyHtml` / `currentBulkOperation` | Deprecated in 2026-01 | Use `descriptionHtml` and `bulkOperation(id:)` |
| JSONL parent-child reconstruction | Variants appear before parent products | Use a Map to track all objects; do parent association after all lines parsed |
| Bulk op already running | userErrors: "operation already in progress" | In 2026-01 you can run 5 concurrently, but if you hit the limit, wait and retry |
| Token in version control | Accidental git commit exposes credentials | .gitignore must include `.env` before first commit |

---

## Sources

- [Perform bulk operations with the GraphQL Admin API](https://shopify.dev/docs/api/usage/bulk-operations/queries)
- [Generate access tokens for custom apps in the Shopify admin](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens-admin)
- [Shopify API limits](https://shopify.dev/docs/api/usage/limits)
- [Product - GraphQL Admin API 2026-01](https://shopify.dev/docs/api/admin-graphql/2026-01/objects/Product)
- [ProductVariant - GraphQL Admin API](https://shopify.dev/docs/api/admin-graphql/latest/objects/ProductVariant)
- [InventoryLevel - GraphQL Admin API](https://shopify.dev/docs/api/admin-graphql/2026-01/objects/InventoryLevel)
- [bulkOperationRunQuery mutation](https://shopify.dev/docs/api/admin-graphql/2025-01/mutations/bulkOperationRunQuery)
- [csv-stringify npm](https://www.npmjs.com/package/csv-stringify)
- [Custom app access token - Shopify Help Center](https://help.shopify.com/en/manual/apps/app-types/custom-apps)

---

*Research completed: 2026-03-19*
*Phase: 1 — Setup & Data Pipeline*
