---
phase: 1
plan: 2
status: complete
---
# Summary: Plan 01-02 — GraphQL Client

## What Was Built

`src/client.js` — the core GraphQL client module for the Rana Shopify PM Monitor.

Two exported functions:

- **`graphql(query, variables)`** — low-level function that sends authenticated POST requests to the Shopify Admin API (2026-01) using native `fetch`. Detects `THROTTLED` error codes in GraphQL error arrays and re-throws with `{ isThrottle: true }` so the retry layer can handle them. Throws on HTTP errors and any other GraphQL errors.

- **`graphqlWithRetry(query, variables, maxRetries)`** — wrapper with exponential backoff retry on throttle. Backoff formula: `min(1000 * 2^attempt, 30000)` — caps at 30 seconds. Also proactively pauses before the next request if `throttleStatus.currentlyAvailable < 100` points, using the response's `restoreRate` to calculate wait time (defaults to 50 pts/sec).

## Key Files Created

- `/Users/srijan/Desktop/Rana App ITG/src/client.js`

## Decisions Made

No deviations from the plan. The implementation matches the specification in 01-02-PLAN.md exactly:

- Uses native `fetch` (Node 18+) — no `node-fetch` dependency
- Imports from `./config.js` (created by plan 01-01)
- Both functions exported for caller flexibility
- `graphql()` is the primitive; `graphqlWithRetry()` wraps it

## Self-Check: PASSED
