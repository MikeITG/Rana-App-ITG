---
phase: 3
plan: 1
status: complete
---

# Summary: Change Detection Module

## What Was Built

Created `src/audits/changes.js` — the core diff engine for Phase 3.

## Implementation

- **`diffSnapshots(baseline, current)`** — pure ESM named export, no file I/O, no API calls
- Builds `Map` lookups indexed by product `id` (Shopify GID) and variant `sku`
- Detects product-level changes: `added`, `removed`, `status_change`, `inventory_change`, `policy_change`, `images_change`
- Detects variant-level changes: `variant_added`, `variant_removed`, `price_change`, `compare_price_change`, `policy_change`, `inventory_change`
- Returns `{ summary, productChanges, variantChanges }` — all arrays suitable for CSV export
- Prints a terminal change report with capped detail sections (20 items max per section with "... and N more" overflow)
- Zero-change case prints "No changes detected between snapshots."

## Verification

All plan assertions passed:
- `productsAdded === 1` ✓
- `statusChanges === 1` ✓
- `priceChanges === 1` ✓
- `variantsAdded === 1` ✓

## Files

- `src/audits/changes.js` — created (313 lines)

## Commit

`feat(03-01): add change detection diff engine`
