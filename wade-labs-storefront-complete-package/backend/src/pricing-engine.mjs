import {
  applyBpsCeil,
  assertBps,
  assertIntegerCents,
  ceilDiv,
  roundUpToEnding,
  sumCents,
} from './money.mjs';
import { calculateSupplierScore } from './supplier-intelligence/supplier-score-engine.mjs';

const DEFAULT_POLICY = Object.freeze({
  // New hardened defaults from TASK_LOCK
  minimumContributionCents: 7500, // $75 for high-end electronics
  fraudReserveBps: 200, // 2%
  returnReserveBps: 500, // 5%
  warrantyReserveBps: 300, // 3%

  // Existing defaults, kept for now
  targetMarginBps: 600,
  processingFeeBps: 290,
  processingFlatFeeCents: 30,
  estimatedTaxBps: 850,
  undercutCents: 100,
  premiumToleranceBps: 250,
  standardMarkupBps: 1_500,
  competitorQuantileBps: 3_500,
  minimumCompetitorTrustBps: 7_000,
  minimumCompetitorCount: 1,
  competitorFreshnessMs: 24 * 60 * 60 * 1_000,
  supplierOfferFreshnessMs: 24 * 60 * 60 * 1_000,
  maximumDailyDecreaseBps: 500,
  maximumDailyDecreaseCents: 10_000,
  priceEndingCents: 99,
  allowNoMarketData: true,
  suppressWhenAboveMarketCeiling: true,
  condition: 'NEW',
});

function normalizePolicy(policy = {}) {
  const merged = { ...DEFAULT_POLICY, ...policy };
  for (const key of [
    'targetMarginBps',
    'processingFeeBps',
    'returnReserveBps',
    'fraudReserveBps',
    'warrantyReserveBps',
    'estimatedTaxBps',
    'premiumToleranceBps',
    'standardMarkupBps',
    'competitorQuantileBps',
    'minimumCompetitorTrustBps',
    'maximumDailyDecreaseBps',
  ]) assertBps(merged[key], key);

  for (const key of [
    'minimumContributionCents',
    'processingFlatFeeCents',
    'undercutCents',
    'maximumDailyDecreaseCents',
  ]) assertIntegerCents(merged[key], key);

  if (!Number.isInteger(merged.minimumCompetitorCount) || merged.minimumCompetitorCount < 0) {
    throw new TypeError('minimumCompetitorCount must be a non-negative integer');
  }
  if (!Number.isSafeInteger(merged.competitorFreshnessMs) || merged.competitorFreshnessMs <= 0) {
    throw new TypeError('competitorFreshnessMs must be a positive safe integer');
  }
  if (!Number.isSafeInteger(merged.supplierOfferFreshnessMs) || merged.supplierOfferFreshnessMs <= 0) {
    throw new TypeError('supplierOfferFreshnessMs must be a positive safe integer');
  }
  return merged;
}

function assertDate(value, name) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new TypeError(`${name} must be a valid date`);
  return timestamp;
}

/**
 * New, more direct cost calculation based on the new supplier_offers schema.
 * @param {object} offer - A supplier offer.
 */
export function calculateAllInCostCents(offer) {
  const fields = [
    offer.wholesale_cost_cents,
    offer.dropship_fee_cents ?? 0,
    offer.shipping_cost_cents ?? 0,
  ];
  return sumCents(fields, 'supplier offer cost');
}

/**
 * Implements the new hardened pricing algorithm.
 * Minimum Selling Price =
 *   Supplier Cost + Dropship Fee + Shipping Cost + Payment Processing
 *   + Fraud Reserve + Return Reserve + Warranty Reserve + Minimum Profit Requirement
 * @param {object} offer - A supplier offer from the new schema.
 * @param {object} policyInput - The applicable pricing policy.
 */
