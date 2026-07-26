/**
 * Functions to normalize raw inventory data from different suppliers
 * into a consistent format for the `supplier_offers` table.
 */

/**
 * @param {any} rawInventoryData - The raw data from a supplier.
 * @param {string} supplierName - The name of the supplier for context.
 * @returns {object} A normalized inventory object.
 */
export function normalizeInventory(rawInventoryData, supplierName) {
  // Example: Supplier A uses "qty_on_hand", Supplier B uses "stock"
  let quantity;
  if (rawInventoryData.qty_on_hand !== undefined) {
    quantity = parseInt(rawInventoryData.qty_on_hand, 10);
  } else if (rawInventoryData.stock !== undefined) {
    quantity = parseInt(rawInventoryData.stock, 10);
  } else {
    quantity = 0;
  }

  // Example: Normalize SKU
  const sku = rawInventoryData.sku || rawInventoryData.part_number;

  return {
    sku,
    inventory_quantity: isNaN(quantity) ? 0 : quantity,
    last_verified: new Date().toISOString(),
  };
}
