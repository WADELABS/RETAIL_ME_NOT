import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMarketSnapshot,
  calculateMinimumViablePrice,
  evaluateProductListing,
} from '../src/index.mjs';

const NOW = '2026-07-20T14:00:00.000Z';

function offer(overrides = {}) {
  return {
    supplierId: 'DISTRIBUTOR_A',
    offerId: 'offer_a',
    wholesaleCostCents: 85_000,
    fulfillmentCostCents: 1_000,
    dropShipFeeCents: 0,
    packagingCostCents: 0,
    shippingSubsidyCents: 0,
    supplierTaxCents: 0,
    availableQuantity: 10,
    checkedAt: NOW,
    reliabilityBps: 9_000,
    estimatedDeliveryDays: 3,
    ...overrides,
  };
}

function competitor(priceCents, overrides = {}) {
  return {
    competitorId: `c_${priceCents}`,
    priceCents,
    shippingCents: 0,
    publicDiscountCents: 0,
    trustBps: 9_000,
    observedAt: NOW,
    inStock: true,
    comparable: true,
    condition: 'NEW',
    ...overrides,
  };
}

test('minimum viable floor protects both margin and minimum contribution', () => {
  const result = calculateMinimumViablePrice(offer(), {
    targetMarginBps: 600,
    minimumContributionCents: 2_500,
  });
  assert.ok(result.minimumViablePriceCents > 86_000);
  assert.equal(result.minimumViablePriceCents, Math.max(result.marginFloorCents, result.contributionFloorCents));
});

test('market snapshot ignores stale and low-trust observations', () => {
  const snapshot = buildMarketSnapshot([
    competitor(98_999),
    competitor(50_000, { trustBps: 2_000 }),
    competitor(60_000, { observedAt: '2026-07-10T00:00:00.000Z' }),
  ], {}, NOW);
  assert.equal(snapshot.accepted.length, 1);
  assert.equal(snapshot.marketPositionCents, 98_999);
});

test('pricing engine publishes a competitive price without crossing its floor', () => {
  const result = evaluateProductListing({
    productId: 'p1',
    variantId: 'v1',
    now: NOW,
    supplierOffers: [offer()],
    competitorObservations: [competitor(98_999), competitor(99_499)],
  });
  assert.equal(result.isListed, true);
  assert.ok(result.optimizedPriceCents >= result.selected.hardFloorCents);
  assert.ok(result.expectedMarginBps >= 600);
  assert.ok(result.expectedContributionCents >= 2_500);
});

test('race-to-the-bottom competitor price suppresses an unviable listing', () => {
  const result = evaluateProductListing({
    productId: 'p2',
    variantId: 'v2',
    now: NOW,
    supplierOffers: [offer({ wholesaleCostCents: 95_000 })],
    competitorObservations: [competitor(96_000)],
  });
  assert.equal(result.isListed, false);
  assert.equal(result.status, 'SUPPRESSED_NO_VIABLE_SOURCE');
  assert.ok(result.evaluations.some((item) => item.status === 'SUPPRESSED_LOW_MARGIN'));
});

test('engine selects the viable supplier offer with the strongest deterministic score', () => {
  const result = evaluateProductListing({
    productId: 'p3',
    variantId: 'v3',
    now: NOW,
    supplierOffers: [
      offer({ supplierId: 'SLOW_LOW_COST', offerId: 'slow', wholesaleCostCents: 84_000, reliabilityBps: 7_100, estimatedDeliveryDays: 10 }),
      offer({ supplierId: 'FAST_RELIABLE', offerId: 'fast', wholesaleCostCents: 84_500, reliabilityBps: 9_800, estimatedDeliveryDays: 2 }),
    ],
    competitorObservations: [competitor(99_999), competitor(100_499)],
  });
  assert.equal(result.isListed, true);
  assert.equal(result.selectedSupplierId, 'FAST_RELIABLE');
});

test('no market data uses the controlled standard markup fallback', () => {
  const result = evaluateProductListing({
    productId: 'p4',
    variantId: 'v4',
    now: NOW,
    supplierOffers: [offer()],
    competitorObservations: [],
  });
  assert.equal(result.isListed, true);
  assert.equal(result.status, 'ACTIVE_NO_MARKET_DATA');
});
