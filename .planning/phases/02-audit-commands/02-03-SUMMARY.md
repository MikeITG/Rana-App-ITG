---
phase: 2
plan: 3
status: complete
---

# Summary: Plan 02-03 — Discontinued Products Audit

## What Was Built

Created `src/audits/discontinued.js` — an ESM module exporting `auditDiscontinued(snapshot)`.

## Detection Logic

- **DISCONTINUED_STILL_ACTIVE**: `status === 'ACTIVE'` AND `totalInventory <= 0` AND `outOfStockBehavior` contains "remove item" (case-insensitive). Expected count: 359.
- **BACKORDERABLE_ZERO_STOCK**: `status === 'ACTIVE'` AND `totalInventory <= 0` AND `outOfStockBehavior` contains "allow back" (case-insensitive). Expected count: 224.

## Return Shape

```js
{ summary, rows }
// summary: { total, activeProducts, discontinued, backorderableZeroStock, flagged }
// rows: [{ productId, title, handle, status, totalInventory, outOfStockBehavior, issueType, tags, updatedAt }]
```

## Constraints Met

- Reads from snapshot only — no live API calls
- No external imports
- Prints terminal summary with first 20 discontinued products
- ESM module

## Commit

`feat(02-03): add discontinued products audit` — `fdd2a0f`
