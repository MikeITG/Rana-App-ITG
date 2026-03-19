---
phase: 1
plan: 5
title: "Export & Snapshots"
wave: 3
depends_on: [3, 4]
requirements: [PULL-06, PULL-07]
files_modified: [src/csv.js, src/snapshot.js, src/index.js]
autonomous: true
---

# Plan 5: Export & Snapshots

<objective>
Create the CSV export module that writes products.csv, variants.csv, and inventory.csv to the /exports/ directory, and the snapshot module that saves timestamped JSON snapshots to /snapshots/ and can load the latest snapshot for future change detection.
</objective>

<must_haves>
- CSV export using csv-stringify/sync with header row
- products.csv with columns: Shopify ID, Title, Handle, Status, Vendor, Product Type, Tags, Total Inventory, Variant Count, Image Count, Has Description, OOS Behavior (Metafield), Last Updated
- variants.csv with columns: Product ID, Product Title, Variant ID, SKU, Barcode, Price, Compare At Price, Total Inventory, Inventory Policy, Weight, Weight Unit
- inventory.csv with columns: Product ID, Product Title, Variant ID, SKU, Location ID, Location, Available, On Hand, Incoming, Committed
- All CSV files written to /exports/ directory
- JSON snapshot saved to /snapshots/ with ISO timestamp in filename
- loadLatestSnapshot() function for Phase 3 change detection
</must_haves>

<tasks>

<task id="5.1">
<title>Create src/csv.js — CSV export module</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/.planning/phases/01-setup-data-pipeline/01-RESEARCH.md (Section 7)
- /Users/srijan/Desktop/Rana App ITG/src/pull.js
</read_first>
<action>
Create `src/csv.js` with an `exportAllCsv(data)` function and a reusable `exportCsv()` helper.

```javascript
import { stringify } from 'csv-stringify/sync';
import fs from 'fs';
import path from 'path';

const EXPORTS_DIR = './exports';

function exportCsv(records, columns, filename) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });

  const csv = stringify(records, {
    header: true,
    columns: columns,
  });

  const filepath = path.join(EXPORTS_DIR, filename);
  fs.writeFileSync(filepath, csv, 'utf8');
  console.log(`  Exported ${records.length} rows to ${filepath}`);
  return filepath;
}

const PRODUCT_COLUMNS = [
  { key: 'id', header: 'Shopify ID' },
  { key: 'title', header: 'Title' },
  { key: 'handle', header: 'Handle' },
  { key: 'status', header: 'Status' },
  { key: 'vendor', header: 'Vendor' },
  { key: 'productType', header: 'Product Type' },
  { key: 'tags', header: 'Tags' },
  { key: 'totalInventory', header: 'Total Inventory' },
  { key: 'variantCount', header: 'Variant Count' },
  { key: 'mediaCount', header: 'Image Count' },
  { key: 'hasDescription', header: 'Has Description' },
  { key: 'outOfStockBehavior', header: 'OOS Behavior (Metafield)' },
  { key: 'internalId', header: 'NetSuite Internal ID' },
  { key: 'updatedAt', header: 'Last Updated' },
];

const VARIANT_COLUMNS = [
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
];

const INVENTORY_COLUMNS = [
  { key: 'productId', header: 'Product ID' },
  { key: 'productTitle', header: 'Product Title' },
  { key: 'variantId', header: 'Variant ID' },
  { key: 'sku', header: 'SKU' },
  { key: 'locationId', header: 'Location ID' },
  { key: 'locationName', header: 'Location' },
  { key: 'available', header: 'Available' },
  { key: 'onHand', header: 'On Hand' },
  { key: 'incoming', header: 'Incoming' },
  { key: 'committed', header: 'Committed' },
];

/**
 * Export all pulled data as CSV files.
 * @param {Object} data - Object with productRows, variantRows, inventoryLevels from pull()
 */
export function exportAllCsv(data) {
  console.log('\nExporting CSV files...');
  exportCsv(data.productRows, PRODUCT_COLUMNS, 'products.csv');
  exportCsv(data.variantRows, VARIANT_COLUMNS, 'variants.csv');
  exportCsv(data.inventoryLevels, INVENTORY_COLUMNS, 'inventory.csv');
  console.log('CSV export complete.\n');
}
```

Key design:
- Uses `csv-stringify/sync` for simplicity (synchronous stringify is fine for this data size)
- Column definitions map object keys to human-readable CSV headers
- `exportAllCsv()` is the single function called from `src/index.js` after `pull()` returns
- Creates `/exports/` directory if it does not exist
</action>
<acceptance_criteria>
- src/csv.js imports `stringify` from `csv-stringify/sync`
- src/csv.js exports `exportAllCsv` function
- src/csv.js writes to `./exports/` directory
- src/csv.js defines PRODUCT_COLUMNS with keys: id, title, handle, status, vendor, productType, tags, totalInventory, variantCount, mediaCount, hasDescription, outOfStockBehavior, updatedAt
- src/csv.js defines VARIANT_COLUMNS with keys: productId, productTitle, id, sku, barcode, price, compareAtPrice, inventoryQuantity, inventoryPolicy, weight, weightUnit
- src/csv.js defines INVENTORY_COLUMNS with keys: productId, productTitle, variantId, sku, locationId, locationName, available, onHand, incoming, committed
- src/csv.js calls `fs.writeFileSync` to write each CSV file
- src/csv.js calls `fs.mkdirSync` with `{ recursive: true }`
</acceptance_criteria>
</task>

