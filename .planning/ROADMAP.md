# Roadmap: Rana Shopify PM Monitor

**Created:** 2026-03-19
**Milestone:** v1.0 — Read-only data pull + audit tool for Rana Furniture
**Phases:** 3
**Granularity:** Coarse

---

## Phase 1: Project Setup & Data Pipeline

**Goal:** Scaffold the project, authenticate with Shopify Admin API, and pull all store data into local CSV/JSON files.

**Requirements:** SETUP-01, SETUP-02, SETUP-03, SETUP-04, PULL-01, PULL-02, PULL-03, PULL-04, PULL-05, PULL-06, PULL-07

**Success Criteria:**
1. Running `node src/index.js pull` fetches all 2,482 products with variants, metafields, inventory, and images from Rana's store
2. Data is saved as both raw JSON snapshot (timestamped in /snapshots/) and structured CSV files (products.csv, variants.csv, inventory.csv in /exports/)
3. Rate limiting is handled gracefully — bulk operation for full pull, retry/backoff for paginated queries
4. No secrets in code — .env for token, .gitignore covers .env and snapshots

**Dependencies:** Shopify custom app created with read-only scopes (Mike does this in Shopify admin)

---

## Phase 2: Audit Commands

**Goal:** Build audit functions that analyze pulled data and output actionable reports — the core PM value.

**Requirements:** AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05

**Success Criteria:**
1. `node src/index.js audit:products` outputs product health summary (active/draft/archived counts, field completeness percentages)
2. `node src/index.js audit:policy` detects all 853 inventory policy mismatches (metafield says "Allow back orders" but policy = "deny") and exports to CSV
3. `node src/index.js audit:discontinued` finds 359 discontinued products still active with 0 stock
4. `node src/index.js audit:images` reports 73 active products with 0 images
5. All audit results exportable as CSV to /exports/

**Dependencies:** Phase 1 complete (data available locally)

---

## Phase 3: Snapshots & Change Detection

**Goal:** Track store changes over time — before/after dev work, before/after Celigo sync.

**Requirements:** SNAP-01, SNAP-02, SNAP-03

**Success Criteria:**
1. `node src/index.js snapshot:save` stores current state with timestamp
2. `node src/index.js audit:changes` compares latest pull against saved snapshot
3. Change report shows: new products, removed products, status changes, price changes, inventory changes, policy changes
4. Output is clear enough for Mike to paste into a client status update

**Dependencies:** Phase 1 complete (pull mechanism), Phase 2 helpful but not blocking

---

## Phase Summary

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Setup & Data Pipeline | Pull all store data into local files | SETUP-01–04, PULL-01–07 | 4 criteria |
| 2 | Audit Commands | Analyze data, detect known issues | AUDIT-01–05 | 5 criteria |
| 3 | Snapshots & Changes | Track changes over time | SNAP-01–03 | 4 criteria |

---
*Roadmap created: 2026-03-19*
*Last updated: 2026-03-19 after initial creation*
