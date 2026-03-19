---
phase: 1
plan: 3
title: "Bulk Product Pull"
wave: 2
depends_on: [1, 2]
requirements: [PULL-01, PULL-02, PULL-03, PULL-04, PULL-05]
files_modified: [src/pull.js, src/jsonl.js]
autonomous: true
---

# Plan 3: Bulk Product Pull

<objective>
Implement the bulk operation pipeline for products: trigger a bulkOperationRunQuery mutation that fetches all products with their variants, metafields, and media; poll the operation until complete; download and parse the resulting JSONL file; and assemble the data into structured JavaScript objects ready for export.
</objective>

<must_haves>
- bulkOperationRunQuery mutation that fetches products with variants (SKU, price, weight, barcode, inventoryPolicy, inventoryQuantity, inventoryItem.id), metafields (namespace, key, value, type), and media (id, mediaContentType, status)
- Poll loop using `node(id:)` query on the bulk operation ID — NOT `currentBulkOperation` (deprecated)
- JSONL stream parser using Node built-in `readline` + `https` that reconstructs parent-child relationships via `__parentId`
- Assembled data: Map of products, array of variants (with productId), media counts per product, metafields per product
- CLI entry point `node src/index.js pull` triggers the pull
</must_haves>

<tasks>

<task id="3.1">
<title>Create src/jsonl.js — JSONL download and parser</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/.planning/phases/01-setup-data-pipeline/01-RESEARCH.md (Section 3, Step 3 — JSONL parsing)
</read_first>
<action>
Create `src/jsonl.js` with a `downloadJsonl(url)` function that streams a JSONL file from a URL and reconstructs parent-child relationships.

```javascript
import https from 'https';
import readline from 'readline';

/**
 * Download a JSONL file from the given URL (Shopify bulk operation result)
 * and parse it into structured data.
 *
 * JSONL structure:
 * - Root objects (products) have no __parentId
 * - Child objects (variants, metafields, media) have __parentId pointing to their parent's id
 *
 * Returns: { products: Map<id, product>, variants: Array, mediaByProduct: Object, metafieldsByProduct: Object }
 */
export async function downloadProductsJsonl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const rl = readline.createInterface({
        input: response,
        crlfDelay: Infinity,
      });

      const products = new Map();
      const variants = [];
      const mediaByProduct = {};
      const metafieldsByProduct = {};

      rl.on('line', (line) => {
        if (!line.trim()) return;
        const obj = JSON.parse(line);

        if (obj.__parentId) {
          const parentId = obj.__parentId;
          const id = obj.id || '';

          if (id.includes('/ProductVariant/')) {
            variants.push({ ...obj, productId: parentId });
            delete variants[variants.length - 1].__parentId;
          } else if (id.includes('/MediaImage/') || id.includes('/Video/') || obj.mediaContentType) {
            if (!mediaByProduct[parentId]) mediaByProduct[parentId] = [];
            mediaByProduct[parentId].push(obj);
          } else if (obj.namespace !== undefined && obj.key !== undefined) {
            if (!metafieldsByProduct[parentId]) metafieldsByProduct[parentId] = [];
            metafieldsByProduct[parentId].push({
              namespace: obj.namespace,
              key: obj.key,
              value: obj.value,
              type: obj.type,
            });
          } else if (id.includes('/InventoryItem/')) {
            // inventoryItem child of variant — skip, we get inventory from separate bulk op
          }
        } else {
          products.set(obj.id, obj);
        }
      });

      rl.on('close', () => {
        console.log(`  Parsed ${products.size} products, ${variants.length} variants from JSONL`);
        resolve({ products, variants, mediaByProduct, metafieldsByProduct });
      });

      rl.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Download and parse inventory JSONL from a bulk operation result.
 * Root objects are InventoryItems; children are InventoryLevels.
 *
 * Returns: { inventoryLevels: Array }
 */
export async function downloadInventoryJsonl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const rl = readline.createInterface({
        input: response,
        crlfDelay: Infinity,
      });

      const inventoryItems = new Map();
      const inventoryLevels = [];

      rl.on('line', (line) => {
        if (!line.trim()) return;
        const obj = JSON.parse(line);

        if (obj.__parentId) {
          const parent = inventoryItems.get(obj.__parentId);
          if (obj.quantities) {
            const quantities = {};
            for (const q of obj.quantities) {
              quantities[q.name] = q.quantity;
            }
            inventoryLevels.push({
              inventoryItemId: obj.__parentId,
              sku: parent?.sku || '',
              variantId: parent?.variant?.id || '',
              productId: parent?.variant?.product?.id || '',
              productTitle: parent?.variant?.product?.title || '',
              locationId: obj.location?.id || '',
              locationName: obj.location?.name || '',
              available: quantities.available ?? 0,
              onHand: quantities.on_hand ?? 0,
              incoming: quantities.incoming ?? 0,
              committed: quantities.committed ?? 0,
            });
          }
        } else {
          inventoryItems.set(obj.id, obj);
        }
      });

      rl.on('close', () => {
        console.log(`  Parsed ${inventoryLevels.length} inventory levels from JSONL`);
        resolve({ inventoryLevels });
      });

      rl.on('error', reject);
    }).on('error', reject);
  });
}
```

