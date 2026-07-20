import test from 'node:test';
import assert from 'node:assert/strict';
import { rankWarehouses } from '../src/index.mjs';

const warehouses = [
  { id: 'east', region: 'US_EAST', availableQuantity: 0, shippingCostCents: 800, estimatedDeliveryDays: 2, reliabilityBps: 9_500, batteryEligible: true, airEligible: true },
  { id: 'central', region: 'US_CENTRAL', availableQuantity: 5, shippingCostCents: 1_000, estimatedDeliveryDays: 3, reliabilityBps: 9_200, batteryEligible: true, airEligible: true },
  { id: 'west', region: 'US_WEST', availableQuantity: 5, shippingCostCents: 900, estimatedDeliveryDays: 5, reliabilityBps: 9_700, batteryEligible: false, airEligible: true },
];

test('router falls back from empty east inventory to an eligible warehouse', () => {
  const result = rankWarehouses({
    warehouses,
    quantity: 1,
    destinationRegion: 'US_EAST',
    preferredRegions: ['US_EAST', 'US_CENTRAL', 'US_WEST'],
  });
  assert.equal(result.status, 'WAREHOUSE_SELECTED');
  assert.equal(result.selected.id, 'central');
});

test('battery rule excludes a cheaper but ineligible warehouse', () => {
  const result = rankWarehouses({
    warehouses,
    quantity: 1,
    destinationRegion: 'US_WEST',
    preferredRegions: ['US_WEST', 'US_CENTRAL'],
    requirements: { batteryEligible: true },
  });
  assert.equal(result.selected.id, 'central');
  assert.ok(result.rejected.some((item) => item.warehouse.id === 'west' && item.reasons.includes('BATTERY_RESTRICTED')));
});
