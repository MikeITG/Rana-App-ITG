---
phase: 2
plan: 1
status: complete
---

# Summary: Plan 02-01 — Product Health Audit

## What Was Done

Created `src/audits/products.js` as a pure ESM module implementing `auditProducts(snapshot)`.

## Implementation Details

- Receives a full pull snapshot object as its sole parameter (no live API calls, no file I/O)
- Builds a `variantsByProduct` Map (productId → variant[]) for O(1) per-product variant lookup
- Iterates all products computing:
  - Status breakdown: ACTIVE / DRAFT / ARCHIVED
  - Field completeness: hasDescription (`'yes'`/`'no'` string), hasProductType (non-empty string), hasImages (mediaCount > 0)
  - Variant-level: anyWeightSet (weight > 0), anyBarcodeSet, anyCompareAtPrice, inventoryPolicy distribution
  - Per-product `variantPolicySummary`: `'all-deny'` | `'all-continue'` | `'mixed'`
- Computes percentage breakdowns across all counters
- Prints a clean terminal table with STATUS BREAKDOWN, FIELD COMPLETENESS, and INVENTORY POLICY sections
- Returns `{ summary, rows }` where `rows` is one object per product suitable for CSV export

## Acceptance Criteria Met

- [x] File exists at `src/audits/products.js`
- [x] `export function auditProducts` present
- [x] No `loadLatestSnapshot` call (only in JSDoc comment)
- [x] `variantsByProduct` Map used for lookup
- [x] `variantPolicySummary` field in rows array
- [x] `hasDescription` computed and included
- [x] `return { summary, rows }` present
- [x] No external npm imports — pure Node.js built-ins only

## Commit

`feat(02-01): add product health audit` — `8aa0fb6`
