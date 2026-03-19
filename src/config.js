import 'dotenv/config';

export const config = {
  store: process.env.SHOPIFY_STORE,
  token: process.env.SHOPIFY_ACCESS_TOKEN,
  apiVersion: process.env.SHOPIFY_API_VERSION || '2026-01',
  get endpoint() {
    return `https://${this.store}/admin/api/${this.apiVersion}/graphql.json`;
  },
};

if (!config.store || !config.token) {
  console.error('ERROR: Missing SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN in .env');
  process.exit(1);
}
