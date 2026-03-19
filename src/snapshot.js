import fs from 'fs';
import path from 'path';

const SNAPSHOTS_DIR = './snapshots';

/**
 * Save pull data as a timestamped JSON snapshot.
 * Filename format: 2026-03-19T14-30-00-pull.json
 * @param {Object} data - The data object from pull() (productRows, variantRows, inventoryLevels)
 * @param {string} label - Snapshot label (default: 'pull')
 * @returns {string} filepath of saved snapshot
 */
export function saveSnapshot(data, label = 'pull') {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${timestamp}-${label}.json`;
  const filepath = path.join(SNAPSHOTS_DIR, filename);

  // Strip metafields array from productRows to keep snapshot size manageable
  // (metafields are denormalized into outOfStockBehavior, internalId, etc.)
  const snapshotData = {
    pulledAt: new Date().toISOString(),
    counts: {
      products: data.productRows.length,
      variants: data.variantRows.length,
      inventoryLevels: data.inventoryLevels.length,
    },
    products: data.productRows.map(p => {
      const { metafields, ...rest } = p;
      return rest;
    }),
    variants: data.variantRows,
    inventoryLevels: data.inventoryLevels,
  };

  fs.writeFileSync(filepath, JSON.stringify(snapshotData, null, 2), 'utf8');
  console.log(`Snapshot saved: ${filepath} (${(fs.statSync(filepath).size / 1024 / 1024).toFixed(1)} MB)`);
  return filepath;
}

/**
 * Load the most recent snapshot with the given label.
 * @param {string} label - Snapshot label to filter by (default: 'pull')
 * @returns {Object|null} parsed snapshot data, or null if no snapshots found
 */
export function loadLatestSnapshot(label = 'pull') {
  if (!fs.existsSync(SNAPSHOTS_DIR)) return null;

  const files = fs.readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith(`-${label}.json`))
    .sort()
    .reverse();

  if (!files.length) return null;

  const filepath = path.join(SNAPSHOTS_DIR, files[0]);
  console.log(`Loading snapshot: ${filepath}`);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}
