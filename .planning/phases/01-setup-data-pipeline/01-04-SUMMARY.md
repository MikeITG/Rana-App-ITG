---
phase: 1
plan: 4
status: complete
---

# Plan 04 Summary: Inventory Pull

## What Was Built

This plan verified that the inventory bulk operation pipeline — introduced in Plan 03 — is fully correct and complete. No new code was required; all acceptance criteria were already satisfied by the Plan 03 implementation.

### Task 4.1 — Inventory bulk mutation in `src/pull.js` (VERIFIED)

- `BULK_INVENTORY_MUTATION` queries `inventoryItems` as the root resource with all required fields: `id`, `sku`, `tracked`, `variant { id, sku, product { id, title } }`
- `inventoryLevels` nested connection includes `quantities(names: ["available", "on_hand", "incoming", "committed"])` with `name` and `quantity`
- `location { id, name }` is included on each inventory level node
- The `pull()` function triggers the inventory bulk operation after the products operation, then polls both concurrently via `Promise.all([pollBulkOperation(productOpId, 'products'), pollBulkOperation(inventoryOpId, 'inventory')])`
- The inventory URL is passed to `downloadInventoryJsonl(inventoryUrl)` and its result assigned to `inventoryLevels`

### Task 4.2 — Inventory JSONL parser in `src/jsonl.js` (VERIFIED)

- Root objects (no `__parentId`) are stored in `inventoryItems` Map keyed by `id`
- Child objects (with `__parentId`) are looked up against the parent via `inventoryItems.get(obj.__parentId)`
- Quantities array `[{name, quantity}, ...]` is flattened into individual fields: `available`, `onHand`, `incoming`, `committed`
- Each flat row includes: `inventoryItemId`, `sku`, `variantId`, `productId`, `productTitle`, `locationId`, `locationName`, and all four quantity fields
- Function returns `{ inventoryLevels: Array }` as required

## Key Files Created

No new files were created. The following files were verified:

- `/Users/srijan/Desktop/Rana App ITG/src/pull.js` — contains `BULK_INVENTORY_MUTATION` and concurrent polling in `pull()`
- `/Users/srijan/Desktop/Rana App ITG/src/jsonl.js` — contains `downloadInventoryJsonl()` with correct parent-child JSONL parsing

## Decisions Made

- **Why inventory is a separate bulk operation from products**: Shopify bulk operations only support 2 levels of nesting. A product → variant → inventoryLevels chain would be 3 levels deep, which Shopify does not allow. The separate `inventoryItems → inventoryLevels` query stays within the 2-level limit.
- **Quantities as named array**: Shopify returns quantities as `[{name: "available", quantity: N}, ...]`. The parser correctly iterates this array and maps each entry to a dedicated field using `quantities[q.name] = q.quantity` before reading `quantities.available`, `quantities.on_hand`, etc.
- **`onHand` vs `on_hand`**: The Shopify API uses `on_hand` as the quantity name; the parser maps this to camelCase `onHand` for consistency with JS conventions.

## Self-Check

All acceptance criteria from the plan verified via grep:

| Criterion | Status |
|-----------|--------|
| `inventoryItems` in `BULK_INVENTORY_MUTATION` | PASS |
| `inventoryLevels` as nested connection | PASS |
| `quantities(names: ["available", "on_hand", "incoming", "committed"])` | PASS |
| `location { id` and `name }` in inventory query | PASS |
| `variant { id }` with `product { id, title }` | PASS |
| `downloadInventoryJsonl` called with inventory URL | PASS |
| `Promise.all` for concurrent polling | PASS |
| Root objects stored in Map | PASS |
| Parent lookup via `inventoryItems.get(obj.__parentId)` | PASS |
| Returns `{ inventoryLevels: Array }` | PASS |
| Quantities flattened into `available`, `onHand`, `incoming`, `committed` | PASS |
| `locationName` and `locationId` from `obj.location` | PASS |
| `sku`, `variantId`, `productId`, `productTitle` from parent | PASS |
</content>
</invoke>