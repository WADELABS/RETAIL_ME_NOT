import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SourcingAndPricingOptimizer, SourcingOption, PricingPolicy } from '../src/index';

const testPolicy: PricingPolicy = {
  minimumContributionCents: 7500, // $75 minimum profit
  targetMarginBps: 1500,
  fraudReserveBps: 200,   // 2%
  returnReserveBps: 500,  // 5%
  warrantyReserveBps: 300, // 3%
  processingFeeBps: 290,  // 2.9%
  processingFlatFeeCents: 30,
};

test('Optimizer calculates exact cost-aware minimum selling price', () => {
  const optimizer = new SourcingAndPricingOptimizer();
  const option: SourcingOption = {
    providerId: 'DISTRIBUTOR_A',
    providerType: 'DISTRIBUTOR',
    wholesaleCostCents: 80000, // $800
    dropshipFeeCents: 500,     // $5
    shippingCostCents: 1500,   // $15
    averageShipDays: 2,
    providerReliabilityScore: 0.99,
    inventoryQuantity: 100,
  };

  const price = optimizer.calculateMinimumViablePrice('LAPTOP-WADE-01', option, testPolicy);
  assert.equal(price, 102790);
});

test('Optimizer correctly prioritizes higher reliability over lower cost', () => {
  const optimizer = new SourcingAndPricingOptimizer();

  const options: SourcingOption[] = [
    {
      providerId: 'CHEAP_BUT_UNRELIABLE_DISTRIBUTOR',
      providerType: 'DISTRIBUTOR',
      wholesaleCostCents: 78000,
      dropshipFeeCents: 500,
      shippingCostCents: 1500,
      averageShipDays: 10,
      providerReliabilityScore: 0.75,
      inventoryQuantity: 20,
    },
    {
      providerId: 'EXPENSIVE_BUT_RELIABLE_DISTRIBUTOR',
      providerType: 'DISTRIBUTOR',
      wholesaleCostCents: 80000,
      dropshipFeeCents: 500,
      shippingCostCents: 1500,
      averageShipDays: 2,
      providerReliabilityScore: 0.99,
      inventoryQuantity: 100,
    }
  ];

  const result = optimizer.optimize('LAPTOP-WADE-01', options, testPolicy);
  assert.equal(result.selectedProviderId, 'EXPENSIVE_BUT_RELIABLE_DISTRIBUTOR');
  assert.ok(result.optimizationScore > 0.85);
});

test('Pricing Engine protects against division-by-zero on 100% combined variable fees', () => {
  const optimizer = new SourcingAndPricingOptimizer();
  const option: SourcingOption = {
    providerId: 'DISTRIBUTOR_A',
    providerType: 'DISTRIBUTOR',
    wholesaleCostCents: 10000,
    dropshipFeeCents: 0,
    shippingCostCents: 0,
    averageShipDays: 1,
    providerReliabilityScore: 0.99,
    inventoryQuantity: 100,
  };

  const brokenPolicy: PricingPolicy = {
    ...testPolicy,
    fraudReserveBps: 5000,
    returnReserveBps: 5000,
  };

  assert.throws(
    () => {
      optimizer.calculateMinimumViablePrice('LAPTOP-WADE-01', option, brokenPolicy);
    },
    RangeError,
    'Combined variable rates of 100% or more must fail-safe and throw a RangeError'
  );
});

test('Pricing Engine handles zero cost products correctly (e.g., free promotional items)', () => {
  const optimizer = new SourcingAndPricingOptimizer();
  
  const freeOption: SourcingOption = {
    providerId: 'FREE_PROMO_NODE',
    providerType: 'OWN_WAREHOUSE',
    wholesaleCostCents: 0,
    dropshipFeeCents: 0,
    shippingCostCents: 0,
    averageShipDays: 1,
    providerReliabilityScore: 1.0,
    inventoryQuantity: 10,
  };

  const price = optimizer.calculateMinimumViablePrice('PROMO-STICKER-01', freeOption, testPolicy);
  assert.equal(price, 8646);
});


// --- NEW ADVANCED GATEWAY FEE CALCULATION TESTS ---

test('FEE CALCULATION HOOKS: Pricing Engine accurately calculates expected net profit and margin including Stripe gateway fees', () => {
  const optimizer = new SourcingAndPricingOptimizer();

  const option: SourcingOption = {
    providerId: 'DISTRIBUTOR_A',
    providerType: 'DISTRIBUTOR',
    wholesaleCostCents: 95000, // $950
    dropshipFeeCents: 0,
    shippingCostCents: 1500,   // $15
    averageShipDays: 2,
    providerReliabilityScore: 0.99,
    inventoryQuantity: 50,
  };

  const proposedPriceCents = 129900; // $1,299.00

  const metrics = optimizer.calculateExpectedNetProfit('LAPTOP-WADE-01', proposedPriceCents, option, testPolicy);

  // 1. Verify Stripe Fee: 2.9% of $1,299 + $0.30 = $37.67 + $0.30 = $37.97 (3797 cents)
  assert.equal(metrics.stripeFeeCents, 3797, 'Stripe gateway fees must be accurately calculated');

  // 2. Verify Supplier COGS: $950 + $15 = $965 (96500 cents)
  assert.equal(metrics.wholesaleCOGS, 96500);

  // 3. Verify Reserves: 10% (2% fraud + 5% return + 3% warranty) of $1,299 = $129.90 (12990 cents)
  assert.equal(metrics.allocatedReservesCents, 12990);

  // 4. Verify Net Profit: $1,299 - $37.97 - $965 - $129.90 = $166.13 (16613 cents)
  assert.equal(metrics.netProfitCents, 16613, 'Net profit cents must be calculated with 100% precision');

  // 5. Verify Net Margin: 166.13 / 1299 = 12.789%
  assert.ok(metrics.netMarginPercentage > 12.78 && metrics.netMarginPercentage < 12.80);
});
