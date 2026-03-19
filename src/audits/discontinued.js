/**
 * Discontinued Products Audit (AUDIT-03)
 *
 * Identifies products that are ACTIVE but have zero inventory and an OOS behavior
 * metafield indicating they should be removed when out of stock — meaning they are
 * effectively discontinued and should be set to Draft.
 *
 * Also flags a secondary category: ACTIVE + 0 stock + backorderable OOS behavior
 * (policy says allow backorders, but nothing is actually available).
 *
 * Receives a snapshot object; makes no live API calls.
 */

export function auditDiscontinued(snapshot) {
  const products = snapshot.products || [];
  const total = products.length;

  let discontinued = 0;
  let backorderableZeroStock = 0;
  const activeProducts = products.filter(p => p.status === 'ACTIVE').length;

  const rows = [];

  for (const product of products) {
    const inv = product.totalInventory ?? 0;
    const oos = (product.outOfStockBehavior || '').toLowerCase();
    const isActive = product.status === 'ACTIVE';
    const isZeroStock = inv <= 0;
    const isRemoveOOS = oos.includes('remove item');
    const isAllowBack = oos.includes('allow back');

    let issueType = null;

    if (isActive && isZeroStock && isRemoveOOS) {
      issueType = 'DISCONTINUED_STILL_ACTIVE';
      discontinued++;
    } else if (isActive && isZeroStock && isAllowBack) {
      issueType = 'BACKORDERABLE_ZERO_STOCK';
      backorderableZeroStock++;
    } else {
      continue;
    }

    rows.push({
      productId: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      totalInventory: inv,
      outOfStockBehavior: product.outOfStockBehavior,
      issueType,
      tags: product.tags,
      updatedAt: product.updatedAt,
    });
  }

  const summary = {
    total,
    activeProducts,
    discontinued,
    backorderableZeroStock,
    flagged: discontinued + backorderableZeroStock,
  };

  // --- Terminal output ---

  console.log('\n=== Discontinued Products Audit ===');
  console.log(`Snapshot: ${snapshot.pulledAt} | Total Products: ${total}`);
  console.log('');
  console.log('RESULTS');
  console.log(`  Active products total:              ${String(activeProducts).padStart(4)}`);
  console.log(`  Discontinued but still ACTIVE:      ${String(discontinued).padStart(4)}  ← should be Draft (0 stock, remove-OOS metafield)`);
  console.log(`  Backorderable but 0 stock (ACTIVE): ${String(backorderableZeroStock).padStart(4)}  ← policy allows backorders but nothing available`);
  console.log(`  Total flagged:                      ${String(summary.flagged).padStart(4)}`);
  console.log('');

  const discontinuedRows = rows.filter(r => r.issueType === 'DISCONTINUED_STILL_ACTIVE');

  if (discontinuedRows.length > 0) {
    console.log('DISCONTINUED STILL ACTIVE (first 20):');
    console.log('  Title | Handle | Inventory | OOS Behavior');
    console.log('  ' + '-'.repeat(80));
    const preview = discontinuedRows.slice(0, 20);
    for (const row of preview) {
      const title = (row.title || '').substring(0, 35).padEnd(35);
      const handle = (row.handle || '').substring(0, 30).padEnd(30);
      const inv = String(row.totalInventory).padStart(3);
      const oos = row.outOfStockBehavior || '';
      console.log(`  ${title} | ${handle} | ${inv} | ${oos}`);
    }
  } else {
    console.log('DISCONTINUED STILL ACTIVE (first 20):');
    console.log('  (none found)');
  }

  console.log('');

  return { summary, rows };
}
