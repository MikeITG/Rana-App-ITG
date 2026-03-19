# Requirements: Rana Shopify PM Monitor

**Defined:** 2026-03-19
**Core Value:** PM can independently pull and audit store data through Claude — no screenshots, no email chains, no waiting on the dev.

## v1 Requirements

### Setup & Auth

- [ ] **SETUP-01**: Custom Shopify app created with read-only scopes (read_products, read_inventory, read_locations)
- [ ] **SETUP-02**: OAuth token stored securely in .env (never committed to git)
- [ ] **SETUP-03**: GraphQL client configured for Shopify Admin API (2026-01)
- [ ] **SETUP-04**: Rate limit handling with retry/backoff on 429 responses

### Data Pull

- [ ] **PULL-01**: Pull all products via bulk operation (bulkOperationRunQuery) → save as JSON
- [ ] **PULL-02**: Pull all variants with SKU, price, weight, barcode, inventory_policy
- [ ] **PULL-03**: Pull all product metafields (especially custom.out_of_stock_behavior_bp, custom.internal_id)
- [ ] **PULL-04**: Pull inventory levels per location (available, on_hand quantities)
- [ ] **PULL-05**: Pull product media/images count per product
- [ ] **PULL-06**: Export pulled data as CSV files (products.csv, variants.csv, inventory.csv)
- [ ] **PULL-07**: Save raw JSON snapshots to /snapshots/ with timestamp

### Audits

- [ ] **AUDIT-01**: Product health check — totals, status breakdown (active/draft/archived), field completeness (description, images, weight, SEO tags, product type)
- [ ] **AUDIT-02**: Inventory policy mismatch — compare metafield custom.out_of_stock_behavior_bp against variant inventory_policy, flag mismatches
- [ ] **AUDIT-03**: Discontinued product detection — active products with 0 stock + OOS behavior = "Remove item when out-of-stock"
- [ ] **AUDIT-04**: Image audit — products with 0 images, active products with no images
- [ ] **AUDIT-05**: CSV export for each audit result

### Snapshots & Change Detection

- [ ] **SNAP-01**: Save current store state as timestamped snapshot
- [ ] **SNAP-02**: Diff two snapshots — show what changed (new products, status changes, price changes, inventory changes)
- [ ] **SNAP-03**: Terminal output showing change summary

## v2 Requirements

### Advanced Audits

- **ADV-01**: NetSuite CSV comparison — match on SKU, compare price/title/inventory/weight
- **ADV-02**: SEO completeness report with recommendations
- **ADV-03**: Metafield completeness matrix (all custom.* fields)

### Theme Integration

- **THEME-01**: Connect developer's GitHub theme repo
- **THEME-02**: Claude cross-references store data with theme Liquid templates
- **THEME-03**: Identify products referenced in theme that don't exist in store data

### Multi-Store

- **MULTI-01**: Support multiple store configs (switch between clients)
- **MULTI-02**: Per-store snapshot isolation
- **MULTI-03**: Comparison reports across stores

## Out of Scope

| Feature | Reason |
|---------|--------|
| Writing data to Shopify | Read-only tool — fixes done via Matrixify or Shopify Flows |
| Embedded Shopify admin UI (Polaris) | Not needed — Claude Code is the interface, data lives as files |
| App Bridge / iframe embedding | CLI data tool, not an admin app |
| Web dashboard | CLI + Claude Code is the UI for v1 |
| Real-time streaming | Shopify has no streaming API; bulk + scheduled pulls are sufficient |
| Webhook subscriptions | Not needed for v1 CLI tool — manual pulls first |
| GDPR compliance webhooks | Not needed for custom single-store app; add when going multi-store |
| Billing API | Internal tool, no merchant billing |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 1 | Pending |
| SETUP-02 | Phase 1 | Pending |
| SETUP-03 | Phase 1 | Pending |
| SETUP-04 | Phase 1 | Pending |
| PULL-01 | Phase 1 | Pending |
| PULL-02 | Phase 1 | Pending |
| PULL-03 | Phase 1 | Pending |
| PULL-04 | Phase 1 | Pending |
| PULL-05 | Phase 1 | Pending |
| PULL-06 | Phase 1 | Pending |
| PULL-07 | Phase 1 | Pending |
| AUDIT-01 | Phase 2 | Pending |
| AUDIT-02 | Phase 2 | Pending |
| AUDIT-03 | Phase 2 | Pending |
| AUDIT-04 | Phase 2 | Pending |
| AUDIT-05 | Phase 2 | Pending |
| SNAP-01 | Phase 3 | Pending |
| SNAP-02 | Phase 3 | Pending |
| SNAP-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after initial definition*
