import https from 'https';
import readline from 'readline';

/**
 * Download a JSONL file from the given URL (Shopify bulk operation result)
 * and parse it into structured data.
 *
 * JSONL structure:
 * - Root objects (products) have no __parentId
 * - Child objects (variants, metafields, media) have __parentId pointing to their parent's id
 *
 * Returns: { products: Map<id, product>, variants: Array, mediaByProduct: Object, metafieldsByProduct: Object }
 */
export async function downloadProductsJsonl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const rl = readline.createInterface({
        input: response,
        crlfDelay: Infinity,
      });

      const products = new Map();
      const variants = [];
      const mediaByProduct = {};
      const metafieldsByProduct = {};

      rl.on('line', (line) => {
        if (!line.trim()) return;
        const obj = JSON.parse(line);

        if (obj.__parentId) {
          const parentId = obj.__parentId;
          const id = obj.id || '';

          if (id.includes('/ProductVariant/')) {
            variants.push({ ...obj, productId: parentId });
            delete variants[variants.length - 1].__parentId;
          } else if (id.includes('/MediaImage/') || id.includes('/Video/') || obj.mediaContentType) {
            if (!mediaByProduct[parentId]) mediaByProduct[parentId] = [];
            mediaByProduct[parentId].push(obj);
          } else if (obj.namespace !== undefined && obj.key !== undefined) {
            if (!metafieldsByProduct[parentId]) metafieldsByProduct[parentId] = [];
            metafieldsByProduct[parentId].push({
              namespace: obj.namespace,
              key: obj.key,
              value: obj.value,
              type: obj.type,
            });
          } else if (id.includes('/InventoryItem/')) {
            // inventoryItem child of variant — skip, we get inventory from separate bulk op
          }
        } else {
          products.set(obj.id, obj);
        }
      });

      rl.on('close', () => {
        console.log(`  Parsed ${products.size} products, ${variants.length} variants from JSONL`);
        resolve({ products, variants, mediaByProduct, metafieldsByProduct });
      });

      rl.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Download and parse inventory JSONL from a bulk operation result.
 * Root objects are InventoryItems; children are InventoryLevels.
 *
 * Returns: { inventoryLevels: Array }
 */
export async function downloadInventoryJsonl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const rl = readline.createInterface({
        input: response,
        crlfDelay: Infinity,
      });

      const inventoryItems = new Map();
      const inventoryLevels = [];

      rl.on('line', (line) => {
        if (!line.trim()) return;
        const obj = JSON.parse(line);

        if (obj.__parentId) {
          const parent = inventoryItems.get(obj.__parentId);
          if (obj.quantities) {
            const quantities = {};
            for (const q of obj.quantities) {
              quantities[q.name] = q.quantity;
            }
            inventoryLevels.push({
              inventoryItemId: obj.__parentId,
              sku: parent?.sku || '',
              variantId: parent?.variant?.id || '',
              productId: parent?.variant?.product?.id || '',
              productTitle: parent?.variant?.product?.title || '',
              locationId: obj.location?.id || '',
              locationName: obj.location?.name || '',
              available: quantities.available ?? 0,
              onHand: quantities.on_hand ?? 0,
              incoming: quantities.incoming ?? 0,
              committed: quantities.committed ?? 0,
            });
          }
        } else {
          inventoryItems.set(obj.id, obj);
        }
      });

      rl.on('close', () => {
        console.log(`  Parsed ${inventoryLevels.length} inventory levels from JSONL`);
        resolve({ inventoryLevels });
      });

      rl.on('error', reject);
    }).on('error', reject);
  });
}
