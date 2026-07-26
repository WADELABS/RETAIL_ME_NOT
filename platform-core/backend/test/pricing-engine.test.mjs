import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMinimumViablePrice,
  evaluateProductListing,
  buildMarketSnapshot,
} from '../src/index.mjs';

// --- Test Data Setup ---

const NOW = '2026-07-20T14:00:00.000Z';

// Mock data now reflects the new schema
const mockSuppliers = [
  {
    supplier_id: 'distributor-a',
    name: 'Distributor A',
    reliability_score: 0.98,
    average_ship_days: 2,
  },
  {
    supplier_id: 'distributor-b',
    name: 'Distributor B',
    reliability_score: 0.95,
    average_ship_days: 5,
  },
  {
    supplier_id: 'distributor-c',
    name: 'Distributor C (Slow)',
    reliability_score: 0.90,
    average_ship_days: 10,
  }
];

function createOffer(overrides = {}) {
  return {
    offer_id: `offer-${Math.random()}`,
    supplier_id: 'distributor-a',
    sku: 'SKU123',
    wholesale_cost_cents: 80000, // $800
    dropship_fee_cents: 500,
    shipping_cost_cents: 1500,
    inventory_quantity: 100,
    map_price_cents: null,
    warranty_source: 'MANUFACTURER',
    last_verified: NOW,
    ...overrides,
  };
}

function createCompetitor(priceCents, overrides = {}) {
  return {
    competitorId: `c_${priceCents}`,
    priceCents,
    shippingCents: 0,
    publicDiscountCents: 0,
    trustBps: 9000,
    observedAt: NOW,
    inStock: true,
    comparable: true,
    condition: 'NEW',
    ...overrides,
  };
}

// --- Test Cases ---

test('calculateMinimumViablePrice implements hardened formula', () => {
  const offer = createOffer({ wholesale_cost_cents: 80000 }); // $800 cost
  const policy = {
    minimumContributionCents: 7500, // $75
    fraudReserveBps: 200, // 2%
    returnReserveBps: 500, // 5%
    warrantyReserveBps: 300, // 3%
    processingFeeBps: 290,
    processingFlatFeeCents: 30,
    estimatedTaxBps: 0, // Simplify for testing
  };
  // Total variable rate = 2% + 5% + 3% + 2.9% = 12.9%
  // Base cost = $800 (wholesale) + $5 (dropship) + $15 (shipping) + $0.30 (flat fee) + $75 (profit) = $895.30
  // Price = 89530 / (1 - 0.129) = 89530 / 0.871 = 102789.9
  const { minimumViablePriceCents } = calculateMinimumViablePrice(offer, policy);
  assert.ok(minimumViablePriceCents > 102700, `Expected over 102700, got ${minimumViablePriceCents}`);
  assert.equal(minimumViablePriceCents, 102790); // ceil(102789.9)
});

test('evaluateProductListing selects best supplier based on new score', async () => {
  const offers = [
    createOffer({ supplier_id: 'distributor-a', wholesale_cost_cents: 80000 }), // Best score
    createOffer({ supplier_id: 'distributor-b', wholesale_cost_cents: 79000 }), // Cheaper, but lower score
    createOffer({ supplier_id: 'distributor-c', wholesale_cost_cents: 78000 }), // Cheapest, but slow
  ];

  const result = await evaluateProductListing({
    sku: 'SKU123',
    suppliers: mockSuppliers,
    supplierOffers: offers,
    competitorObservations: [createCompetitor(105000)],
    now: NOW,
  });

  assert.equal(result.isListed, true);
  assert.equal(result.selectedSupplierId, 'distributor-a', 'Should select Distributor A for its high score despite higher cost');
});

test('evaluateProductListing suppresses listing due to low margin', async () => {
  const offers = [
    createOffer({ wholesale_cost_cents: 95000 }), // $950
  ];
  const competitors = [
    createCompetitor(98000), // Market price is too low to meet $75 min profit
  ];

  const result = await evaluateProductListing({
    sku: 'SKU123',
    suppliers: mockSuppliers,
    supplierOffers: offers,
    competitorObservations: competitors,
    now: NOW,
    policy: { minimumContributionCents: 7500 }
  });

  assert.equal(result.isListed, false, 'Listing should be suppressed');
  assert.equal(result.status, 'SUPPRESSED_LOW_MARGIN', 'Suppression reason should be low margin');
});

test('evaluateProductListing suppresses for no viable supplier (stale inventory)', async () => {
    const staleOffer = createOffer({ last_verified: '2026-01-01T00:00:00.000Z' });
    const result = await evaluateProductListing({
      sku: 'SKU456',
      suppliers: mockSuppliers,
      supplierOffers: [staleOffer],
      now: NOW,
    });
    assert.equal(result.isListed, false);
    assert.equal(result.status, 'SUPPRESSED_STALE_INVENTORY');
});

test('evaluateProductListing suppresses for MAP restriction', async () => {
    const mapOffer = createOffer({ map_price_cents: 110000 });
    const competitors = [createCompetitor(105000)]; // Market is below MAP
    const result = await evaluateProductListing({
      sku: 'SKU789',
      suppliers: mockSuppliers,
      supplierOffers: [mapOffer],
      competitorObservations: competitors,
      now: NOW,
    });
    assert.equal(result.isListed, false);
    assert.equal(result.status, 'SUPPRESSED_MAP_RESTRICTION');
});

test('buildMarketSnapshot still works as expected', () => {
  const snapshot = buildMarketSnapshot([
    createCompetitor(98_999),
    createCompetitor(50_000, { trustBps: 2_000 }),
    createCompetitor(60_000, { observedAt: '2026-07-10T00:00:00.000Z' }),
  ], {}, NOW);
  assert.equal(snapshot.accepted.length, 1);
  assert.equal(snapshot.marketPositionCents, 98_999);
});
