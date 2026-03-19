---
phase: 3
plan: 2
status: complete
---

# Summary: CLI Wiring — snapshot:save and audit:changes

## What Was Done

### Task 2.1 — exportAuditChangesCsv added to src/csv.js
- Added `AUDIT_CHANGES_PRODUCT_COLUMNS` (8 columns: productId, title, handle, status, changeType, field, from, to)
- Added `AUDIT_CHANGES_VARIANT_COLUMNS` (7 columns: sku, productId, productTitle, changeType, field, from, to)
- Added `exportAuditChangesCsv(productChanges, variantChanges)` — calls exportCsv twice, writing `exports/audit-changes-products.csv` and `exports/audit-changes-variants.csv`

### Task 2.2 — snapshot:save and audit:changes wired into src/index.js
- Added import for `diffSnapshots` from `./audits/changes.js`
- Added `exportAuditChangesCsv` to the existing csv.js destructured import
- Added `runSnapshotSave()` — loads latest 'pull' snapshot, re-saves it as 'baseline' (no API call needed), prints instructions for next steps
- Added `runAuditChanges()` — loads latest 'baseline' and 'pull' snapshots, calls diffSnapshots(), exports both CSVs
- Added `case 'snapshot:save'` and `case 'audit:changes'` to the switch statement
- Updated help/usage text with both new commands

## Error Handling
- `snapshot:save` exits with code 1 and a clear message if no pull snapshot exists
- `audit:changes` exits with code 1 and a clear message if no baseline snapshot exists
- `audit:changes` exits with code 1 and a clear message if no pull snapshot exists

## Commits
- `feat(03-02): add exportAuditChangesCsv to src/csv.js`
- `feat(03-02): wire snapshot:save and audit:changes into CLI`

## Files Modified
- `src/csv.js` — added 29 lines (column defs + export function)
- `src/index.js` — added 65 lines (imports, functions, switch cases, help text)

## Verification
- `node src/index.js` help text includes both `snapshot:save` and `audit:changes`
- `node src/index.js snapshot:save` (no pull snapshot) → clean error, exit 1
- `node src/index.js audit:changes` (no baseline) → clean error, exit 1
- All existing commands unchanged
