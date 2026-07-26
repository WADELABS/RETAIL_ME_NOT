/**
 * Functions to normalize raw cost/price data from different suppliers
 * into a consistent format for the `supplier_offers` table.
 */

/**
 * @param {any} rawCostData - The raw cost data from a supplier.
 * @param {string} supplierName - The name of the supplier.
 * @returns {object} A normalized cost object.
 */
export function normalizeCost(rawCostData, supplierName) {
  // Example: cost is in dollars, needs to be in cents
  let wholesaleCostCents;
  if (typeof rawCostData.cost === 'number') {
    wholesaleCostCents = Math.round(rawCostData.cost * 100);
  } else if (typeof rawCostData.price === 'string') {
    wholesaleCostCents = Math.round(parseFloat(rawCostData.price.replace('$', '')) * 100);
  } else {
    wholesaleCostCents = 0;
  }

  // Example: MAP price
  const mapPriceCents = rawCostData.map_price ? Math.round(rawCostData.map_price * 100) : null;

  return {
    wholesale_cost_cents: isNaN(wholesaleCostCents) ? 0 : wholesaleCostCents,
    dropship_fee_cents: Math.round((rawCostData.dropship_fee || 0) * 100),
    shipping_cost_cents: Math.round((rawCostData.shipping_cost || 0) * 100),
    map_price_cents: isNaN(mapPriceCents) ? null : mapPriceCents,
  };
}
