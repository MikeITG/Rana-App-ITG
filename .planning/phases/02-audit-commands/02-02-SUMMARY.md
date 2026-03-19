---
phase: 2
plan: 2
status: complete
---

# Summary: Plan 02-02 — Inventory Policy Mismatch Audit

## What Was Built

Created `src/audits/policy.js` — an ESM module implementing AUDIT-02 (inventory policy mismatch detection).

## Key Implementation Details

- **No external dependencies** — pure Node.js, reads from a pre-loaded snapshot object
- **Case-insensitive matching** via `.toLowerCase()` on the `outOfStockBehavior` field
- **Three mismatch types**:
  - `SHOULD_BE_CONTINUE` — metafield contains "allow back" but `inventoryPolicy === 'DENY'`
  - `SHOULD_BE_DENY` — metafield contains "remove item" but `inventoryPolicy === 'CONTINUE'`
  - `NO_METAFIELD` — `outOfStockBehavior` is empty or unrecognized
- **Returns** `{ summary, rows }` — `rows` contains all mismatch records (correct variants excluded)
- **Row shape**: `productId, title, handle, status, sku, variantId, inventoryPolicy, outOfStockBehavior, mismatchType`
- **Terminal output**: formatted summary with counts + sample table of first 20 mismatches

## Acceptance Criteria

All criteria verified via grep:
- `export function auditPolicy` present
- `SHOULD_BE_CONTINUE`, `SHOULD_BE_DENY`, `NO_METAFIELD` all present
- `allow back` and `remove item` strings present (case-insensitive match logic)
- `mismatchType` used in rows object
- `return { summary, rows }` present
- No `import` statements (no external dependencies)

## Commit

`feat(02-02): add inventory policy mismatch audit` — `be9a750`
