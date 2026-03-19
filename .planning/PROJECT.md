# Rana Shopify PM Monitor

## What This Is

A read-only command-line tool that connects to the Rana Furniture Shopify store via the Admin API (GraphQL) and gives the PM instant visibility into store data health, migration status, and sync accuracy. Built as a proof of concept for IT Geeks' broader AI-powered Shopify monitoring platform.

## Core Value

The PM can independently verify store data and catch issues in seconds — without emailing the dev and waiting days for answers.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Connect to Shopify Admin API (GraphQL, read-only) for store y01sdh-0b.myshopify.com
- [ ] Product health check audit: totals, status breakdown, field completeness (images, description, weight, SEO, product type)
- [ ] Inventory policy audit: compare metafield `custom.out_of_stock_behavior_bp` against variant `inventory_policy`, flag mismatches
- [ ] Discontinued product check: Active products with 0 stock + "Remove item when out-of-stock" behavior should be Draft
- [ ] NetSuite comparison: take CSV export, match on SKU, compare price/title/inventory/weight
- [ ] Image audit: products with 0 images, 1 image, active products with no images
- [ ] Change detection: save snapshots, diff current state vs snapshot to see what changed
- [ ] CSV export for all audit results
- [ ] Snapshot save/load system (JSON files)

### Out of Scope

- Writing data to Shopify — strictly read-only, fixes done via Matrixify or Shopify Flows
- Multi-store support — Rana only for now (generalization comes after POC)
- Web UI — CLI-only for v1
- Order/customer audits — product and inventory focus first
- Real-time monitoring / scheduled cron — manual CLI invocation only

## Context

- **Client**: Rana Furniture (Florida furniture retailer)
- **Migration**: Blueport (legacy) → Shopify (OS 2.0)
- **ERP**: NetSuite (system of record for products, inventory, pricing)
- **Connector**: Celigo (NetSuite → Shopify sync, onboarding imminent)
- **Store URL**: y01sdh-0b.myshopify.com
- **Products**: 2,482 currently in Shopify (all standalone items, no kits yet)
- **Organization**: IT Geeks — Shopify Platinum Partner
- **PM**: Mike — managing the Blueport → Shopify migration
- **Known critical issues**: 853 wrong inventory policies, 359 discontinued products still active, zero SEO meta tags, zero weights

### Future Vision

This is a bottom-up approach: prove the tool on Rana, then generalize for IT Geeks' other clients. The long-term goal is an AI-powered knowledge base (Claude) that has full context of any client's Shopify store data.

## Constraints

- **Read-only**: No mutations — ever. Celigo sync must not be interfered with.
- **Rate limits**: Shopify GraphQL 100 points/sec (Advanced plan). Use bulk operations for large queries.
- **Auth**: Admin API access token via .env file — never committed to git.
- **Tech stack**: Node.js, GraphQL, CLI output with terminal tables + CSV export.
- **Timeline**: Phase 1 this week (core audits), Phase 2 next week (Celigo sync verification).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CLI-only (no web UI) | Fastest to ship, PM runs from terminal, proof of concept | — Pending |
| GraphQL over REST | More efficient for bulk product queries, 100pts/sec vs 40req/sec | — Pending |
| Node.js | Already in the ecosystem, Claude Code native | — Pending |
| Bottom-up (Rana first → generalize) | Prove value before building abstractions | — Pending |
| Snapshots as JSON files | Simple, portable, diffable — no database needed for POC | — Pending |

---
*Last updated: 2026-03-19 after initialization*