export function calculateMinimumViablePrice(offer, policyInput = {}) {
  const policy = normalizePolicy(policyInput);
  const allInCostCents = calculateAllInCostCents(offer);

  // This function now calculates the final price, not just a floor.
  // The price must cover the cost, all reserves, and the minimum contribution.
  // The variable fees (reserves, processing) are based on the final price,
  // so we have to solve for Price.
  // Price = (allInCost + flatFee + minContribution) / (1 - variableFeeBps)

  const variableReserveBps =
    policy.fraudReserveBps +
    policy.returnReserveBps +
    policy.warrantyReserveBps;

  // Estimate processing fee on the final price, including tax.
  const estimatedProcessingOnTaxBps = ceilDiv(
    policy.processingFeeBps * policy.estimatedTaxBps,
    10_000,
  );

  const totalVariableBps = variableReserveBps + policy.processingFeeBps + estimatedProcessingOnTaxBps;

  if (totalVariableBps >= 10_000) {
    throw new RangeError('Sum of variable reserves and fees must be less than 100%');
  }

  const baseCost = allInCostCents + policy.processingFlatFeeCents + policy.minimumContributionCents;

  const minimumViablePriceCents = ceilDiv(
    baseCost * 10_000,
    10_000 - totalVariableBps,
  );

  return {
    allInCostCents,
    minimumViablePriceCents,
  };
}

function weightedQuantile(values, quantileBps) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  const threshold = ceilDiv(totalWeight * quantileBps, 10_000);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= threshold) return item.value;
  }
  return sorted.at(-1).value;
}

export function normalizeCompetitorObservations(observations, policyInput = {}, nowInput = new Date()) {
  const policy = normalizePolicy(policyInput);
  const now = assertDate(nowInput, 'now');
  const accepted = [];
  const rejected = [];

  for (const observation of observations ?? []) {
    try {
      assertIntegerCents(observation.priceCents, 'competitor priceCents');
      assertIntegerCents(observation.shippingCents ?? 0, 'competitor shippingCents');
      assertIntegerCents(observation.publicDiscountCents ?? 0, 'competitor publicDiscountCents');
      assertBps(observation.trustBps ?? 10_000 - 1, 'competitor trustBps');
      const observedAt = assertDate(observation.observedAt, 'competitor observedAt');
      const ageMs = now - observedAt;
      const landedPriceCents = Math.max(
        0,
        observation.priceCents + (observation.shippingCents ?? 0) - (observation.publicDiscountCents ?? 0),
      );

      let reason = null;
      if (observation.comparable === false) reason = 'NOT_COMPARABLE';
      else if (observation.inStock === false) reason = 'OUT_OF_STOCK';
      else if ((observation.condition ?? 'NEW') !== policy.condition) reason = 'CONDITION_MISMATCH';
      else if ((observation.trustBps ?? 9_999) < policy.minimumCompetitorTrustBps) reason = 'LOW_TRUST';
      else if (ageMs < 0 || ageMs > policy.competitorFreshnessMs) reason = 'STALE';

      if (reason) rejected.push({ observation, reason });
      else accepted.push({
        ...observation,
        landedPriceCents,
        weight: Math.max(1, observation.trustBps ?? 9_999),
      });
    } catch (error) {
      rejected.push({ observation, reason: 'INVALID', error: error.message });
    }
  }

  return { accepted, rejected };
}

export function buildMarketSnapshot(observations, policyInput = {}, nowInput = new Date()) {
  const policy = normalizePolicy(policyInput);
  const { accepted, rejected } = normalizeCompetitorObservations(observations, policy, nowInput);
  const weighted = accepted.map((entry) => ({ value: entry.landedPriceCents, weight: entry.weight }));

  if (accepted.length < policy.minimumCompetitorCount) {
    return {
      status: 'INSUFFICIENT_MARKET_DATA',
      accepted,
      rejected,
      marketPositionCents: null,
      medianCents: null,
      lowestCents: accepted.length ? Math.min(...accepted.map((item) => item.landedPriceCents)) : null,
    };
  }

  return {
    status: 'MARKET_DATA_READY',
    accepted,
    rejected,
    marketPositionCents: weightedQuantile(weighted, policy.competitorQuantileBps),
    medianCents: weightedQuantile(weighted, 5_000),
    lowestCents: Math.min(...accepted.map((item) => item.landedPriceCents)),
  };
}

