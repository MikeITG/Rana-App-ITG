# Research Summary: Shopify App for IT Geeks

> Synthesized from: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
> Date: 2026-03-19

---

## Stack Decision

| Layer | Choice | Confidence |
|-------|--------|------------|
| Scaffold | `shopify app init` → React Router v7 template | High |
| Framework adapter | `@shopify/shopify-app-react-router` | High |
| Auth strategy | Token Exchange (Shopify Managed Installation) | High |
| Token type | Offline access tokens (store-scoped, for background reads) | High |
| API client | `admin.graphql()` from `authenticate.admin()` | High |
| API version | `2026-01` (stable) | High |
| UI | Polaris + App Bridge (auto-configured via AppProvider) | High |
| Session storage | Prisma + SQLite (dev) → PostgreSQL (production) | High |
| Deployment | Fly.io (persistent volumes, Dockerfile in template) | Medium |
| Distribution | Custom app for v1 (Rana) → unlisted public app for multi-store | Medium |

**Key insight:** Shopify moved from Remix to React Router v7 as the default template. The API surface is nearly identical. Do NOT use Next.js (dropped as official template) or raw fetch for API calls.

---

## Table Stakes for a Working App

1. **OAuth + offline token** — app must complete auth on install, store offline token for background API access
2. **3 GDPR webhooks** — `customers/data_request`, `customers/redact`, `shop/redact` (mandatory for public apps, recommended for custom)
3. **Embedded UI** — at least one admin page via App Bridge + Polaris
4. **Read-only scopes only** — `read_products`, `read_inventory`, `read_locations`
5. **HTTPS** — handled by Shopify CLI tunnel and Fly.io
6. **Supported API version** — `2026-01`, update quarterly

---

## Architecture: How It Works

```
Merchant opens app in Shopify admin
    → Shopify loads app URL in iframe
    → App Bridge fetches session token (JWT, 1-min TTL)
    → Frontend sends request with session token
    → Backend validates JWT, looks up stored offline token
    → Backend calls Shopify GraphQL Admin API
    → Returns audit data → Polaris UI renders results
```

**For background sync (no user present):** Use offline token directly, no session token needed.

---

## Data Strategy for 2,482+ Products

| Pattern | Use When | Why |
|---------|----------|-----|
| **Bulk operations** (`bulkOperationRunQuery`) | Full sync on install, nightly refresh | Bypasses all rate limits, handles large catalogs |
| **Paginated queries** (250/page, `updated_at` filter) | Incremental sync between bulk runs | Cost-efficient for delta updates |
| **Webhooks** (`products/update`, `inventory_levels/update`) | Event-driven updates (Phase 2+) | Real-time deltas once pipeline is stable |

**Rate limits:** 100 pts/sec (Standard), 1,000 pt max per query. Bulk operations bypass these entirely.

**Deprecated fields to avoid:** `images` → `media`, `bodyHtml` → `descriptionHtml`, `priceRange` → `priceRangeV2`, `featuredImage` → `featuredMedia`

---

## Top 5 Pitfalls to Prevent

1. **Session tokens ≠ API tokens** — session tokens (1-min JWT from App Bridge) prove the request is from Shopify admin. Offline access tokens authorize API calls. Don't mix them.
2. **1,000-point query ceiling** — deeply nested queries (products → variants → metafields → media) hit this fast. Keep queries shallow, paginate nested data separately.
3. **GDPR webhooks** — stub all 3 endpoints in Phase 1 even for custom app. Retrofit is painful when going multi-store.
4. **Offline tokens for background sync** — building with only online tokens means scheduled data pulls break when no user is logged in.
5. **Deprecated product fields** — build all GraphQL queries against 2026-01 schema from day one.

---

## Build Order (Recommended)

1. **Scaffold + Auth** — `shopify app init`, configure TOML, verify app installs and loads in admin iframe
2. **Read Products** — `admin.graphql()` query, render basic product table with Polaris
3. **Bulk Sync** — implement `bulkOperationRunQuery` for full catalog pull on install
4. **Audit Logic** — pure functions: policy mismatch check, discontinued check, image audit, field completeness
5. **Audit Dashboard** — Polaris DataTable + Badge components showing pass/fail results
6. **GDPR Stubs** — 3 webhook endpoints returning 200 (full implementation in Phase 2)
7. **Deploy** — Fly.io, `shopify app deploy`, verify in Partners dashboard
8. **Multi-store** — Prisma session isolation by shop domain, test on second store

---

## What Changed From Original CLAUDE.md Plan

The original plan was a **CLI tool** using raw GraphQL fetch with a custom access token. Research shows:

| Original Plan | Research Recommendation | Why |
|---------------|------------------------|-----|
| CLI tool (`node src/index.js audit:products`) | Embedded Shopify app (admin UI) | Proper installable app, OAuth, session management, Polaris UI |
| Raw fetch + access token | `admin.graphql()` from framework adapter | Handles auth, rate limits, token refresh automatically |
| Local JSON snapshots | Prisma database + bulk operations | Proper persistence, queryable, survives deploys |
| Manual token in .env | Shopify OAuth (Token Exchange) | Secure, auto-provisioned, no manual token management |
| Terminal output | Polaris DataTable + Badge | Professional admin-native UI, consistent with Shopify |

**The core audit logic stays the same** — but the delivery mechanism changes from CLI to embedded app. This makes it installable on client stores without giving the PM raw API access, and sets up the foundation for the multi-store AI-powered platform.

---

*Research complete: 2026-03-19*
