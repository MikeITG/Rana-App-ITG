import { stringify } from 'csv-stringify/sync';
import fs from 'fs';
import path from 'path';

const EXPORTS_DIR = './exports';

function exportCsv(records, columns, filename) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });

  const csv = stringify(records, {
    header: true,
    columns: columns,
  });

  const filepath = path.join(EXPORTS_DIR, filename);
  fs.writeFileSync(filepath, csv, 'utf8');
  console.log(`  Exported ${records.length} rows to ${filepath}`);
  return filepath;
}

const PRODUCT_COLUMNS = [
  { key: 'id', header: 'Shopify ID' },
  { key: 'title', header: 'Title' },
  { key: 'handle', header: 'Handle' },
  { key: 'status', header: 'Status' },
  { key: 'vendor', header: 'Vendor' },
  { key: 'productType', header: 'Product Type' },
  { key: 'tags', header: 'Tags' },
  { key: 'totalInventory', header: 'Total Inventory' },
  { key: 'variantCount', header: 'Variant Count' },
  { key: 'mediaCount', header: 'Image Count' },
  { key: 'hasDescription', header: 'Has Description' },
  { key: 'outOfStockBehavior', header: 'OOS Behavior (Metafield)' },
  { key: 'internalId', header: 'NetSuite Internal ID' },
  { key: 'updatedAt', header: 'Last Updated' },
];

const VARIANT_COLUMNS = [
  { key: 'productId', header: 'Product ID' },
  { key: 'productTitle', header: 'Product Title' },
  { key: 'id', header: 'Variant ID' },
  { key: 'sku', header: 'SKU' },
  { key: 'barcode', header: 'Barcode' },
  { key: 'price', header: 'Price' },
  { key: 'compareAtPrice', header: 'Compare At Price' },
  { key: 'inventoryQuantity', header: 'Total Inventory' },
  { key: 'inventoryPolicy', header: 'Inventory Policy' },
  { key: 'weight', header: 'Weight' },
  { key: 'weightUnit', header: 'Weight Unit' },
];

const INVENTORY_COLUMNS = [
  { key: 'productId', header: 'Product ID' },
  { key: 'productTitle', header: 'Product Title' },
  { key: 'variantId', header: 'Variant ID' },
  { key: 'sku', header: 'SKU' },
  { key: 'locationId', header: 'Location ID' },
  { key: 'locationName', header: 'Location' },
  { key: 'available', header: 'Available' },
  { key: 'onHand', header: 'On Hand' },
  { key: 'incoming', header: 'Incoming' },
  { key: 'committed', header: 'Committed' },
];

/**
 * Export all pulled data as CSV files.
 * @param {Object} data - Object with productRows, variantRows, inventoryLevels from pull()
 */
export function exportAllCsv(data) {
  console.log('\nExporting CSV files...');
  exportCsv(data.productRows, PRODUCT_COLUMNS, 'products.csv');
  exportCsv(data.variantRows, VARIANT_COLUMNS, 'variants.csv');
  exportCsv(data.inventoryLevels, INVENTORY_COLUMNS, 'inventory.csv');
  console.log('CSV export complete.\n');
}
