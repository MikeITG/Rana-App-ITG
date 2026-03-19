/**
 * Image Audit — AUDIT-04
 *
 * Identifies products with insufficient images:
 *   - ACTIVE_NO_IMAGES:  Active products with 0 images  (critical — broken storefront)
 *   - DRAFT_NO_IMAGES:   Draft/Archived products with 0 images
 *   - ONE_IMAGE_ONLY:    Any product with exactly 1 image
 *
 * Usage:
 *   import { auditImages } from './audits/images.js';
 *   const { summary, rows } = auditImages(snapshot);
 */

const PAD = 44;

function pad(label, width = PAD) {
  return label.padEnd(width);
}

/**
 * Run the image audit against a loaded snapshot.
 *
 * @param {Object} snapshot - Parsed snapshot object (from loadLatestSnapshot)
 * @returns {{ summary: Object, rows: Array }}
 */
export function auditImages(snapshot) {
  const products = snapshot.products || [];

  const rows = [];

  for (const product of products) {
    const count = product.mediaCount ?? 0;
    const status = product.status; // 'ACTIVE' | 'DRAFT' | 'ARCHIVED'

    let issueType = null;

    if (count === 0 && status === 'ACTIVE') {
      issueType = 'ACTIVE_NO_IMAGES';
    } else if (count === 0 && status !== 'ACTIVE') {
      issueType = 'DRAFT_NO_IMAGES';
    } else if (count === 1) {
      issueType = 'ONE_IMAGE_ONLY';
    }
    // count >= 2 → no issue, skip

    if (issueType) {
      rows.push({
        productId: product.id,
        title: product.title,
        handle: product.handle,
        status,
        mediaCount: count,
        issueType,
        updatedAt: product.updatedAt,
      });
    }
  }

  // Summary counts
  const activeNoImages = rows.filter(r => r.issueType === 'ACTIVE_NO_IMAGES').length;
  const draftNoImages  = rows.filter(r => r.issueType === 'DRAFT_NO_IMAGES').length;
  const oneImageOnly   = rows.filter(r => r.issueType === 'ONE_IMAGE_ONLY').length;

  const summary = {
    total: products.length,
    activeNoImages,
    draftNoImages,
    oneImageOnly,
    totalFlagged: activeNoImages + draftNoImages + oneImageOnly,
  };

  // --- Terminal output ---

  const pulledAt = snapshot.pulledAt || 'unknown';

  console.log('');
  console.log('=== Image Audit ===');
  console.log(`Snapshot: ${pulledAt} | Total Products: ${products.length}`);
  console.log('');
  console.log('RESULTS');
  console.log(`  ${pad('Active products with 0 images:')}${String(activeNoImages).padStart(4)}  ← CRITICAL: broken storefront`);
  console.log(`  ${pad('Draft/Archived products with 0 images:')}${String(draftNoImages).padStart(4)}`);
  console.log(`  ${pad('Products with only 1 image:')}${String(oneImageOnly).padStart(4)}`);
  console.log(`  ${pad('Total flagged:')}${String(summary.totalFlagged).padStart(4)}`);

  // Active products with no images — all of them
  const activeRows = rows.filter(r => r.issueType === 'ACTIVE_NO_IMAGES');
  console.log('');
  console.log('ACTIVE PRODUCTS WITH NO IMAGES:');
  if (activeRows.length === 0) {
    console.log('  (none)');
  } else {
    console.log(`  ${'Title'.padEnd(50)} ${'Handle'.padEnd(40)} ${'Status'.padEnd(10)} Images`);
    console.log(`  ${'-'.repeat(50)} ${'-'.repeat(40)} ${'-'.repeat(10)} ------`);
    for (const row of activeRows) {
      const title  = (row.title  || '').slice(0, 49).padEnd(50);
      const handle = (row.handle || '').slice(0, 39).padEnd(40);
      const status = (row.status || '').padEnd(10);
      console.log(`  ${title} ${handle} ${status} ${row.mediaCount}`);
    }
  }

  // Products with only 1 image — first 20
  const oneRows = rows.filter(r => r.issueType === 'ONE_IMAGE_ONLY').slice(0, 20);
  console.log('');
  console.log(`PRODUCTS WITH ONLY 1 IMAGE (first 20):`);
  if (oneRows.length === 0) {
    console.log('  (none)');
  } else {
    console.log(`  ${'Title'.padEnd(50)} ${'Handle'.padEnd(40)} ${'Status'}`);
    console.log(`  ${'-'.repeat(50)} ${'-'.repeat(40)} ------`);
    for (const row of oneRows) {
      const title  = (row.title  || '').slice(0, 49).padEnd(50);
      const handle = (row.handle || '').slice(0, 39).padEnd(40);
      console.log(`  ${title} ${handle} ${row.status}`);
    }
  }

  console.log('');

  return { summary, rows };
}
