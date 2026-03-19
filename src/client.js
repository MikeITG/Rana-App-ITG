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
