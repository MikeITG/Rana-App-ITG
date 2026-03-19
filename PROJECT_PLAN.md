# Rana Furniture — Shopify Monitor Tool Plan

## For: Mike (PM) | Date: March 18, 2026

---

## Part 1: What Is Claude Code CLI (Plain English)

Claude Code CLI is Claude — but running inside your Mac's Terminal instead of the browser chat.

**Why that matters:**

In the browser (what you're using now), Claude can read files you upload and write files you download. That's useful but limited — every time you want to work on code, you upload, I generate, you download, you run it, you come back and tell me what happened.

In Claude Code CLI, Claude sits INSIDE your project folder. It can:
- See all your files directly (no uploading)
- Create and edit code files in real-time
- Run the code and see the output
- Fix errors immediately
- Build an entire project step by step

Think of it this way:
- **Browser Claude** = you're texting a developer and exchanging files
- **Claude Code CLI** = the developer is sitting at your desk, coding on your machine

**For our use case:** You open Terminal, navigate to the project folder, type `claude`, and say "build me the product audit command." Claude Code reads the CLAUDE.md file (which has all the context), writes the code, tests it, and you have a working tool — no copy-pasting between browser and editor.

---

## Part 2: What We're Building

A command-line tool that connects to Rana's Shopify store (read-only) and answers PM questions instantly.

### Example Usage (Once Built)

```bash
# Open terminal, go to project
cd ~/rana-shopify-monitor

# Run product health check
node src/index.js audit:products

# Output:
# ┌─────────────────────┬───────┐
# │ Total Products       │ 2,482 │
# │ Active               │ 1,797 │
# │ Draft                │   685 │
# │ Missing Images       │   172 │
# │ Missing Description  │    83 │
# │ Zero Weight          │ 2,482 │
# │ No SEO Title         │ 2,482 │
# │ Policy = deny        │ 2,482 │
# │ Policy = continue    │     0 │
# └─────────────────────┴───────┘

# Check inventory policy mismatches
node src/index.js audit:policy

# Output:
# MISMATCHES FOUND: 853
# These products have OOS Behavior = "Allow back orders"
# but inventory policy = "deny"
# 224 of these are ACTIVE with 0 stock (customers can't buy)
# Exported to: exports/policy_mismatches.csv

# Save a snapshot (before dev makes changes)
node src/index.js snapshot:save

# After dev makes changes, check what changed
node src/index.js audit:changes

# Output:
# Changes since snapshot (2026-03-18 10:30am):
# - 853 products: inventory_policy changed deny → continue ✓
# - 359 products: status changed active → draft ✓
# - 0 unexpected changes
```

### What This Gives You as PM

| Situation | Without Tool | With Tool |
|-----------|-------------|-----------|
| "Did the dev fix the policy?" | Email dev, wait for response | Run audit:policy, get answer in 10 seconds |
| "Is Celigo syncing correctly?" | Ask client for NetSuite data, compare manually | snapshot before sync, audit:changes after |
| "How many products are missing images?" | Export from Matrixify, open Excel, filter | Run audit:images, instant count |
| "Client asks for status update" | Scramble to pull data | Run audit:products, share numbers |
| "What changed since yesterday?" | No way to know | snapshot:save daily, audit:changes anytime |

---

## Part 3: The Issues We Found (What the Tool Should Detect)

These are the confirmed problems from the data audit we already ran. The monitoring tool needs to be able to catch ALL of these automatically.

### CRITICAL Issues (Must Fix Before Celigo)

#### Issue 1: Inventory Policy Wrong on 853 Products
- **What**: Every product in Shopify has inventory_policy = "deny" (blocks purchase at 0 stock)
- **Problem**: 853 products SHOULD allow backorders based on their NetSuite OOS behavior
- **Impact**: 224 of those are Active with 0 stock — customers see them but CAN'T buy
- **How tool detects it**: Read metafield `custom.out_of_stock_behavior_bp`, compare against variant.inventory_policy
- **Rule**: If metafield contains "Allow back orders" → policy should be "continue"
- **Dev fix**: Shopify Flow (spec provided) + one-time Matrixify bulk update

#### Issue 2: 359 Discontinued Products Still Live
- **What**: Products marked Discontinued in NetSuite with 0 stock are Active in Shopify
- **Problem**: Customers see products that will never be restocked
- **Impact**: Makes the site look abandoned, generates support tickets
- **How tool detects it**: Check products where status=active AND total_inventory=0 AND OOS behavior="Remove item when out-of-stock"
- **Dev fix**: Shopify Flow auto-drafts when inventory hits 0

### HIGH Priority Issues

#### Issue 3: Zero SEO Meta Tags
- **What**: 0 out of 2,482 products have title_tag or description_tag
- **Problem**: Google shows generic titles instead of optimized ones
- **Impact**: Lower search rankings, worse click-through
- **How tool detects it**: Check metafields title_tag and description_tag for null/empty
- **Fix**: Matrixify bulk import from Blueport data (Celigo won't handle this)

#### Issue 4: All Weights = 0
- **What**: Every product has variant weight = 0
- **Problem**: Shipping rate calculations fail or undercharge
- **How tool detects it**: Check variant.weight for all products
- **Fix**: Celigo weight field mapping or Matrixify bulk update

### MEDIUM Priority Issues

#### Issue 5: 73 Active Products with No Images
- Active products visible to customers with zero product photos

#### Issue 6: No Product Type Set
- 0% have Product Type populated — breaks Shopify filtering/reporting

#### Issue 7: No Compare At Price
- No sale/strikethrough pricing on any product (0 out of 2,482)

---

## Part 4: Prerequisites Before You Start in Claude Code CLI

### What You Need Ready

1. **Claude Code installed on your Mac** (see install steps provided)
2. **A Shopify Custom App created** with read-only scopes
3. **The Admin API access token** saved somewhere safe (NOT in a file that gets shared)

### Creating the Shopify Custom App (you do this in Shopify Admin)

1. Go to: https://y01sdh-0b.myshopify.com/admin/settings/apps
2. Click "Develop apps" (you may need to enable developer access first)
3. Click "Create an app" → name it "PM Monitor (Read-Only)"
4. Under "Configuration" → "Admin API integration" click "Configure"
5. Select ONLY these scopes:
   - read_products
   - read_inventory
   - read_orders (for later)
6. Click "Save" then "Install app"
7. Copy the Admin API access token (shown only once — save it)

### Starting in Claude Code CLI

Once you have Claude Code installed and the token:

```bash
# Create the project folder
mkdir ~/rana-shopify-monitor
cd ~/rana-shopify-monitor

# Copy the CLAUDE.md file into this folder
# (I'll give you the file — it has all the project context)

# Create the .env file with your token
echo "SHOPIFY_ACCESS_TOKEN=your_token_here" > .env
echo "SHOPIFY_STORE_URL=y01sdh-0b.myshopify.com" >> .env

# Start Claude Code
claude

# First thing to say:
# "Read CLAUDE.md and set up the project. Start with Phase 1:
#  project setup, GraphQL client, and the product health check audit."
```

Claude Code will:
1. Read the CLAUDE.md (gets all the context)
2. Create package.json
3. Install dependencies
4. Build the GraphQL client
5. Build the first audit command
6. Test it against the live store

You watch, approve changes, and ask questions as it builds.

---

## Part 5: What Happens in Parallel

| Track | Owner | This Week | Next Week |
|-------|-------|-----------|-----------|
| Data Fixes | Dev | Build Shopify Flows, one-time Matrixify fixes | Verify fixes, support Celigo mapping |
| Monitoring Tool | Mike + Claude Code | Set up project, build core audits | Use tool to verify Celigo sync |
| Celigo Onboarding | Mike + Client | Prep checklist, field mapping review | Attend onboarding, test sync |
| Client Communication | Mike | Status call today, share audit report | Share progress, get decisions |

---

## Part 6: Quick Reference — Commands for Terminal

If you've never used Terminal before, here are the commands you'll need:

```bash
# Navigate to a folder
cd ~/rana-shopify-monitor

# See what's in the folder
ls

# Create a folder
mkdir foldername

# Create a file
echo "content" > filename.txt

# Open a file in your default editor
open filename.txt

# Start Claude Code
claude

# Exit Claude Code
# Type /exit or press Ctrl+C

# Run a Node.js script
node src/index.js

# Install project dependencies
npm install
```

That's it. You don't need to know more than this to get started.
