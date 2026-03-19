---
phase: 1
plan: 5
status: complete
---

# Plan 5: Export & Snapshots — Summary

## What Was Built

Three files that complete the Phase 1 data pipeline:

**src/csv.js** — CSV export module using `csv-stringify/sync`. Exports `exportAllCsv(data)` which writes three files to `/exports/`:
- `products.csv` — 14 columns including Shopify ID, status, vendor, OOS behavior metafield, NetSuite Internal ID, last updated
- `variants.csv` — 11 columns including SKU, barcode, price, compare-at, inventory policy, weight
- `inventory.csv` — 10 columns including location, available, on-hand, incoming, committed quantities

**src/snapshot.js** — JSON snapshot module. Exports:
- `saveSnapshot(data, label)` — writes a timestamped JSON file (e.g. `2026-03-19T14-30-00-pull.json`) to `/snapshots/`, strips raw `metafields` arrays, includes `pulledAt` and `counts` summary
- `loadLatestSnapshot(label)` — reads `/snapshots/`, filters by label, sorts alphabetically (ISO timestamps sort correctly), returns latest parsed object or null

**src/index.js** — CLI entry point. Handles the `pull` command: calls `pull()` → `exportAllCsv()` → `saveSnapshot()`. Shows usage help for unknown commands.

## Key Files Created

- `/Users/srijan/Desktop/Rana App ITG/src/csv.js`
- `/Users/srijan/Desktop/Rana App ITG/src/snapshot.js`
- `/Users/srijan/Desktop/Rana App ITG/src/index.js`

## Decisions Made

- **`internalId` column added to products.csv** — the plan's acceptance criteria listed `outOfStockBehavior` but `pull.js` also extracts `internalId` (NetSuite Internal ID). Including it in the CSV adds value at no cost; it was already in the PRODUCT_COLUMNS spec in the plan body.
- **Snapshot strips `metafields` array** — raw metafields from the bulk query are large and redundant (already denormalized into `outOfStockBehavior` and `internalId`). Stripping them keeps snapshots a fraction of the size.
- **Synchronous CSV stringify** — `csv-stringify/sync` is appropriate here; the data set (~2,500 products, ~2,500 variants) is small enough that sync I/O adds no meaningful latency vs the 5-10 minute bulk operation that precedes it.
- **`loadLatestSnapshot()` exported for Phase 3** — not used in the `pull` command itself, but exported and ready for the change detection audit in Phase 3.

## Self-Check

- `node --check src/csv.js` — pass
- `node --check src/snapshot.js` — pass
- `node --check src/index.js` — pass
- All plan grep verifications pass (csv-stringify/sync, exportAllCsv, products/variants/inventory.csv, outOfStockBehavior, inventoryPolicy, locationName, saveSnapshot, loadLatestSnapshot, toISOString, snapshots, exportAllCsv in index, saveSnapshot in index)
- Committed as `feat(01-05)` on main branch
