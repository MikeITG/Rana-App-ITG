/**
 * Inventory Policy Mismatch Audit (AUDIT-02)
 *
 * Detects mismatches between the `custom.out_of_stock_behavior_bp` metafield
 * (denormalized as `outOfStockBehavior` on product rows) and each variant's
 * `inventoryPolicy` field.
 *
 * Mismatch types:
 *   SHOULD_BE_CONTINUE — metafield says "Allow back orders" but policy is DENY
 *   SHOULD_BE_DENY     — metafield says "Remove item" but policy is CONTINUE
 *   NO_METAFIELD       — outOfStockBehavior is empty (unknown intent)
 *
 * No external dependencies. ESM module.
 */

/**
 * Classify the intended inventory policy from the metafield value.
 * @param {string} outOfStockBehavior
 * @returns {'CONTINUE'|'DENY'|'NO_METAFIELD'}
 */
function classifyIntent(outOfStockBehavior) {
  if (!outOfStockBehavior || outOfStockBehavior.trim() === '') {
    return 'NO_METAFIELD';
  }
  const lower = outOfStockBehavior.toLowerCase();
  if (lower.includes('allow back')) {
    return 'CONTINUE';
  }
  if (lower.includes('remove item')) {
    return 'DENY';
  }
  // Value present but doesn't match known patterns — treat as NO_METAFIELD
  return 'NO_METAFIELD';
}

/**
 * Audit inventory policy mismatches across all products in the snapshot.
 *
 * @param {Object} snapshot - Loaded snapshot object from loadLatestSnapshot()
 * @param {Array}  snapshot.products - Product rows (with outOfStockBehavior)
 * @param {Array}  snapshot.variants - Variant rows (with inventoryPolicy)
 * @param {string} snapshot.pulledAt - ISO timestamp of when data was pulled
 * @returns {{ summary: Object, rows: Array }}
 */
export function auditPolicy(snapshot) {
  const { products, variants, pulledAt } = snapshot;

  // Build a Map of productId → variant[] for fast lookup
  const variantsByProduct = new Map();
  for (const variant of variants) {
    const list = variantsByProduct.get(variant.productId);
    if (list) {
      list.push(variant);
    } else {
      variantsByProduct.set(variant.productId, [variant]);
    }
  }

  const rows = [];
  let correctCount = 0;

  for (const product of products) {
    const { id: productId, title, handle, status, outOfStockBehavior } = product;
    const intent = classifyIntent(outOfStockBehavior);
    const productVariants = variantsByProduct.get(productId) || [];

    for (const variant of productVariants) {
      const { id: variantId, sku, inventoryPolicy } = variant;

      let mismatchType = null;

      if (intent === 'CONTINUE' && inventoryPolicy === 'DENY') {
        mismatchType = 'SHOULD_BE_CONTINUE';
      } else if (intent === 'DENY' && inventoryPolicy === 'CONTINUE') {
        mismatchType = 'SHOULD_BE_DENY';
      } else if (intent === 'NO_METAFIELD') {
        mismatchType = 'NO_METAFIELD';
      } else {
        // Metafield and policy agree
        correctCount++;
        continue;
      }

      rows.push({
        productId,
        title,
        handle,
        status,
        sku,
        variantId,
        inventoryPolicy,
        outOfStockBehavior,
        mismatchType,
      });
    }
  }

  const shouldBeContinue = rows.filter(r => r.mismatchType === 'SHOULD_BE_CONTINUE').length;
  const shouldBeDeny = rows.filter(r => r.mismatchType === 'SHOULD_BE_DENY').length;
  const noMetafield = rows.filter(r => r.mismatchType === 'NO_METAFIELD').length;
  const totalMismatches = shouldBeContinue + shouldBeDeny + noMetafield;

  const summary = {
    total: products.length,
    shouldBeContinue,
    shouldBeDeny,
    noMetafield,
    correct: correctCount,
  };

  // --- Terminal Output ---
  console.log('\n=== Inventory Policy Mismatch Audit ===');
  console.log(`Snapshot: ${pulledAt} | Products: ${products.length}`);
  console.log('');
  console.log('RESULTS');
  console.log(`  Correct (metafield matches policy): ${String(correctCount).padStart(4)}`);
  console.log(`  MISMATCH — Should be CONTINUE:     ${String(shouldBeContinue).padStart(4)}  ← "Allow back orders" but policy=DENY`);
  console.log(`  MISMATCH — Should be DENY:         ${String(shouldBeDeny).padStart(4)}  ← "Remove item OOS" but policy=CONTINUE`);
  console.log(`  No OOS metafield (unknown intent): ${String(noMetafield).padStart(4)}`);
  console.log('');
  console.log(`Total mismatches: ${totalMismatches}`);

  if (rows.length > 0) {
    console.log('\nSAMPLE MISMATCHES (first 20):');
    console.log('  SKU                          | Policy   | OOS Behavior                               | Mismatch Type');
    console.log('  ' + '-'.repeat(110));
    const sample = rows.slice(0, 20);
    for (const row of sample) {
      const sku = (row.sku || '(no sku)').padEnd(28);
      const policy = (row.inventoryPolicy || '').padEnd(8);
      const behavior = (row.outOfStockBehavior || '').padEnd(42);
      const type = row.mismatchType;
      console.log(`  ${sku} | ${policy} | ${behavior} | ${type}`);
    }
  }

  console.log('');

  return { summary, rows };
}
