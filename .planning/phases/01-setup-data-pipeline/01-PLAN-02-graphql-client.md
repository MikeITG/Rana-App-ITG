---
phase: 1
plan: 2
title: "GraphQL Client + Rate Limiting"
wave: 1
depends_on: []
requirements: [SETUP-03, SETUP-04]
files_modified: [src/client.js]
autonomous: true
---

# Plan 2: GraphQL Client + Rate Limiting

<objective>
Build the core GraphQL client module that sends authenticated requests to the Shopify Admin API (2026-01), detects throttle responses, implements exponential backoff retry logic, and proactively pauses when remaining API capacity is low.
</objective>

<must_haves>
- A `graphql(query, variables)` function that sends POST requests to the Shopify GraphQL endpoint with the access token header
- Throttle detection: identify `THROTTLED` error code in GraphQL response errors
- A `graphqlWithRetry(query, variables, maxRetries)` wrapper with exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)
- Proactive capacity check: if `throttleStatus.currentlyAvailable < 100`, pause before the next request
- Uses native `fetch` (Node 18+), NOT node-fetch
</must_haves>

<tasks>

<task id="2.1">
<title>Create src/client.js with graphql() base function</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/.planning/phases/01-setup-data-pipeline/01-RESEARCH.md (Section 2, src/client.js and Section 4)
- /Users/srijan/Desktop/Rana App ITG/src/config.js
</read_first>
<action>
Create `src/client.js` with two exported functions:

```javascript
import { config } from './config.js';

/**
 * Send a GraphQL query to the Shopify Admin API.
 * Throws on HTTP errors and GraphQL errors.
 * Throws with { isThrottle: true } on THROTTLED responses.
 */
export async function graphql(query, variables = {}) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Shopify API HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();

  if (json.errors) {
    const throttled = json.errors.find(e => e.extensions?.code === 'THROTTLED');
    if (throttled) {
      const err = new Error('THROTTLED');
      err.isThrottle = true;
      err.extensions = json.extensions;
      throw err;
    }
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json;
}

/**
 * Send a GraphQL query with automatic retry on throttle (429).
 * Uses exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 30s).
 * Also proactively pauses when available capacity drops below 100 points.
 */
export async function graphqlWithRetry(query, variables = {}, maxRetries = 5) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const json = await graphql(query, variables);

      // Proactive capacity check — pause if running low
      const available = json.extensions?.cost?.throttleStatus?.currentlyAvailable;
      if (available !== undefined && available < 100) {
        const restoreRate = json.extensions.cost.throttleStatus.restoreRate || 50;
        const waitMs = Math.ceil((100 - available) / restoreRate) * 1000;
        console.log(`  Low API capacity (${available} pts) — waiting ${waitMs}ms`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }

      return json;
    } catch (err) {
      if (err.isThrottle) {
        attempt++;
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(`  THROTTLED — retry ${attempt}/${maxRetries} in ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        throw err;
      }
    }
  }

  throw new Error(`Max retries (${maxRetries}) exceeded — Shopify API still throttled`);
}
```

Key design decisions:
- Uses native `fetch` (Node 18+) — no npm dependency needed
- `graphql()` is the low-level function; `graphqlWithRetry()` wraps it with retry logic
- Throttle detection checks `extensions.code === 'THROTTLED'` in the GraphQL error array
- Backoff formula: `min(1000 * 2^attempt, 30000)` — caps at 30 seconds
- Proactive pause uses `restoreRate` from the response (defaults to 50 pts/sec if missing)
- Both functions are exported so callers can choose whether they want retry behavior
</action>
<acceptance_criteria>
- src/client.js exports `graphql` function
- src/client.js exports `graphqlWithRetry` function
- src/client.js contains `X-Shopify-Access-Token` header
- src/client.js contains `config.endpoint` as the fetch URL
- src/client.js checks for `extensions?.code === 'THROTTLED'`
- src/client.js contains `Math.min(1000 * Math.pow(2, attempt), 30000)` for backoff
- src/client.js contains `throttleStatus.currentlyAvailable` capacity check
- src/client.js imports from `./config.js`
- src/client.js does NOT import `node-fetch`
</acceptance_criteria>
</task>

</tasks>

<verification>
```bash
# Verify exports
grep -c 'export async function graphql' src/client.js
grep -c 'export async function graphqlWithRetry' src/client.js

# Verify auth header
grep 'X-Shopify-Access-Token' src/client.js

# Verify throttle handling
grep 'THROTTLED' src/client.js
grep 'isThrottle' src/client.js

# Verify backoff
grep 'Math.pow(2, attempt)' src/client.js
grep '30000' src/client.js

# Verify no node-fetch
! grep 'node-fetch' src/client.js && echo "No node-fetch dependency (correct)" || echo "FAIL: node-fetch found"

# Syntax check
node --check src/client.js 2>&1 || echo "Note: will fail if config.js exits due to missing .env — that is expected"
```
</verification>
