# Rana Furniture — Shopify PM Monitoring Tool

## What This Project Is

A read-only monitoring tool for a Shopify store (Rana Furniture) that lets the PM independently verify store data, track dev work, and audit Celigo sync results — without depending on anyone else.

This is NOT a store management tool. It does NOT write data. It only reads.

## Who Is Using This

Mike — PM intern at IT Geeks (Shopify Platinum Partner). He's managing a Blueport → Shopify migration for Rana Furniture. He needs to verify what the dev builds, catch issues before the client does, and have data ready when anyone asks.

## The Business Context

- **Client**: Rana Furniture (Florida furniture retailer)
- **Migration**: Blueport (legacy) → Shopify (OS 2.0)
- **ERP**: NetSuite (system of record for products, inventory, pricing)
- **Connector**: Celigo (NetSuite → Shopify sync, onboarding next week)
- **Store URL**: y01sdh-0b.myshopify.com
- **Products**: 2,482 currently in Shopify (all standalone items, no kits yet)

## The Problem This Solves

Right now, every time someone needs a data point, it turns into a multi-day email chain between Mike, the client (Ana), and the dev. The dev says "we don't have data." The client doesn't know what data exists. Mike loses time chasing answers.

This tool gives Mike instant answers:
- "How many products are active vs draft right now?"
- "Which products have wrong inventory policy?"
- "Did the dev change anything since yesterday?"
- "Does Shopify match NetSuite for SKU X?"
- "Show me every product missing images/SEO/weight"
- "Is the Celigo sync working correctly?"

## Shopify Admin API Setup

### Connection Details
- **Store**: y01sdh-0b.myshopify.com
- **API Version**: 2025-01 (or latest stable)
- **Auth**: Admin API access token (from custom app)
- **Token**: [WILL BE PROVIDED — do not hardcode, use .env]

### Required Scopes (READ-ONLY)
- `read_products` — catalog, variants, metafields
- `read_inventory` — stock levels by location
- `read_orders` — order data for post-launch testing
- `read_themes` — verify theme code if needed

### Rate Limits
- REST: 40 requests per second (2/sec bucket refill)
- GraphQL: 100 points per second (Advanced plan)
- Use GraphQL for bulk queries — it's more efficient

## What The Tool Should Do

### Core Audit Commands

1. **Product Health Check** (`audit:products`)
   - Total products, active vs draft vs archived
   - Field completeness: title, description, images, price, weight, barcode
   - SEO coverage: title_tag, description_tag populated vs empty
   - Product Type populated vs empty
   - Inventory policy distribution (deny vs continue)

2. **Inventory Policy Audit** (`audit:policy`)
   - Read metafield `custom.out_of_stock_behavior_bp` for each product
   - Compare against current `inventory_policy` on variant
   - Flag mismatches:
     - Metafield contains "Allow back orders" BUT policy = "deny" → WRONG
     - Metafield = "Remove item when out-of-stock" BUT policy = "continue" → WRONG
   - Output: list of SKUs that need fixing

3. **Discontinued Check** (`audit:discontinued`)
   - Products that are Active + have tag "CLEARANCE" or metafield indicating discontinued
   - Cross-reference with total inventory = 0
   - These should be Draft, not Active

4. **NetSuite Comparison** (`audit:compare`)
   - Takes a NetSuite export CSV as input
   - Matches on SKU (variant SKU in Shopify ↔ terminal segment of Name in NetSuite)
   - Compares: price, title, inventory qty, weight
   - Outputs: match/mismatch report

5. **Image Audit** (`audit:images`)
   - Products with 0 images
   - Products with only 1 image
   - Active products with no images (critical)

6. **Change Detection** (`audit:changes`)
   - Compares current state against a saved snapshot
   - Shows what changed: new products, status changes, price changes, inventory changes
   - Useful for: "what did the dev do today?" or "what did Celigo just sync?"

### Data Flow

```
Shopify Admin API (read-only)
        ↓
   GraphQL queries
        ↓
   Local JSON snapshots (saved to /snapshots/)
        ↓
   Comparison / audit logic
        ↓
   Terminal output + optional CSV export
```

