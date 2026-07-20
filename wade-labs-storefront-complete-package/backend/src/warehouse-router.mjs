import { assertIntegerCents } from './money.mjs';

export function rankWarehouses({ warehouses, quantity, destinationRegion, requirements = {}, preferredRegions = [] }) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new TypeError('quantity must be a positive integer');
  const preferredIndex = new Map(preferredRegions.map((region, index) => [region, index]));

  const evaluated = (warehouses ?? []).map((warehouse) => {
    assertIntegerCents(warehouse.availableQuantity ?? 0, 'warehouse availableQuantity');
    assertIntegerCents(warehouse.shippingCostCents ?? 0, 'warehouse shippingCostCents');
    const reasons = [];
    if ((warehouse.availableQuantity ?? 0) < quantity) reasons.push('INSUFFICIENT_STOCK');
    if (requirements.airEligible === true && warehouse.airEligible === false) reasons.push('AIR_RESTRICTED');
    if (requirements.batteryEligible === true && warehouse.batteryEligible === false) reasons.push('BATTERY_RESTRICTED');
    if (requirements.allowedRegions && !requirements.allowedRegions.includes(warehouse.region)) reasons.push('REGION_NOT_ALLOWED');

    const preferencePenalty = preferredIndex.has(warehouse.region)
      ? preferredIndex.get(warehouse.region) * 500
      : preferredRegions.length * 500;
    const destinationPenalty = warehouse.region === destinationRegion ? 0 : 750;
    const etaPenalty = Math.max(0, warehouse.estimatedDeliveryDays ?? 7) * 250;
    const reliabilityPenalty = 10_000 - (warehouse.reliabilityBps ?? 8_000);
    const score =
      (warehouse.shippingCostCents ?? 0) +
      preferencePenalty +
      destinationPenalty +
      etaPenalty +
      reliabilityPenalty;

    return {
      warehouse,
      eligible: reasons.length === 0,
      reasons,
      score,
    };
  });

  const eligible = evaluated.filter((item) => item.eligible).sort((a, b) => a.score - b.score);
  return {
    selected: eligible[0]?.warehouse ?? null,
    ranked: eligible,
    rejected: evaluated.filter((item) => !item.eligible),
    status: eligible.length ? 'WAREHOUSE_SELECTED' : 'NO_ELIGIBLE_WAREHOUSE',
  };
}