Key points:
- Uses Node built-in `https` and `readline` — no npm dependencies
- Determines child type by checking the GID prefix in `id` or by checking for `namespace`/`key` (metafields) or `mediaContentType` (media)
- Variants get `productId` set to their `__parentId` for later CSV export
- Inventory parser reconstructs flat rows with location name, quantities, and parent SKU/variant/product info
</action>
<acceptance_criteria>
- src/jsonl.js exports `downloadProductsJsonl` function
- src/jsonl.js exports `downloadInventoryJsonl` function
- src/jsonl.js imports `https` from node built-in
- src/jsonl.js imports `readline` from node built-in
- src/jsonl.js checks for `__parentId` to distinguish children from root objects
- src/jsonl.js checks for `/ProductVariant/` in id to identify variants
- src/jsonl.js checks for `mediaContentType` to identify media
- src/jsonl.js checks for `namespace` and `key` to identify metafields
- src/jsonl.js does NOT import any npm packages
</acceptance_criteria>
</task>

<task id="3.2">
<title>Create src/pull.js — bulk operation trigger, poll, and orchestration</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/.planning/phases/01-setup-data-pipeline/01-RESEARCH.md (Sections 3, 4, 5, 9)
- /Users/srijan/Desktop/Rana App ITG/src/client.js
- /Users/srijan/Desktop/Rana App ITG/src/jsonl.js
</read_first>
<action>
Create `src/pull.js` with the bulk operation mutations, poll logic, and the main `pull()` function.

