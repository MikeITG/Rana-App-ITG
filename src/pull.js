import { graphqlWithRetry } from './client.js';
import { downloadProductsJsonl, downloadInventoryJsonl } from './jsonl.js';

// --- GraphQL Mutations & Queries ---

const BULK_PRODUCTS_MUTATION = `
mutation {
  bulkOperationRunQuery(
    query: """
    {
      products {
        edges {
          node {
            id
            title
            handle
            status
            vendor
            productType
            tags
            descriptionHtml
            totalInventory
            createdAt
            updatedAt
            publishedAt
            media(first: 10) {
              edges {
                node {
                  id
                  mediaContentType
                  status
                }
              }
            }
            metafields(first: 20) {
              edges {
                node {
                  namespace
                  key
                  value
                  type
                }
              }
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  sku
                  barcode
                  price
                  compareAtPrice
                  inventoryQuantity
                  inventoryPolicy
                  weight
                  weightUnit
                  title
                  selectedOptions {
                    name
                    value
                  }
                  inventoryItem {
                    id
                    tracked
                  }
                }
              }
            }
          }
        }
      }
    }
    """
  ) {
    bulkOperation {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}
`;

const BULK_INVENTORY_MUTATION = `
mutation {
  bulkOperationRunQuery(
    query: """
    {
      inventoryItems {
        edges {
          node {
            id
            sku
            tracked
            variant {
              id
              sku
              product {
                id
                title
              }
            }
            inventoryLevels {
              edges {
                node {
                  id
                  quantities(names: ["available", "on_hand", "incoming", "committed"]) {
                    name
                    quantity
                  }
                  location {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
    """
  ) {
    bulkOperation {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}
`;

const POLL_QUERY = `
query BulkOperationStatus($id: ID!) {
  node(id: $id) {
    ... on BulkOperation {
      id
      status
      errorCode
      createdAt
      completedAt
      objectCount
      fileSize
      url
      partialDataUrl
    }
  }
}
`;

// --- Polling ---

async function pollBulkOperation(operationId, label = 'operation') {
  console.log(`  Polling ${label}...`);

  while (true) {
    const result = await graphqlWithRetry(POLL_QUERY, { id: operationId });
    const op = result.data.node;

    console.log(`  [${label}] Status: ${op.status} | Objects: ${op.objectCount || 0}`);

    if (op.status === 'COMPLETED') {
      if (!op.url) {
        console.log(`  [${label}] Completed but no data URL (empty result set)`);
        return null;
      }
      return op.url;
    }

    if (op.status === 'FAILED') {
      throw new Error(`Bulk operation ${label} failed: ${op.errorCode}`);
    }

    if (op.status === 'CANCELED') {
      throw new Error(`Bulk operation ${label} was canceled`);
    }

    // Poll every 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

// --- Main Pull Function ---

export async function pull() {
  console.log('Starting full data pull...\n');
  const startTime = Date.now();

  // Step 1: Trigger products bulk operation
  console.log('Step 1/5: Triggering products bulk operation...');
  const productResult = await graphqlWithRetry(BULK_PRODUCTS_MUTATION);
  const productErrors = productResult.data.bulkOperationRunQuery.userErrors;
  if (productErrors.length) {
    throw new Error(`Product bulk operation failed: ${JSON.stringify(productErrors)}`);
  }
  const productOpId = productResult.data.bulkOperationRunQuery.bulkOperation.id;
  console.log(`  Operation ID: ${productOpId}`);

  // Step 2: Trigger inventory bulk operation (concurrent in API 2026-01)
  console.log('Step 2/5: Triggering inventory bulk operation...');
  const inventoryResult = await graphqlWithRetry(BULK_INVENTORY_MUTATION);
  const inventoryErrors = inventoryResult.data.bulkOperationRunQuery.userErrors;
  if (inventoryErrors.length) {
    throw new Error(`Inventory bulk operation failed: ${JSON.stringify(inventoryErrors)}`);
  }
  const inventoryOpId = inventoryResult.data.bulkOperationRunQuery.bulkOperation.id;
  console.log(`  Operation ID: ${inventoryOpId}`);

  // Step 3: Poll both until complete
  console.log('Step 3/5: Waiting for bulk operations to complete...');
  const [productUrl, inventoryUrl] = await Promise.all([
    pollBulkOperation(productOpId, 'products'),
    pollBulkOperation(inventoryOpId, 'inventory'),
  ]);

  // Step 4: Download and parse JSONL
  console.log('Step 4/5: Downloading and parsing JSONL files...');

  let products = new Map();
  let variants = [];
  let mediaByProduct = {};
  let metafieldsByProduct = {};
  let inventoryLevels = [];

  if (productUrl) {
    const productData = await downloadProductsJsonl(productUrl);
    products = productData.products;
    variants = productData.variants;
    mediaByProduct = productData.mediaByProduct;
    metafieldsByProduct = productData.metafieldsByProduct;
  }

  if (inventoryUrl) {
    const inventoryData = await downloadInventoryJsonl(inventoryUrl);
    inventoryLevels = inventoryData.inventoryLevels;
  }

  // Step 5: Assemble enriched product rows
  console.log('Step 5/5: Assembling data...');

  const productRows = Array.from(products.values()).map(p => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    status: p.status,
    vendor: p.vendor,
    productType: p.productType,
    tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
    descriptionHtml: p.descriptionHtml || '',
    hasDescription: p.descriptionHtml ? 'yes' : 'no',
    totalInventory: p.totalInventory ?? 0,
    variantCount: variants.filter(v => v.productId === p.id).length,
    mediaCount: (mediaByProduct[p.id] || []).length,
    metafields: metafieldsByProduct[p.id] || [],
    outOfStockBehavior: (metafieldsByProduct[p.id] || [])
      .find(m => m.key === 'out_of_stock_behavior_bp')?.value ?? '',
    internalId: (metafieldsByProduct[p.id] || [])
      .find(m => m.key === 'internal_id')?.value ?? '',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    publishedAt: p.publishedAt,
  }));

  const variantRows = variants.map(v => {
    const product = products.get(v.productId);
    return {
      productId: v.productId,
      productTitle: product?.title || '',
      id: v.id,
      sku: v.sku || '',
      barcode: v.barcode || '',
      price: v.price,
      compareAtPrice: v.compareAtPrice || '',
      inventoryQuantity: v.inventoryQuantity ?? 0,
      inventoryPolicy: v.inventoryPolicy,
      weight: v.weight ?? 0,
      weightUnit: v.weightUnit || '',
      title: v.title || '',
      inventoryItemId: v.inventoryItem?.id || '',
      tracked: v.inventoryItem?.tracked ?? false,
    };
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nPull complete in ${elapsed}s.`);
  console.log(`  Products: ${productRows.length}`);
  console.log(`  Variants: ${variantRows.length}`);
  console.log(`  Inventory levels: ${inventoryLevels.length}`);

  return { productRows, variantRows, inventoryLevels, metafieldsByProduct };
}
