import { pull } from './pull.js';
import { exportAllCsv } from './csv.js';
import { saveSnapshot } from './snapshot.js';

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

switch (command) {
  case 'pull':
    runPull().catch(err => {
      console.error('Pull failed:', err.message);
      process.exit(1);
    });
    break;

  default:
    console.log('Usage: node src/index.js <command>');
    console.log('');
    console.log('Commands:');
    console.log('  pull    Pull all products & inventory from Shopify, export CSVs, save snapshot');
    process.exit(0);
}
