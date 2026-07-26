import {
  evaluateCapitalRelease,
  evaluateProductListing,
  nextFulfillmentMode,
  rankWarehouses,
} from '../src/index.mjs';

const now = '2026-07-20T14:00:00.000Z';
const listing = evaluateProductListing({
  productId: 'msi-stealth-ai-16',
  variantId: 'A2HWGG-008US',
  now,
  supplierOffers: [{
    supplierId: 'DISTRIBUTOR_A',
    offerId: 'offer-001',
    wholesaleCostCents: 170_000,
    fulfillmentCostCents: 2_500,
    availableQuantity: 4,
    checkedAt: now,
    reliabilityBps: 9_500,
    estimatedDeliveryDays: 3,
  }],
  competitorObservations: [
    { competitorId: 'retailer-a', priceCents: 199_999, shippingCents: 0, trustBps: 9_500, observedAt: now, inStock: true, comparable: true, condition: 'NEW' },
    { competitorId: 'retailer-b', priceCents: 202_499, shippingCents: 0, trustBps: 9_000, observedAt: now, inStock: true, comparable: true, condition: 'NEW' },
  ],
  policy: {
    targetMarginBps: 600,
    minimumContributionCents: 10_000,
    undercutCents: 500,
  },
});

const capital = evaluateCapitalRelease({
  order: {
    id: 'ord-demo',
    paymentIntentId: 'pi-demo',
    paymentState: 'SUCCEEDED',
    paymentMethodType: 'card',
    riskDecision: 'ALLOW',
    reconciliationHold: false,
    fulfillmentGroups: [{
      fulfillmentType: 'DISTRIBUTOR',
      wholesaleCostCents: 170_000,
      supplierShippingCents: 2_500,
      procurementBufferCents: 5_000,
    }],
  },
  capitalSnapshot: {
    mercuryAvailableCents: 160_000,
    distributorCreditAvailableCents: 30_000,
    stripeAvailableCents: 200_000,
    reservedCapitalCents: 0,
    pendingSupplierDebitsCents: 0,
    safetyBufferCents: 10_000,
  },
  now,
});

const warehouse = rankWarehouses({
  quantity: 1,
  destinationRegion: 'US_CENTRAL',
  preferredRegions: ['US_CENTRAL', 'US_EAST', 'US_WEST'],
  requirements: { batteryEligible: true },
  warehouses: [
    { id: 'east', region: 'US_EAST', availableQuantity: 0, shippingCostCents: 2_000, estimatedDeliveryDays: 3, reliabilityBps: 9_000, batteryEligible: true },
    { id: 'central', region: 'US_CENTRAL', availableQuantity: 2, shippingCostCents: 2_500, estimatedDeliveryDays: 2, reliabilityBps: 9_500, batteryEligible: true },
  ],
});

console.log(JSON.stringify({
  listing,
  capital,
  fulfillmentMode: nextFulfillmentMode({ configuredMode: 'CAPITAL_GATED_AUTO', releaseDecision: capital }),
  warehouse,
}, null, 2));
