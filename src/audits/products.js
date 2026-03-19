/**
 * Product Health Audit
 *
 * Accepts a snapshot object (from loadLatestSnapshot('pull')) and computes
 * a comprehensive product health summary. Prints a formatted terminal table
 * and returns { summary, rows } for further use (e.g. CSV export).
 *
 * No live API calls are made here — all data comes from the snapshot.
 */

/**
 * @param {Object} snapshot - Parsed pull snapshot
 * @param {string} snapshot.pulledAt
 * @param {Object} snapshot.counts
 * @param {Array}  snapshot.products
 * @param {Array}  snapshot.variants
 * @param {Array}  snapshot.inventoryLevels
 * @returns {{ summary: Object, rows: Array }}
 */
export function auditProducts(snapshot) {
  const { products, variants, pulledAt } = snapshot;

  // --- 1. Build variantsByProduct Map for efficient per-product lookup ---
  const variantsByProduct = new Map();
  for (const variant of variants) {
    const list = variantsByProduct.get(variant.productId) ?? [];
    list.push(variant);
    variantsByProduct.set(variant.productId, list);
  }

  // --- 2. Accumulators ---
  const summary = {
    total: products.length,
    active: 0,
    draft: 0,
    archived: 0,
    withDescription: 0,
    withProductType: 0,
    withImages: 0,
    withWeight: 0,
    withBarcode: 0,
    withCompareAtPrice: 0,
    allPolicyDeny: 0,
    allPolicyContinue: 0,
    mixedPolicy: 0,
  };

  const rows = [];

  // --- 3. Per-product computation ---
  for (const product of products) {
    // Status counts
    const status = (product.status || '').toUpperCase();
    if (status === 'ACTIVE') summary.active++;
    else if (status === 'DRAFT') summary.draft++;
    else if (status === 'ARCHIVED') summary.archived++;

    // Field completeness flags
    const hasDescription = product.hasDescription === 'yes';
    const hasProductType = typeof product.productType === 'string' && product.productType.trim() !== '';
    const hasImages = (product.mediaCount ?? 0) > 0;

    if (hasDescription) summary.withDescription++;
    if (hasProductType) summary.withProductType++;
    if (hasImages) summary.withImages++;

    // Variant-level analysis
    const productVariants = variantsByProduct.get(product.id) ?? [];

    let anyWeightSet = false;
    let anyBarcodeSet = false;
    let anyCompareAtPrice = false;
    let denyCount = 0;
    let continueCount = 0;

    for (const v of productVariants) {
      if ((v.weight ?? 0) > 0) anyWeightSet = true;
      if (v.barcode && v.barcode.trim() !== '') anyBarcodeSet = true;
      if (v.compareAtPrice && v.compareAtPrice.trim() !== '') anyCompareAtPrice = true;

      const policy = (v.inventoryPolicy || '').toUpperCase();
      if (policy === 'DENY') denyCount++;
      else if (policy === 'CONTINUE') continueCount++;
    }

    if (anyWeightSet) summary.withWeight++;
    if (anyBarcodeSet) summary.withBarcode++;
    if (anyCompareAtPrice) summary.withCompareAtPrice++;

    // Determine policy summary for this product
    let variantPolicySummary;
    if (productVariants.length === 0) {
      variantPolicySummary = 'all-deny'; // no variants — treat as deny by default
      summary.allPolicyDeny++;
    } else if (continueCount === 0 && denyCount > 0) {
      variantPolicySummary = 'all-deny';
      summary.allPolicyDeny++;
    } else if (denyCount === 0 && continueCount > 0) {
      variantPolicySummary = 'all-continue';
      summary.allPolicyContinue++;
    } else {
      variantPolicySummary = 'mixed';
      summary.mixedPolicy++;
    }

    // --- 4. Build row for this product ---
    rows.push({
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      hasDescription: hasDescription ? 'yes' : 'no',
      hasProductType: hasProductType ? 'yes' : 'no',
      mediaCount: product.mediaCount ?? 0,
      anyWeightSet: anyWeightSet ? 'yes' : 'no',
      anyBarcodeSet: anyBarcodeSet ? 'yes' : 'no',
      anyCompareAtPrice: anyCompareAtPrice ? 'yes' : 'no',
      variantPolicySummary,
      totalInventory: product.totalInventory ?? 0,
      outOfStockBehavior: product.outOfStockBehavior ?? '',
      updatedAt: product.updatedAt,
    });
  }

  // --- 5. Compute percentages ---
  const total = summary.total || 1; // guard against divide-by-zero
  const pct = (n) => ((n / total) * 100).toFixed(1);

  summary.pctActive = pct(summary.active);
  summary.pctDraft = pct(summary.draft);
  summary.pctArchived = pct(summary.archived);
  summary.pctDescription = pct(summary.withDescription);
  summary.pctProductType = pct(summary.withProductType);
  summary.pctImages = pct(summary.withImages);
  summary.pctWeight = pct(summary.withWeight);
  summary.pctBarcode = pct(summary.withBarcode);
  summary.pctCompareAtPrice = pct(summary.withCompareAtPrice);
  summary.pctAllPolicyDeny = pct(summary.allPolicyDeny);
  summary.pctAllPolicyContinue = pct(summary.allPolicyContinue);
  summary.pctMixedPolicy = pct(summary.mixedPolicy);

  // --- 6. Print terminal summary ---
  const snapshotLabel = pulledAt ? pulledAt.replace(/[:.]/g, '-').slice(0, 19) : 'unknown';

  console.log('');
  console.log('=== Product Health Audit ===');
  console.log(`Snapshot: ${snapshotLabel} | Products: ${summary.total}`);

  console.log('');
  console.log('STATUS BREAKDOWN');
  console.log(`  Active:    ${String(summary.active).padStart(5)} (${summary.pctActive}%)`);
  console.log(`  Draft:     ${String(summary.draft).padStart(5)} (${summary.pctDraft}%)`);
  console.log(`  Archived:  ${String(summary.archived).padStart(5)} (${summary.pctArchived}%)`);

  console.log('');
  console.log('FIELD COMPLETENESS');
  console.log(`  Description:      ${String(summary.withDescription).padStart(5)} / ${summary.total} (${summary.pctDescription}%)`);
  console.log(`  Product Type:     ${String(summary.withProductType).padStart(5)} / ${summary.total} (${summary.pctProductType}%)`);
  console.log(`  Has Images:       ${String(summary.withImages).padStart(5)} / ${summary.total} (${summary.pctImages}%)`);
  console.log(`  Weight Set:       ${String(summary.withWeight).padStart(5)} / ${summary.total} (${summary.pctWeight}%)`);
  console.log(`  Barcode Set:      ${String(summary.withBarcode).padStart(5)} / ${summary.total} (${summary.pctBarcode}%)`);
  console.log(`  Compare At Price: ${String(summary.withCompareAtPrice).padStart(5)} / ${summary.total} (${summary.pctCompareAtPrice}%)`);

  console.log('');
  console.log('INVENTORY POLICY');
  console.log(`  All DENY:     ${String(summary.allPolicyDeny).padStart(5)} (${summary.pctAllPolicyDeny}%)`);
  console.log(`  All CONTINUE: ${String(summary.allPolicyContinue).padStart(5)} (${summary.pctAllPolicyContinue}%)`);
  console.log(`  Mixed:        ${String(summary.mixedPolicy).padStart(5)} (${summary.pctMixedPolicy}%)`);
  console.log('');

  return { summary, rows };
}
