---
phase: 2
plan: 4
status: complete
---

# Summary: Plan 04 — Image Audit

## What Was Built

`src/audits/images.js` — ESM module exporting `auditImages(snapshot)`.

## Implementation

- Reads `mediaCount` from each product row in the snapshot (computed during pull phase, no live API calls)
- Classifies products into three tiers by priority:
  - `ACTIVE_NO_IMAGES` — Active products with 0 images (critical: broken storefront)
  - `DRAFT_NO_IMAGES` — Draft/Archived products with 0 images
  - `ONE_IMAGE_ONLY` — Any product with exactly 1 image
- Returns `{ summary, rows }` where rows contain `{ productId, title, handle, status, mediaCount, issueType, updatedAt }`
- Terminal output groups results by severity: ACTIVE_NO_IMAGES first, then ONE_IMAGE_ONLY (first 20)
- No external dependencies

## Acceptance Criteria

All criteria verified via grep:
- [x] `export function auditImages` exported
- [x] `ACTIVE_NO_IMAGES` issue type defined and used
- [x] `DRAFT_NO_IMAGES` issue type defined and used
- [x] `ONE_IMAGE_ONLY` issue type defined and used
- [x] `mediaCount` used in classification logic
- [x] `issueType` set in rows
- [x] `return { summary, rows }` present
- [x] No external import statements

## Known Data (March 2026)

Per CLAUDE.md, 73 active products with 0 images are expected in the store.