<task id="5.2">
<title>Create src/snapshot.js — JSON snapshot save/load</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/.planning/phases/01-setup-data-pipeline/01-RESEARCH.md (Section 8)
- /Users/srijan/Desktop/Rana App ITG/src/pull.js
</read_first>
<action>
Create `src/snapshot.js` with `saveSnapshot()` and `loadLatestSnapshot()` functions.

```javascript
import fs from 'fs';
import path from 'path';

const SNAPSHOTS_DIR = './snapshots';

/**
 * Save pull data as a timestamped JSON snapshot.
 * Filename format: 2026-03-19T14-30-00-pull.json
 * @param {Object} data - The data object from pull() (productRows, variantRows, inventoryLevels)
 * @param {string} label - Snapshot label (default: 'pull')
 * @returns {string} filepath of saved snapshot
 */
export function saveSnapshot(data, label = 'pull') {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${timestamp}-${label}.json`;
  const filepath = path.join(SNAPSHOTS_DIR, filename);

  // Strip metafields array from productRows to keep snapshot size manageable
  // (metafields are denormalized into outOfStockBehavior, internalId, etc.)
  const snapshotData = {
    pulledAt: new Date().toISOString(),
    counts: {
      products: data.productRows.length,
      variants: data.variantRows.length,
      inventoryLevels: data.inventoryLevels.length,
    },
    products: data.productRows.map(p => {
      const { metafields, ...rest } = p;
      return rest;
    }),
    variants: data.variantRows,
    inventoryLevels: data.inventoryLevels,
  };

  fs.writeFileSync(filepath, JSON.stringify(snapshotData, null, 2), 'utf8');
  console.log(`Snapshot saved: ${filepath} (${(fs.statSync(filepath).size / 1024 / 1024).toFixed(1)} MB)`);
  return filepath;
}

/**
 * Load the most recent snapshot with the given label.
 * @param {string} label - Snapshot label to filter by (default: 'pull')
 * @returns {Object|null} parsed snapshot data, or null if no snapshots found
 */
export function loadLatestSnapshot(label = 'pull') {
  if (!fs.existsSync(SNAPSHOTS_DIR)) return null;

  const files = fs.readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith(`-${label}.json`))
    .sort()
    .reverse();

  if (!files.length) return null;

  const filepath = path.join(SNAPSHOTS_DIR, files[0]);
  console.log(`Loading snapshot: ${filepath}`);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}
```

Key design:
- Timestamp format uses ISO 8601 with colons/dots replaced by hyphens (safe for filenames)
- `saveSnapshot()` strips the raw `metafields` array from products (the important fields are already extracted as `outOfStockBehavior`, `internalId`, etc.)
- `loadLatestSnapshot()` sorts files alphabetically (ISO timestamps sort correctly) and returns the most recent
- Snapshot includes a `counts` summary and `pulledAt` timestamp for quick inspection
- `loadLatestSnapshot()` is exported for Phase 3 change detection
</action>
<acceptance_criteria>
- src/snapshot.js exports `saveSnapshot` function
- src/snapshot.js exports `loadLatestSnapshot` function
- src/snapshot.js writes to `./snapshots/` directory
- src/snapshot.js uses `new Date().toISOString()` for timestamp
- src/snapshot.js uses `JSON.stringify(snapshotData, null, 2)` for readable output
- src/snapshot.js `loadLatestSnapshot` reads from `./snapshots/`, filters by label, sorts, returns latest
- src/snapshot.js calls `fs.mkdirSync` with `{ recursive: true }`
- src/snapshot.js includes `pulledAt` and `counts` in snapshot data
</acceptance_criteria>
</task>

</tasks>

<verification>
```bash
# Verify CSV module
grep "csv-stringify/sync" src/csv.js
grep "exportAllCsv" src/csv.js
grep "products.csv" src/csv.js
grep "variants.csv" src/csv.js
grep "inventory.csv" src/csv.js

# Verify column definitions include key fields
grep "outOfStockBehavior" src/csv.js
grep "inventoryPolicy" src/csv.js
grep "locationName" src/csv.js

# Verify snapshot module
grep "saveSnapshot" src/snapshot.js
grep "loadLatestSnapshot" src/snapshot.js
grep "toISOString" src/snapshot.js
grep "snapshots" src/snapshot.js

# Verify index.js ties it all together
grep "exportAllCsv" src/index.js
grep "saveSnapshot" src/index.js

# Syntax check
node --check src/csv.js
node --check src/snapshot.js

# Full dry run (will fail at API call due to placeholder token, but verifies imports resolve)
node src/index.js 2>&1 | head -5
```
</verification>
