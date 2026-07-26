/**
 * @typedef {import('./distributor-profile.schema.json')} DistributorProfile
 */

const WEIGHTS = {
  RELIABILITY: 0.35,
  PROFIT_CONTRIBUTION: 0.20,
  DELIVERY_SPEED: 0.20,
  INVENTORY_CONFIDENCE: 0.15,
  WARRANTY: 0.10,
};

/**
 * Calculates a profit-adjusted score for a supplier based on multiple factors.
 *
 * @param {object} params
 * @param {number} params.profitScore - Normalized score (0-1) for profit contribution.
 * @param {number} params.reliabilityScore - Normalized score (0-1) for reliability.
 * @param {number} params.deliveryScore - Normalized score (0-1) for delivery speed.
 * @param {number} params.inventoryConfidence - Normalized score (0-1) for inventory accuracy.
 * @param {number} params.warrantyScore - Normalized score (0-1) for warranty quality.
 * @param {number} params.riskPenalty - A penalty (0-1) deducted from the final score.
 * @returns {number} The final supplier score.
 */
export function calculateSupplierScore({
  profitScore,
  reliabilityScore,
  deliveryScore,
  inventoryConfidence,
  warrantyScore,
  riskPenalty = 0,
}) {
  const weightedScore =
    (profitScore * WEIGHTS.PROFIT_CONTRIBUTION) +
    (reliabilityScore * WEIGHTS.RELIABILITY) +
    (deliveryScore * WEIGHTS.DELIVERY_SPEED) +
    (inventoryConfidence * WEIGHTS.INVENTORY_CONFIDENCE) +
    (warrantyScore * WEIGHTS.WARRANTY);

  return Math.max(0, weightedScore - riskPenalty);
}

/**
 * Orchestrates the scoring of a supplier.
 * In a real implementation, this would fetch data from the database.
 *
 * @param {DistributorProfile} supplier
 * @param {object} offerDetails
 * @returns {Promise<number>}
 */
export async function scoreSupplier(supplier, offerDetails) {
  // Placeholder: In a real system, these would be calculated based on
  // data from supplier_performance, supplier_offers, etc.
  const profitScore = 0.8; // e.g., based on expected_profit_cents for the offer
  const reliabilityScore = supplier.reliability_score || 0;
  const deliveryScore = 1 - (supplier.average_ship_days || 10) / 30; // Normalize based on a 30-day max
  const inventoryConfidence = 0.9; // e.g., based on historical stockouts
  const warrantyScore = offerDetails.warranty_source === 'SUPPLIER' ? 0.9 : 0.5;
  const riskPenalty = 0; // e.g., for high chargeback rates

  return calculateSupplierScore({
    profitScore,
    reliabilityScore,
    deliveryScore,
    inventoryConfidence,
    warrantyScore,
    riskPenalty
  });
}
