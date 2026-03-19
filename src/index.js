import { pull } from './pull.js';
import { exportAllCsv } from './csv.js';
import { saveSnapshot } from './snapshot.js';
import { loadLatestSnapshot } from './snapshot.js';
import { auditProducts } from './audits/products.js';
import { auditPolicy } from './audits/policy.js';
import { auditDiscontinued } from './audits/discontinued.js';
import { auditImages } from './audits/images.js';
import {
  exportAuditProductsCsv,
  exportAuditPolicyCsv,
  exportAuditDiscontinuedCsv,
  exportAuditImagesCsv,
} from './csv.js';

const [,, command, ...args] = process.argv;

async function runPull() {
  console.log('=== Rana Shopify Monitor — Pull ===\n');

  // 1. Pull all data from Shopify
  const data = await pull();

  // 2. Export CSVs to /exports/
  exportAllCsv(data);

  // 3. Save JSON snapshot to /snapshots/
  saveSnapshot(data);

  console.log('Done.');
}

async function runAuditProducts() {
  console.log('=== Rana Shopify Monitor — Audit: Products ===\n');
  const snapshot = loadLatestSnapshot('pull');
  if (!snapshot) {
    console.error('No snapshot found. Run `node src/index.js pull` first.');
    process.exit(1);
  }
  const { rows } = auditProducts(snapshot);
  exportAuditProductsCsv(rows);
  console.log('\nDone.');
}

async function runAuditPolicy() {
  console.log('=== Rana Shopify Monitor — Audit: Policy ===\n');
  const snapshot = loadLatestSnapshot('pull');
  if (!snapshot) {
    console.error('No snapshot found. Run `node src/index.js pull` first.');
    process.exit(1);
  }
  const { rows } = auditPolicy(snapshot);
  exportAuditPolicyCsv(rows);
  console.log('\nDone.');
}

async function runAuditDiscontinued() {
  console.log('=== Rana Shopify Monitor — Audit: Discontinued ===\n');
  const snapshot = loadLatestSnapshot('pull');
  if (!snapshot) {
    console.error('No snapshot found. Run `node src/index.js pull` first.');
    process.exit(1);
  }
  const { rows } = auditDiscontinued(snapshot);
  exportAuditDiscontinuedCsv(rows);
  console.log('\nDone.');
}

async function runAuditImages() {
  console.log('=== Rana Shopify Monitor — Audit: Images ===\n');
  const snapshot = loadLatestSnapshot('pull');
  if (!snapshot) {
    console.error('No snapshot found. Run `node src/index.js pull` first.');
    process.exit(1);
  }
  const { rows } = auditImages(snapshot);
  exportAuditImagesCsv(rows);
  console.log('\nDone.');
}

switch (command) {
  case 'pull':
    runPull().catch(err => {
      console.error('Pull failed:', err.message);
      process.exit(1);
    });
    break;

  case 'audit:products':
    runAuditProducts().catch(err => {
      console.error('audit:products failed:', err.message);
      process.exit(1);
    });
    break;

  case 'audit:policy':
    runAuditPolicy().catch(err => {
      console.error('audit:policy failed:', err.message);
      process.exit(1);
    });
    break;

  case 'audit:discontinued':
    runAuditDiscontinued().catch(err => {
      console.error('audit:discontinued failed:', err.message);
      process.exit(1);
    });
    break;

  case 'audit:images':
    runAuditImages().catch(err => {
      console.error('audit:images failed:', err.message);
      process.exit(1);
    });
    break;

  default:
    console.log('Usage: node src/index.js <command>');
    console.log('');
    console.log('Commands:');
    console.log('  pull               Pull all products & inventory from Shopify, export CSVs, save snapshot');
    console.log('  audit:products     Product health summary (status breakdown, field completeness)');
    console.log('  audit:policy       Inventory policy mismatch detection → exports audit-policy-mismatches.csv');
    console.log('  audit:discontinued Find discontinued products still ACTIVE with 0 stock → exports audit-discontinued.csv');
    console.log('  audit:images       Find active products with 0 or 1 images → exports audit-images.csv');
    process.exit(0);
}
