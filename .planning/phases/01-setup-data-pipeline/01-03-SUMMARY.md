---
phase: 1
plan: 3
status: complete
---
# Summary: Plan 01-03 — Bulk Product Pull

## What Was Built

Two new source modules implementing the full bulk operation data pipeline:

**src/jsonl.js** — Streams and parses Shopify bulk operation JSONL output using Node built-in `https` and `readline`. Reconstructs parent-child relationships via `__parentId` to separate products, variants, media, and metafields. Also handles inventory JSONL (InventoryItem root → InventoryLevel children with per-location quantities).

**src/pull.js** — Orchestrates the full pull flow:
1. Triggers a `bulkOperationRunQuery` mutation for products (with variants, metafields, media)
2. Triggers a second `bulkOperationRunQuery` mutation for inventory (inventoryItems → inventoryLevels)
3. Polls both operations concurrently using `Promise.all` with `node(id: $id)` queries (not the deprecated `currentBulkOperation`)
4. Downloads and parses JSONL files via jsonl.js
5. Assembles enriched `productRows`, `variantRows`, and `inventoryLevels` arrays ready for export

## Key Files Created

- `/Users/srijan/Desktop/Rana App ITG/src/jsonl.js`
- `/Users/srijan/Desktop/Rana App ITG/src/pull.js`

## Decisions Made

- **Polling via `node(id:)`**: Used `node(id: $id) { ... on BulkOperation { ... } }` as specified in the plan's must_haves, consistent with 2026-01 API deprecation of `currentBulkOperation`. (The research doc showed `bulkOperation(id:)` but the plan spec takes precedence.)
- **Sequential trigger, concurrent poll**: Both bulk operations are triggered sequentially (to capture each operation ID), then polled concurrently with `Promise.all` — safe in API 2026-01 which supports up to 5 concurrent bulk operations.
- **No npm dependencies in jsonl.js**: Uses only Node built-ins (`https`, `readline`).
- **src/index.js not created**: Per Task 3.3 instructions, index.js is deferred to Plan 5 after csv.js and snapshot.js exist.

## Self-Check: PASSED