```javascript
import { graphqlWithRetry } from './client.js';
import { downloadProductsJsonl, downloadInventoryJsonl } from './jsonl.js';

// --- GraphQL Mutations & Queries ---

const BULK_PRODUCTS_MUTATION = `
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
            variants(first: 100) {
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

const BULK_INVENTORY_MUTATION = `
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

const POLL_QUERY = `
query BulkOperationStatus($id: ID!) {
  node(id: $id) {
    ... on BulkOperation {
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
}
`;

// --- Polling ---

async function pollBulkOperation(operationId, label = 'operation') {
  console.log(`  Polling ${label}...`);

  while (true) {
    const result = await graphqlWithRetry(POLL_QUERY, { id: operationId });
    const op = result.data.node;

    console.log(`  [${label}] Status: ${op.status} | Objects: ${op.objectCount || 0}`);

    if (op.status === 'COMPLETED') {
      if (!op.url) {
        console.log(`  [${label}] Completed but no data URL (empty result set)`);
        return null;
      }
      return op.url;
    }

    if (op.status === 'FAILED') {
      throw new Error(`Bulk operation ${label} failed: ${op.errorCode}`);
    }

    if (op.status === 'CANCELED') {
      throw new Error(`Bulk operation ${label} was canceled`);
    }

    // Poll every 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

// --- Main Pull Function ---

export async function pull() {
  console.log('Starting full data pull...\n');
  const startTime = Date.now();

  // Step 1: Trigger products bulk operation
  console.log('Step 1/5: Triggering products bulk operation...');
  const productResult = await graphqlWithRetry(BULK_PRODUCTS_MUTATION);
  const productErrors = productResult.data.bulkOperationRunQuery.userErrors;
  if (productErrors.length) {
    throw new Error(`Product bulk operation failed: ${JSON.stringify(productErrors)}`);
  }
  const productOpId = productResult.data.bulkOperationRunQuery.bulkOperation.id;
  console.log(`  Operation ID: ${productOpId}`);

  // Step 2: Trigger inventory bulk operation (concurrent in API 2026-01)
  console.log('Step 2/5: Triggering inventory bulk operation...');
  const inventoryResult = await graphqlWithRetry(BULK_INVENTORY_MUTATION);
  const inventoryErrors = inventoryResult.data.bulkOperationRunQuery.userErrors;
  if (inventoryErrors.length) {
    throw new Error(`Inventory bulk operation failed: ${JSON.stringify(inventoryErrors)}`);
  }
  const inventoryOpId = inventoryResult.data.bulkOperationRunQuery.bulkOperation.id;
  console.log(`  Operation ID: ${inventoryOpId}`);

  // Step 3: Poll both until complete
  console.log('Step 3/5: Waiting for bulk operations to complete...');
  const [productUrl, inventoryUrl] = await Promise.all([
    pollBulkOperation(productOpId, 'products'),
    pollBulkOperation(inventoryOpId, 'inventory'),
  ]);

  // Step 4: Download and parse JSONL
  console.log('Step 4/5: Downloading and parsing JSONL files...');

  let products = new Map();
  let variants = [];
  let mediaByProduct = {};
  let metafieldsByProduct = {};
  let inventoryLevels = [];

  if (productUrl) {
    const productData = await downloadProductsJsonl(productUrl);
    products = productData.products;
    variants = productData.variants;
    mediaByProduct = productData.mediaByProduct;
    metafieldsByProduct = productData.metafieldsByProduct;
  }

  if (inventoryUrl) {
    const inventoryData = await downloadInventoryJsonl(inventoryUrl);
    inventoryLevels = inventoryData.inventoryLevels;
  }

  // Step 5: Assemble enriched product rows
  console.log('Step 5/5: Assembling data...');

  const productRows = Array.from(products.values()).map(p => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    status: p.status,
    vendor: p.vendor,
    productType: p.productType,
    tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
    descriptionHtml: p.descriptionHtml || '',
    hasDescription: p.descriptionHtml ? 'yes' : 'no',
    totalInventory: p.totalInventory ?? 0,
    variantCount: variants.filter(v => v.productId === p.id).length,
    mediaCount: (mediaByProduct[p.id] || []).length,
    metafields: metafieldsByProduct[p.id] || [],
    outOfStockBehavior: (metafieldsByProduct[p.id] || [])
      .find(m => m.key === 'out_of_stock_behavior_bp')?.value ?? '',
    internalId: (metafieldsByProduct[p.id] || [])
      .find(m => m.key === 'internal_id')?.value ?? '',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    publishedAt: p.publishedAt,
  }));

  const variantRows = variants.map(v => {
    const product = products.get(v.productId);
    return {
      productId: v.productId,
      productTitle: product?.title || '',
      id: v.id,
      sku: v.sku || '',
      barcode: v.barcode || '',
      price: v.price,
      compareAtPrice: v.compareAtPrice || '',
      inventoryQuantity: v.inventoryQuantity ?? 0,
      inventoryPolicy: v.inventoryPolicy,
      weight: v.weight ?? 0,
      weightUnit: v.weightUnit || '',
      title: v.title || '',
      inventoryItemId: v.inventoryItem?.id || '',
      tracked: v.inventoryItem?.tracked ?? false,
    };
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nPull complete in ${elapsed}s.`);
  console.log(`  Products: ${productRows.length}`);
  console.log(`  Variants: ${variantRows.length}`);
  console.log(`  Inventory levels: ${inventoryLevels.length}`);

  return { productRows, variantRows, inventoryLevels, metafieldsByProduct };
}
```

Key design decisions:
- Triggers products and inventory bulk operations sequentially (so we get both operation IDs), then polls both concurrently with `Promise.all`
- Uses `node(id:)` query for polling — NOT the deprecated `currentBulkOperation`
- Handles null URL (empty result set) gracefully
- Returns structured data for the export/snapshot plan to consume
- Enriches product rows with computed fields: variantCount, mediaCount, outOfStockBehavior, hasDescription
</action>
<acceptance_criteria>
- src/pull.js exports `pull` function
- src/pull.js contains `bulkOperationRunQuery` mutation for products
- src/pull.js contains `bulkOperationRunQuery` mutation for inventory
- src/pull.js contains `descriptionHtml` (NOT `bodyHtml`)
- src/pull.js contains `media(first:` (NOT `images`)
- src/pull.js contains `metafields(first:` with namespace, key, value, type
- src/pull.js contains `inventoryPolicy` in variant fields
- src/pull.js contains `inventoryQuantity` in variant fields
- src/pull.js contains `inventoryLevels` with `quantities(names:` in inventory query
- src/pull.js polls using `node(id: $id)` query, NOT `currentBulkOperation`
- src/pull.js uses `Promise.all` to poll both operations concurrently
- src/pull.js imports from `./client.js` and `./jsonl.js`
</acceptance_criteria>
</task>

<task id="3.3">
<title>Verify pull module is importable</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/src/pull.js
- /Users/srijan/Desktop/Rana App ITG/src/jsonl.js
</read_first>
<action>
Verify that `src/pull.js` and `src/jsonl.js` are syntactically valid and that pull.js exports the `pull` function. Do NOT create src/index.js here — it will be created in Plan 5 after csv.js and snapshot.js exist.

Run: `node -e "import('./src/pull.js').then(m => console.log('pull exports:', Object.keys(m)))"`
</action>
<acceptance_criteria>
- src/pull.js contains `export async function pull`
- src/jsonl.js contains `export async function`
- Running `node -e "import('./src/pull.js')"` does not throw a SyntaxError
</acceptance_criteria>
</task>

</tasks>

<verification>
```bash
# Verify JSONL parser exports
grep 'export async function downloadProductsJsonl' src/jsonl.js
grep 'export async function downloadInventoryJsonl' src/jsonl.js

# Verify bulk queries use correct fields
grep 'descriptionHtml' src/pull.js
grep 'mediaContentType' src/pull.js
grep 'inventoryPolicy' src/pull.js
grep 'out_of_stock_behavior_bp' src/pull.js

# Verify polling uses node(id:) not currentBulkOperation
grep 'node(id:' src/pull.js
grep -q 'currentBulkOperation' src/pull.js && echo "FAIL: deprecated currentBulkOperation found" || echo "No deprecated currentBulkOperation (correct)"

# Verify CLI entry point
grep "case 'pull'" src/index.js

# Syntax check all files
node --check src/jsonl.js
node --check src/pull.js
node --check src/index.js 2>&1 || echo "Note: may fail due to missing .env — expected"
```
</verification>