function estimateEconomics(priceCents, offer, floor, policy) {
  const estimatedTaxCents = applyBpsCeil(priceCents, policy.estimatedTaxBps);
  const processingFeeCents =
    applyBpsCeil(priceCents + estimatedTaxCents, policy.processingFeeBps) +
    policy.processingFlatFeeCents;
  const reserveCents =
    applyBpsCeil(priceCents, policy.returnReserveBps) +
    applyBpsCeil(priceCents, policy.fraudReserveBps) +
    applyBpsCeil(priceCents, policy.warrantyReserveBps);
  const expectedContributionCents =
    priceCents - floor.allInCostCents - processingFeeCents - reserveCents;
  const expectedMarginBps = priceCents === 0
    ? 0
    : Math.floor((expectedContributionCents * 10_000) / priceCents);

  return {
    estimatedTaxCents,
    processingFeeCents,
    reserveCents,
    expectedContributionCents,
    expectedMarginBps,
  };
}

function applyDecreaseGuard(candidateCents, currentPriceCents, policy) {
  if (currentPriceCents == null) return { priceCents: candidateCents, constrained: false };
  assertIntegerCents(currentPriceCents, 'currentPriceCents');
  const percentageLimit = applyBpsCeil(currentPriceCents, policy.maximumDailyDecreaseBps);
  const allowedDecrease = Math.min(percentageLimit, policy.maximumDailyDecreaseCents);
  const lowestAllowed = Math.max(0, currentPriceCents - allowedDecrease);
  if (candidateCents < lowestAllowed) {
    return { priceCents: lowestAllowed, constrained: true };
  }
  return { priceCents: candidateCents, constrained: false };
}

async function getSupplierScore(supplier, offer, economics) {
  // Normalize inputs for the scoring engine.
  // The profit score denominator is increased to 15000 ($150) to make it less sensitive
  // and prevent small profit gains from outweighing larger performance differences.
  const profitScore = Math.max(0, Math.min(1, (economics.expectedContributionCents ?? 0) / 10000));
  const reliabilityScore = supplier.reliability_score ?? 0.8;
  const deliveryScore = 1 - Math.min(1, (supplier.average_ship_days ?? 7) / 30);
  const inventoryConfidence = Math.min(1, (offer.inventory_quantity ?? 0) / 100) * (supplier.reliability_score ?? 0.8);
  const warrantyScore = offer.warranty_source === 'SUPPLIER' ? 0.9 : (offer.warranty_source === 'MANUFACTURER' ? 0.6 : 0.2);

  // In a full implementation, risk penalty would be calculated from the supplier_performance table
  const riskPenalty = 0;

  return calculateSupplierScore({
    profitScore,
    reliabilityScore,
    deliveryScore,
    inventoryConfidence,
    warrantyScore,
    riskPenalty,
  });
}

