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

// --- Audit CSV Export ---

const AUDIT_PRODUCTS_COLUMNS = [
  { key: 'id', header: 'Shopify ID' },
  { key: 'title', header: 'Title' },
  { key: 'handle', header: 'Handle' },
  { key: 'status', header: 'Status' },
  { key: 'hasDescription', header: 'Has Description' },
  { key: 'hasProductType', header: 'Has Product Type' },
  { key: 'mediaCount', header: 'Image Count' },
  { key: 'anyWeightSet', header: 'Weight Set' },
  { key: 'anyBarcodeSet', header: 'Barcode Set' },
  { key: 'anyCompareAtPrice', header: 'Compare At Price' },
  { key: 'variantPolicySummary', header: 'Variant Policy' },
  { key: 'totalInventory', header: 'Total Inventory' },
  { key: 'outOfStockBehavior', header: 'OOS Behavior (Metafield)' },
  { key: 'updatedAt', header: 'Last Updated' },
];

const AUDIT_POLICY_COLUMNS = [
  { key: 'productId', header: 'Shopify Product ID' },
  { key: 'title', header: 'Product Title' },
  { key: 'handle', header: 'Handle' },
  { key: 'status', header: 'Status' },
  { key: 'sku', header: 'SKU' },
  { key: 'variantId', header: 'Variant ID' },
  { key: 'inventoryPolicy', header: 'Current Policy' },
  { key: 'outOfStockBehavior', header: 'OOS Metafield Value' },
  { key: 'mismatchType', header: 'Mismatch Type' },
];

const AUDIT_DISCONTINUED_COLUMNS = [
  { key: 'productId', header: 'Shopify Product ID' },
  { key: 'title', header: 'Product Title' },
  { key: 'handle', header: 'Handle' },
  { key: 'status', header: 'Status' },
  { key: 'totalInventory', header: 'Total Inventory' },
  { key: 'outOfStockBehavior', header: 'OOS Behavior (Metafield)' },
  { key: 'issueType', header: 'Issue Type' },
  { key: 'tags', header: 'Tags' },
  { key: 'updatedAt', header: 'Last Updated' },
];

const AUDIT_IMAGES_COLUMNS = [
  { key: 'productId', header: 'Shopify Product ID' },
  { key: 'title', header: 'Product Title' },
  { key: 'handle', header: 'Handle' },
  { key: 'status', header: 'Status' },
  { key: 'mediaCount', header: 'Image Count' },
  { key: 'issueType', header: 'Issue Type' },
  { key: 'updatedAt', header: 'Last Updated' },
];

export function exportAuditProductsCsv(rows) {
  console.log('\nExporting audit:products CSV...');
  return exportCsv(rows, AUDIT_PRODUCTS_COLUMNS, 'audit-products.csv');
}

export function exportAuditPolicyCsv(rows) {
  console.log('\nExporting audit:policy mismatches CSV...');
  return exportCsv(rows, AUDIT_POLICY_COLUMNS, 'audit-policy-mismatches.csv');
}

export function exportAuditDiscontinuedCsv(rows) {
  console.log('\nExporting audit:discontinued CSV...');
  return exportCsv(rows, AUDIT_DISCONTINUED_COLUMNS, 'audit-discontinued.csv');
}

export function exportAuditImagesCsv(rows) {
  console.log('\nExporting audit:images CSV...');
  return exportCsv(rows, AUDIT_IMAGES_COLUMNS, 'audit-images.csv');
}

// --- Audit Changes CSV Export ---

const AUDIT_CHANGES_PRODUCT_COLUMNS = [
  { key: 'productId',  header: 'Shopify Product ID' },
  { key: 'title',      header: 'Title' },
  { key: 'handle',     header: 'Handle' },
  { key: 'status',     header: 'Current Status' },
  { key: 'changeType', header: 'Change Type' },
  { key: 'field',      header: 'Field' },
  { key: 'from',       header: 'From' },
  { key: 'to',         header: 'To' },
];

const AUDIT_CHANGES_VARIANT_COLUMNS = [
  { key: 'sku',          header: 'SKU' },
  { key: 'productId',    header: 'Shopify Product ID' },
  { key: 'productTitle', header: 'Product Title' },
  { key: 'changeType',   header: 'Change Type' },
  { key: 'field',        header: 'Field' },
  { key: 'from',         header: 'From' },
  { key: 'to',           header: 'To' },
];

export function exportAuditChangesCsv(productChanges, variantChanges) {
  console.log('\nExporting audit:changes CSVs...');
  exportCsv(productChanges, AUDIT_CHANGES_PRODUCT_COLUMNS, 'audit-changes-products.csv');
  exportCsv(variantChanges, AUDIT_CHANGES_VARIANT_COLUMNS, 'audit-changes-variants.csv');
}