## Known Issues Found in Audit (March 18, 2026)

These are the confirmed issues from our data audit. The tool should be able to detect all of these:

| Issue | Count | Severity |
|-------|-------|----------|
| Inventory policy ALL "deny" — 853 should be "continue" | 853 | CRITICAL |
| Active products: backorderable, 0 stock, policy=deny (can't buy) | 224 | CRITICAL |
| Discontinued + 0 stock but still Active | 359 | CRITICAL |
| SEO title_tag empty | 2,482 | HIGH |
| SEO description_tag empty | 2,482 | HIGH |
| Product Type empty | 2,482 | HIGH |
| All weights = 0 | 2,482 | HIGH |
| Compare At Price empty | 2,482 | MEDIUM |
| Active products with 0 images | 73 | MEDIUM |
| Body HTML missing | 83 | LOW |

## Key Metafields on Products

| Metafield | Type | Purpose |
|-----------|------|---------|
| `custom.out_of_stock_behavior_bp` | single_line_text_field | OOS behavior from NetSuite/Blueport |
| `custom.product_next_available_date` | date_time | Expected restock date |
| `custom.product_first_live_date` | date_time | First live date |
| `custom.product_dimension` | single_line_text_field | H x W x D |
| `custom.product_style` | single_line_text_field | Style category |
| `custom.unique_feature` | multi_line_text_field | Feature bullets |
| `custom.warranty_eligibility` | single_line_text_field | Protection plan tier |
| `custom.vendor_product_number` | single_line_text_field | Vendor SKU |
| `custom.internal_id` | single_line_text_field | NetSuite Internal ID |
| `custom.floor_sample` | single_line_text_field | Floor sample flag |

## Tech Stack

- **Language**: Node.js (since Claude Code runs on it already)
- **API Client**: @shopify/shopify-api or raw fetch with GraphQL
- **Config**: .env file for token (NEVER commit to git)
- **Output**: Terminal tables + CSV export option
- **Snapshots**: JSON files in /snapshots/ directory

## File Structure

```
rana-shopify-monitor/
├── CLAUDE.md              ← this file (project context)
├── .env                   ← SHOPIFY_ACCESS_TOKEN (gitignored)
├── .gitignore
├── package.json
├── src/
│   ├── config.js          ← store URL, API version, token loader
│   ├── client.js          ← GraphQL client wrapper
│   ├── queries/           ← GraphQL query strings
│   │   ├── products.js
│   │   ├── inventory.js
│   │   └── metafields.js
│   ├── audits/            ← audit logic
│   │   ├── products.js    ← product health check
│   │   ├── policy.js      ← inventory policy audit
│   │   ├── discontinued.js
│   │   ├── images.js
│   │   ├── compare.js     ← NetSuite comparison
│   │   └── changes.js     ← change detection
│   ├── snapshot.js        ← save/load snapshots
│   └── index.js           ← CLI entry point
├── snapshots/             ← saved state files
└── exports/               ← CSV output files
```

## Important Constraints

- **READ-ONLY**: Never write to the store. No mutations. If we need to fix data, that's done via Matrixify or the dev's Shopify Flows.
- **No secrets in code**: Token in .env only, .gitignore must include .env
- **Rate limit aware**: Use GraphQL bulk operations for large queries, respect 100 pts/sec
- **Celigo safe**: This tool must not interfere with Celigo sync. Read-only guarantees this.

## Development Phases

### Phase 1 (This Week)
- [ ] Project setup (package.json, .env, client)
- [ ] Product health check audit
- [ ] Inventory policy audit
- [ ] Snapshot save/load

### Phase 2 (Next Week — during Celigo onboarding)
- [ ] Change detection (before/after Celigo sync comparison)
- [ ] NetSuite comparison audit
- [ ] CSV export for all audits

### Phase 3 (Ongoing)
- [ ] Image audit
- [ ] Discontinued check automation
- [ ] Scheduled snapshot + diff (cron or manual)
