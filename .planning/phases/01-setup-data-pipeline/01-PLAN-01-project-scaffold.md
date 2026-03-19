---
phase: 1
plan: 1
title: "Project Scaffold"
wave: 1
depends_on: []
requirements: [SETUP-01, SETUP-02]
files_modified: [package.json, .env.example, .env, .gitignore, src/config.js, exports/.gitkeep, snapshots/.gitkeep]
autonomous: true
---

# Plan 1: Project Scaffold

<objective>
Create the project directory structure, initialize package.json with ESM support, set up environment variable configuration for the Shopify Admin API token, and establish .gitignore rules to prevent secrets and large data files from being committed.
</objective>

<must_haves>
- package.json with "type": "module" and dependencies (dotenv, csv-stringify)
- .env file with SHOPIFY_STORE, SHOPIFY_ACCESS_TOKEN, SHOPIFY_API_VERSION placeholders
- .gitignore that excludes .env, node_modules/, snapshots/
- src/config.js that loads .env and exports store/token/apiVersion/endpoint
- Directory structure: src/, exports/, snapshots/
</must_haves>

<tasks>

<task id="1.1">
<title>Initialize package.json with ESM and dependencies</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/CLAUDE.md
- /Users/srijan/Desktop/Rana App ITG/.planning/phases/01-setup-data-pipeline/01-RESEARCH.md (Section 2)
</read_first>
<action>
Create `package.json` in the project root with the following exact content:

```json
{
  "name": "rana-shopify-monitor",
  "version": "1.0.0",
  "description": "Read-only Shopify PM monitoring tool for Rana Furniture",
  "type": "module",
  "scripts": {
    "pull": "node src/index.js pull"
  },
  "dependencies": {
    "csv-stringify": "^6.6.0",
    "dotenv": "^16.0.0"
  }
}
```

Then run `npm install` to generate node_modules and package-lock.json.
</action>
<acceptance_criteria>
- package.json contains `"type": "module"`
- package.json contains `"csv-stringify"` in dependencies
- package.json contains `"dotenv"` in dependencies
- package.json contains `"pull": "node src/index.js pull"` in scripts
- node_modules/ directory exists after npm install
</acceptance_criteria>
</task>

<task id="1.2">
<title>Create .gitignore</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/.planning/phases/01-setup-data-pipeline/01-RESEARCH.md (Section 2)
</read_first>
<action>
Create `.gitignore` in the project root with these entries:

```
.env
node_modules/
snapshots/
exports/
```

The `.env` exclusion is critical — the Shopify access token must never be committed. `snapshots/` and `exports/` contain potentially large data files that should stay local.
</action>
<acceptance_criteria>
- .gitignore contains `.env` on its own line
- .gitignore contains `node_modules/` on its own line
- .gitignore contains `snapshots/` on its own line
</acceptance_criteria>
</task>

<task id="1.3">
<title>Create .env.example and .env</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/CLAUDE.md
- /Users/srijan/Desktop/Rana App ITG/.planning/phases/01-setup-data-pipeline/01-RESEARCH.md (Section 2)
</read_first>
<action>
Create `.env.example` (committed to git as a template):

```
SHOPIFY_STORE=y01sdh-0b.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_REPLACE_ME
SHOPIFY_API_VERSION=2026-01
```

Create `.env` (gitignored, actual values):

```
SHOPIFY_STORE=y01sdh-0b.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_REPLACE_ME
SHOPIFY_API_VERSION=2026-01
```

The store domain `y01sdh-0b.myshopify.com` comes from CLAUDE.md. The token placeholder `shpat_REPLACE_ME` must be replaced by Mike after he creates the custom app in Shopify admin (see SETUP-01 instructions in 01-RESEARCH.md Section 1).
</action>
<acceptance_criteria>
- .env.example exists and contains `SHOPIFY_STORE=y01sdh-0b.myshopify.com`
- .env.example contains `SHOPIFY_ACCESS_TOKEN=shpat_REPLACE_ME`
- .env.example contains `SHOPIFY_API_VERSION=2026-01`
- .env exists with the same three variables
</acceptance_criteria>
</task>

<task id="1.4">
<title>Create directory structure and src/config.js</title>
<read_first>
- /Users/srijan/Desktop/Rana App ITG/.planning/phases/01-setup-data-pipeline/01-RESEARCH.md (Section 2, src/config.js)
</read_first>
<action>
Create these directories:
- `src/`
- `exports/` (with a `.gitkeep` file so the empty dir is tracked)
- `snapshots/` (with a `.gitkeep` file)

Create `src/config.js`:

```javascript
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
```

This module:
- Loads dotenv at import time
- Exports a `config` object with `store`, `token`, `apiVersion`, and computed `endpoint`
- Exits with an error if required env vars are missing (fail-fast)
</action>
<acceptance_criteria>
- src/config.js imports `dotenv/config`
- src/config.js exports `config` with properties `store`, `token`, `apiVersion`, `endpoint`
- src/config.js contains `process.env.SHOPIFY_STORE`
- src/config.js contains `process.env.SHOPIFY_ACCESS_TOKEN`
- src/config.js calls `process.exit(1)` when env vars are missing
- exports/ directory exists
- snapshots/ directory exists
</acceptance_criteria>
</task>

</tasks>

<verification>
```bash
# Verify package.json
node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.assert(p.type === 'module'); console.assert(p.dependencies.dotenv); console.assert(p.dependencies['csv-stringify']); console.log('package.json OK');"

# Verify .gitignore
grep -q '^\.env$' .gitignore && echo ".gitignore has .env" || echo "FAIL: .env not in .gitignore"
grep -q '^node_modules/' .gitignore && echo ".gitignore has node_modules" || echo "FAIL"
grep -q '^snapshots/' .gitignore && echo ".gitignore has snapshots" || echo "FAIL"

# Verify config.js loads
node -e "import('./src/config.js').catch(e => { if (e.message.includes('Missing')) { console.log('config.js correctly rejects missing token'); } else { console.error(e); } })"

# Verify directories exist
test -d src && echo "src/ OK" || echo "FAIL: src/"
test -d exports && echo "exports/ OK" || echo "FAIL: exports/"
test -d snapshots && echo "snapshots/ OK" || echo "FAIL: snapshots/"
```
</verification>
