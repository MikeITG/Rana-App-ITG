---
phase: 1
plan: 4
title: "Inventory Pull"
wave: 3
depends_on: [1, 2, 3]
requirements: [PULL-04]
files_modified: []
autonomous: true
---

# Plan 4: Inventory Pull

<objective>
The inventory bulk operation and its JSONL parser are already included in Plan 3 (src/pull.js contains the BULK_INVENTORY_MUTATION and src/jsonl.js contains downloadInventoryJsonl). This plan verifies that the inventory pipeline correctly fetches inventory levels per location with available, on_hand, incoming, and committed quantities, and that the data is properly linked back to variants and products.
</objective>

<must_haves>
- Inventory bulk query fetches inventoryItems with inventoryLevels per location
- Quantities include: available, on_hand, incoming, committed
- Each inventory level row includes: locationId, locationName, sku, variantId, productId, productTitle
- Inventory bulk operation runs concurrently with the products bulk operation
- JSONL parser correctly handles the inventoryItem (root) → inventoryLevel (child) relationship
</must_haves>

<tasks>

<task id="4.1">
<title>Verify inventory bulk mutation in src/pull.js</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/src/pull.js
- /Users/srijan/Desktop/Rana App ITG/.planning/phases/01-setup-data-pipeline/01-RESEARCH.md (Section 5)
</read_first>
<action>
Verify that the `BULK_INVENTORY_MUTATION` in `src/pull.js` (created in Plan 3) includes all required fields. The mutation should contain:

1. Root resource: `inventoryItems` with edges/node containing:
   - `id`, `sku`, `tracked`
   - `variant { id, sku, product { id, title } }`
2. Nested connection: `inventoryLevels` with edges/node containing:
   - `id`
   - `quantities(names: ["available", "on_hand", "incoming", "committed"])` with `name` and `quantity`
   - `location { id, name }`

If any of these fields are missing from the Plan 3 implementation, add them. The inventory query is intentionally separate from the products query because bulk operations only support 2 levels of nesting — product -> variant -> inventoryLevels would be 3 levels, which is not allowed.

Also verify in the `pull()` function that:
- The inventory bulk operation is triggered AFTER the products bulk operation (so both IDs are available)
- Both operations are polled concurrently via `Promise.all([pollBulkOperation(productOpId), pollBulkOperation(inventoryOpId)])`
- The inventory URL is passed to `downloadInventoryJsonl(inventoryUrl)` and its result assigned to `inventoryLevels`
</action>
<acceptance_criteria>
- src/pull.js contains `inventoryItems` in the BULK_INVENTORY_MUTATION
- src/pull.js contains `inventoryLevels` as a nested connection under inventoryItems
- src/pull.js contains `quantities(names: ["available", "on_hand", "incoming", "committed"])`
- src/pull.js contains `location { id` and `name }` in the inventory query
- src/pull.js contains `variant { id` with `product { id, title }` in the inventory query
- src/pull.js calls `downloadInventoryJsonl` with the inventory URL
- src/pull.js polls both operations concurrently with `Promise.all`
</acceptance_criteria>
</task>

<task id="4.2">
<title>Verify inventory JSONL parser in src/jsonl.js</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/src/jsonl.js
- /Users/srijan/Desktop/Rana App ITG/.planning/phases/01-setup-data-pipeline/01-RESEARCH.md (Section 5)
</read_first>
<action>
Verify that `downloadInventoryJsonl(url)` in `src/jsonl.js` (created in Plan 3) correctly:

1. Treats objects WITHOUT `__parentId` as root `inventoryItem` objects and stores them in a Map keyed by `id`
2. Treats objects WITH `__parentId` as child `inventoryLevel` objects
3. For each inventory level, creates a flat row with these fields:
   - `inventoryItemId` — from `__parentId`
   - `sku` — from the parent inventoryItem's `sku` field
   - `variantId` — from the parent's `variant.id`
   - `productId` — from the parent's `variant.product.id`
   - `productTitle` — from the parent's `variant.product.title`
   - `locationId` — from `obj.location.id`
   - `locationName` — from `obj.location.name`
   - `available` — from quantities array, name="available"
   - `onHand` — from quantities array, name="on_hand"
   - `incoming` — from quantities array, name="incoming"
   - `committed` — from quantities array, name="committed"
4. Returns `{ inventoryLevels: Array }` where each element is a flat row object

If the quantities parsing does not iterate `obj.quantities` array looking for each named quantity, fix it. The quantities come as `[{name: "available", quantity: 5}, {name: "on_hand", quantity: 5}, ...]` and must be flattened into individual fields.
</action>
<acceptance_criteria>
- src/jsonl.js `downloadInventoryJsonl` stores root objects (no __parentId) in a Map
- src/jsonl.js `downloadInventoryJsonl` looks up parent via `inventoryItems.get(obj.__parentId)`
- src/jsonl.js `downloadInventoryJsonl` returns object with `inventoryLevels` array
- src/jsonl.js `downloadInventoryJsonl` flattens quantities array into `available`, `onHand`, `incoming`, `committed` fields
- src/jsonl.js `downloadInventoryJsonl` includes `locationName` and `locationId` from `obj.location`
- src/jsonl.js `downloadInventoryJsonl` includes `sku`, `variantId`, `productId`, `productTitle` from parent
</acceptance_criteria>
</task>

</tasks>

<verification>
```bash
# Verify inventory mutation fields in pull.js
grep 'inventoryItems' src/pull.js
grep 'inventoryLevels' src/pull.js
grep '"available"' src/pull.js
grep '"on_hand"' src/pull.js
grep '"incoming"' src/pull.js
grep '"committed"' src/pull.js
grep 'location {' src/pull.js

# Verify inventory parser in jsonl.js
grep 'downloadInventoryJsonl' src/jsonl.js
grep 'locationName' src/jsonl.js
grep 'available' src/jsonl.js
grep 'onHand' src/jsonl.js

# Verify concurrent polling
grep 'Promise.all' src/pull.js
```
</verification>
