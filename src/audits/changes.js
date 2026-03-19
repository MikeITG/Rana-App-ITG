/**
 * src/audits/changes.js
 * Change Detection Diff Engine — Phase 3, Plan 1
 *
 * Pure function — no file I/O, no API calls.
 * Accepts two snapshot objects (baseline, current) and returns a structured change report.
 *
 * @module audits/changes
 */

const DETAIL_CAP = 20;

/**
 * Diff two snapshots and return a structured change report.
 *
 * @param {Object} baseline - Snapshot object from loadLatestSnapshot (the saved baseline)
 * @param {Object} current  - Snapshot object from loadLatestSnapshot (the latest pull)
 * @returns {{ summary: Object, productChanges: Array, variantChanges: Array }}
 */
export function diffSnapshots(baseline, current) {
  // ── Step 1: Build lookup maps ──────────────────────────────────────────────

  // Index products by id (Shopify GID)
  const baseProducts = new Map(baseline.products.map(p => [p.id, p]));
  const currProducts = new Map(current.products.map(p => [p.id, p]));

  // Index variants by sku (skip blank SKUs)
  const baseVariants = new Map(
    baseline.variants.filter(v => v.sku).map(v => [v.sku, v])
  );
  const currVariants = new Map(
    current.variants.filter(v => v.sku).map(v => [v.sku, v])
  );

  // ── Step 2: Detect product-level changes ───────────────────────────────────

  const productChanges = [];

  // Union of all product IDs
  const allProductIds = new Set([...baseProducts.keys(), ...currProducts.keys()]);

  for (const id of allProductIds) {
    const base = baseProducts.get(id);
    const curr = currProducts.get(id);

    if (!base && curr) {
      // New product
      productChanges.push({
        productId: id,
        title: curr.title,
        handle: curr.handle,
        status: curr.status,
        changeType: 'added',
        field: '',
        from: '',
        to: '',
      });
      continue;
    }

    if (base && !curr) {
      // Removed product
      productChanges.push({
        productId: id,
        title: base.title,
        handle: base.handle,
        status: base.status,
        changeType: 'removed',
        field: '',
        from: '',
        to: '',
      });
      continue;
    }

    // Present in both — compare fields
    const comparisons = [
      { field: 'status',            changeType: 'status_change' },
      { field: 'totalInventory',    changeType: 'inventory_change' },
      { field: 'outOfStockBehavior', changeType: 'policy_change' },
      { field: 'mediaCount',        changeType: 'images_change' },
    ];

    for (const { field, changeType } of comparisons) {
      if (String(base[field] ?? '') !== String(curr[field] ?? '')) {
        productChanges.push({
          productId: id,
          title: curr.title,
          handle: curr.handle,
          status: curr.status,
          changeType,
          field,
          from: base[field] ?? '',
          to: curr[field] ?? '',
        });
      }
    }
  }

  // ── Step 3: Detect variant-level changes ───────────────────────────────────

  const variantChanges = [];

  // Union of all SKUs
  const allSkus = new Set([...baseVariants.keys(), ...currVariants.keys()]);

  for (const sku of allSkus) {
    const base = baseVariants.get(sku);
    const curr = currVariants.get(sku);

    if (!base && curr) {
      // New variant
      variantChanges.push({
        sku,
        productId: curr.productId,
        productTitle: curr.productTitle,
        changeType: 'variant_added',
        field: '',
        from: '',
        to: '',
      });
      continue;
    }

    if (base && !curr) {
      // Removed variant
      variantChanges.push({
        sku,
        productId: base.productId,
        productTitle: base.productTitle,
        changeType: 'variant_removed',
        field: '',
        from: '',
        to: '',
      });
      continue;
    }

    // Present in both — compare fields
    const comparisons = [
      { field: 'price',             changeType: 'price_change' },
      { field: 'compareAtPrice',    changeType: 'compare_price_change' },
      { field: 'inventoryPolicy',   changeType: 'policy_change' },
      { field: 'inventoryQuantity', changeType: 'inventory_change' },
    ];

    for (const { field, changeType } of comparisons) {
      if (String(base[field] ?? '') !== String(curr[field] ?? '')) {
        variantChanges.push({
          sku,
          productId: curr.productId,
          productTitle: curr.productTitle,
          changeType,
          field,
          from: base[field] ?? '',
          to: curr[field] ?? '',
        });
      }
    }
  }

  // ── Step 4: Compute summary counts ────────────────────────────────────────

  const summary = {
    baselinePulledAt: baseline.pulledAt,
    currentPulledAt:  current.pulledAt,
    productsAdded:    productChanges.filter(r => r.changeType === 'added').length,
    productsRemoved:  productChanges.filter(r => r.changeType === 'removed').length,
    statusChanges:    productChanges.filter(r => r.changeType === 'status_change').length,
    inventoryChanges: productChanges.filter(r => r.changeType === 'inventory_change').length,
    policyChanges:    productChanges.filter(r => r.changeType === 'policy_change').length,
    imagesChanges:    productChanges.filter(r => r.changeType === 'images_change').length,
    variantsAdded:    variantChanges.filter(r => r.changeType === 'variant_added').length,
    variantsRemoved:  variantChanges.filter(r => r.changeType === 'variant_removed').length,
    priceChanges:     variantChanges.filter(r => r.changeType === 'price_change').length,
    variantInventoryChanges: variantChanges.filter(r => r.changeType === 'inventory_change').length,
    variantPolicyChanges:    variantChanges.filter(r => r.changeType === 'policy_change').length,
    totalChanges:     productChanges.length + variantChanges.length,
  };

  // ── Step 5: Print terminal report ─────────────────────────────────────────

  _printReport(summary, productChanges, variantChanges);

  // ── Step 6: Return ─────────────────────────────────────────────────────────

  return { summary, productChanges, variantChanges };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Print a capped detail section to the terminal.
 * @param {string}   header - Section header text, e.g. "Added Products"
 * @param {Array}    rows   - All rows for this section
 * @param {Function} format - (row) => string — formats a single row for display
 */
function _printSection(header, rows, format) {
  if (!rows.length) return;
  console.log(`\n[${header}]`);
  const capped = rows.slice(0, DETAIL_CAP);
  for (const row of capped) {
    console.log(`  ${format(row)}`);
  }
  if (rows.length > DETAIL_CAP) {
    console.log(`  ... and ${rows.length - DETAIL_CAP} more`);
  }
}

/**
 * Print the full change report to the terminal.
 */
function _printReport(summary, productChanges, variantChanges) {
  console.log('\n=== Change Report ===');
  console.log(`Baseline:  ${summary.baselinePulledAt}`);
  console.log(`Current:   ${summary.currentPulledAt}`);

  console.log('\nPRODUCT CHANGES');
  console.log(`  New products:        ${summary.productsAdded}`);
  console.log(`  Removed products:    ${summary.productsRemoved}`);
  console.log(`  Status changes:      ${summary.statusChanges}`);
  console.log(`  Inventory changes:   ${summary.inventoryChanges}`);
  console.log(`  Policy changes:      ${summary.policyChanges}`);
  console.log(`  Image count changes: ${summary.imagesChanges}`);

  console.log('\nVARIANT CHANGES');
  console.log(`  New variants:        ${summary.variantsAdded}`);
  console.log(`  Removed variants:    ${summary.variantsRemoved}`);
  console.log(`  Price changes:       ${summary.priceChanges}`);
  console.log(`  Inventory changes:   ${summary.variantInventoryChanges}`);
  console.log(`  Policy changes:      ${summary.variantPolicyChanges}`);

  console.log(`\nTOTAL CHANGES: ${summary.totalChanges}`);

  if (summary.totalChanges === 0) {
    console.log('\nNo changes detected between snapshots.');
    return;
  }

  console.log('\n--- DETAILS ---');

  _printSection(
    'Added Products',
    productChanges.filter(r => r.changeType === 'added'),
    r => `+ "${r.title}" (${r.handle}) — status: ${r.status}`
  );

  _printSection(
    'Removed Products',
    productChanges.filter(r => r.changeType === 'removed'),
    r => `- "${r.title}" (${r.handle})`
  );

  _printSection(
    'Status Changes',
    productChanges.filter(r => r.changeType === 'status_change'),
    r => `"${r.title}" — status: ${r.from} → ${r.to}`
  );

  _printSection(
    'Inventory Changes (Products)',
    productChanges.filter(r => r.changeType === 'inventory_change'),
    r => `"${r.title}" — totalInventory: ${r.from} → ${r.to}`
  );

  _printSection(
    'Policy Changes (Products)',
    productChanges.filter(r => r.changeType === 'policy_change'),
    r => `"${r.title}" — outOfStockBehavior: ${r.from} → ${r.to}`
  );

  _printSection(
    'Image Count Changes',
    productChanges.filter(r => r.changeType === 'images_change'),
    r => `"${r.title}" — mediaCount: ${r.from} → ${r.to}`
  );

  _printSection(
    'Added Variants',
    variantChanges.filter(r => r.changeType === 'variant_added'),
    r => `+ ${r.sku} (${r.productTitle})`
  );

  _printSection(
    'Removed Variants',
    variantChanges.filter(r => r.changeType === 'variant_removed'),
    r => `- ${r.sku} (${r.productTitle})`
  );

  _printSection(
    'Price Changes',
    variantChanges.filter(r => r.changeType === 'price_change'),
    r => `${r.sku} (${r.productTitle}) — price: ${r.from} → ${r.to}`
  );

  _printSection(
    'Compare-At Price Changes',
    variantChanges.filter(r => r.changeType === 'compare_price_change'),
    r => `${r.sku} (${r.productTitle}) — compareAtPrice: ${r.from} → ${r.to}`
  );

  _printSection(
    'Inventory Changes (Variants)',
    variantChanges.filter(r => r.changeType === 'inventory_change'),
    r => `${r.sku} (${r.productTitle}) — inventoryQuantity: ${r.from} → ${r.to}`
  );

  _printSection(
    'Policy Changes (Variants)',
    variantChanges.filter(r => r.changeType === 'policy_change'),
    r => `${r.sku} (${r.productTitle}) — inventoryPolicy: ${r.from} → ${r.to}`
  );
}