async function evaluateOffer({ offer, supplier, market, policy, currentPriceCents, now }) {
  const offerCheckedAt = assertDate(offer.last_verified, 'offer last_verified');
  if (now - offerCheckedAt > policy.supplierOfferFreshnessMs || now < offerCheckedAt) {
    return { supplierId: supplier.supplier_id, status: 'SUPPRESSED_STALE_INVENTORY', viable: false };
  }
  if ((offer.inventory_quantity ?? 0) <= 0) {
    // Using a more generic 'NO_SUPPLIER' as the quantity is zero, making the supplier effectively unavailable for this SKU.
    return { supplierId: supplier.supplier_id, status: 'SUPPRESSED_NO_SUPPLIER', viable: false };
  }

  const floor = calculateMinimumViablePrice(offer, policy);
  const mapCents = offer.map_price_cents ?? 0;
  const hardFloorCents = Math.max(floor.minimumViablePriceCents, mapCents);

  let desiredCents;
  let marketCeilingCents = null;

  if (market.status === 'MARKET_DATA_READY') {
    desiredCents = Math.max(0, market.marketPositionCents - policy.undercutCents);
    marketCeilingCents = ceilDiv(
      market.medianCents * (10_000 + policy.premiumToleranceBps),
      10_000,
    );
  } else {
    if (!policy.allowNoMarketData) {
      return { supplierId: supplier.supplier_id, status: 'MANUAL_REVIEW', viable: false, floor, reason: 'No market data and policy forbids fallback.' };
    }
    desiredCents = ceilDiv(
      floor.allInCostCents * (10_000 + policy.standardMarkupBps),
      10_000,
    );
  }

  let candidateCents = Math.max(hardFloorCents, desiredCents);

  if (
    marketCeilingCents != null &&
    hardFloorCents > marketCeilingCents &&
    policy.suppressWhenAboveMarketCeiling
  ) {
    return {
      supplierId: supplier.supplier_id,
      status: mapCents > marketCeilingCents ? 'SUPPRESSED_MAP_RESTRICTION' : 'SUPPRESSED_LOW_MARGIN',
      viable: false,
      floor,
      hardFloorCents,
      marketCeilingCents,
    };
  }

  const decreaseGuard = applyDecreaseGuard(candidateCents, currentPriceCents, policy);
  candidateCents = Math.max(decreaseGuard.priceCents, hardFloorCents);
  candidateCents = roundUpToEnding(candidateCents, policy.priceEndingCents);

  if (
    marketCeilingCents != null &&
    candidateCents > marketCeilingCents &&
    policy.suppressWhenAboveMarketCeiling
  ) {
    return {
      supplierId: supplier.supplier_id,
      status: 'SUPPRESSED_LOW_MARGIN', // Price is above market
      viable: false,
      floor,
      candidateCents,
      marketCeilingCents,
    };
  }

  const economics = estimateEconomics(candidateCents, offer, floor, policy);
  // Final check after rounding
  if (
    economics.expectedContributionCents < policy.minimumContributionCents
  ) {
    return {
      supplierId: supplier.supplier_id,
      status: 'SUPPRESSED_LOW_MARGIN',
      viable: false,
      floor,
      candidateCents,
      economics,
    };
  }

  const score = await getSupplierScore(supplier, offer, economics);

  return {
    supplierId: supplier.supplier_id,
    offerId: offer.offer_id,
    status: 'ACTIVE', // If it's viable, it's active.
    viable: true,
    publicPriceCents: candidateCents,
    hardFloorCents,
    marketCeilingCents,
    floor,
    economics,
    score,
    source: {
      supplierId: supplier.supplier_id,
      offerId: offer.offer_id,
      availableQuantity: offer.inventory_quantity,
      checkedAt: offer.last_verified,
    },
  };
}

export async function evaluateProductListing(input) {
  const policy = normalizePolicy(input.policy);
  const now = assertDate(input.now ?? new Date(), 'now');
  const market = buildMarketSnapshot(input.competitorObservations ?? [], policy, now);

  // In a real implementation, input.supplierOffers would be enriched with supplier data
  const evaluations = await Promise.all(
    (input.supplierOffers ?? []).map((offer) => {
      // This is a placeholder for joining supplier data to the offer
      const supplier = input.suppliers.find(s => s.supplier_id === offer.supplier_id);
      if (!supplier) {
        return {
          supplierId: offer.supplier_id,
          status: 'MANUAL_REVIEW',
          viable: false,
          reason: 'Supplier data not found for offer.'
        };
      }
      return evaluateOffer({
        offer,
        supplier,
        market,
        policy,
        currentPriceCents: input.currentPriceCents,
        now,
      });
    })
  );


  const viable = evaluations.filter((result) => result.viable);
  viable.sort((a, b) => b.score - a.score || a.publicPriceCents - b.publicPriceCents);
  const selected = viable[0] ?? null;

  if (!selected) {
    // Find the most common suppression reason if no viable offer is found
    const suppressionReasons = evaluations.map(e => e.status).filter(Boolean);
    const reasonCounts = suppressionReasons.reduce((acc, reason) => {
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});
    const primaryReason = Object.keys(reasonCounts).sort((a,b) => reasonCounts[b] - reasonCounts[a])[0] || 'SUPPRESSED_NO_SUPPLIER';

    return {
      sku: input.sku,
      isListed: false,
      status: primaryReason,
      market,
      selected: null,
      evaluations,
    };
  }

  return {
    sku: input.sku,
    isListed: true,
    status: selected.status,
    optimizedPriceCents: selected.publicPriceCents,
    selectedSupplierId: selected.supplierId,
    selectedOfferId: selected.offerId,
    expectedContributionCents: selected.economics.expectedContributionCents,
    expectedMarginBps: selected.economics.expectedMarginBps,
    market,
    selected,
    evaluations,
  };
}
