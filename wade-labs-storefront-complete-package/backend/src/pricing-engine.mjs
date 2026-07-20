import {
  applyBpsCeil,
  assertBps,
  assertIntegerCents,
  ceilDiv,
  roundUpToEnding,
  sumCents,
} from './money.mjs';

const DEFAULT_POLICY = Object.freeze({
  targetMarginBps: 600,
  minimumContributionCents: 2_500,
  processingFeeBps: 290,
  processingFlatFeeCents: 30,
  returnReserveBps: 150,
  fraudReserveBps: 75,
  warrantyReserveBps: 50,
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

export function calculateAllInCostCents(offer) {
  const fields = [
    offer.wholesaleCostCents,
    offer.fulfillmentCostCents ?? 0,
    offer.dropShipFeeCents ?? 0,
    offer.packagingCostCents ?? 0,
    offer.shippingSubsidyCents ?? 0,
    offer.supplierTaxCents ?? 0,
    offer.otherFixedCostCents ?? 0,
  ];
  return sumCents(fields, 'supplier offer cost');
}

export function calculateMinimumViablePrice(offer, policyInput = {}) {
  const policy = normalizePolicy(policyInput);
  const allInCostCents = calculateAllInCostCents(offer);

  // Processing is assessed on the customer charge, which normally includes sales tax.
  // This is an estimate for listing-time pricing; checkout recalculates exact tax and fees.
  const estimatedProcessingOnTaxBps = ceilDiv(
    policy.processingFeeBps * policy.estimatedTaxBps,
    10_000,
  );
  const nonMarginVariableBps =
    policy.processingFeeBps +
    estimatedProcessingOnTaxBps +
    policy.returnReserveBps +
    policy.fraudReserveBps +
    policy.warrantyReserveBps;

  if (nonMarginVariableBps + policy.targetMarginBps >= 10_000) {
    throw new RangeError('combined variable rates and target margin must be below 100%');
  }

  const baseNumeratorCents = allInCostCents + policy.processingFlatFeeCents;

  const marginFloorCents = ceilDiv(
    baseNumeratorCents * 10_000,
    10_000 - nonMarginVariableBps - policy.targetMarginBps,
  );

  const contributionFloorCents = ceilDiv(
    (baseNumeratorCents + policy.minimumContributionCents) * 10_000,
    10_000 - nonMarginVariableBps,
  );

  const minimumViablePriceCents = Math.max(marginFloorCents, contributionFloorCents);
  return {
    allInCostCents,
    nonMarginVariableBps,
    marginFloorCents,
    contributionFloorCents,
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

function supplierScore({ economics, offer, priceCents }) {
  const reliabilityBps = offer.reliabilityBps ?? 8_000;
  const stock = Math.min(100, offer.availableQuantity ?? 0);
  const etaPenalty = Math.max(0, offer.estimatedDeliveryDays ?? 7) * 100;
  const contributionComponent = Math.max(-100_000, Math.min(100_000, economics.expectedContributionCents));
  return contributionComponent + Math.floor(reliabilityBps / 5) + stock * 50 - etaPenalty - Math.floor(priceCents / 10_000);
}

function evaluateOffer({ offer, market, policy, currentPriceCents, now }) {
  assertIntegerCents(offer.availableQuantity ?? 0, 'offer availableQuantity');
  const offerCheckedAt = assertDate(offer.checkedAt, 'offer checkedAt');
  if (now - offerCheckedAt > policy.supplierOfferFreshnessMs || now < offerCheckedAt) {
    return { supplierId: offer.supplierId, status: 'SUPPRESSED_STALE_OFFER', viable: false };
  }
  if ((offer.availableQuantity ?? 0) <= 0) {
    return { supplierId: offer.supplierId, status: 'SUPPRESSED_OUT_OF_STOCK', viable: false };
  }

  const floor = calculateMinimumViablePrice(offer, policy);
  const mapCents = offer.mapCents ?? 0;
  const hardFloorCents = Math.max(floor.minimumViablePriceCents, mapCents);

  let desiredCents;
  let marketCeilingCents = null;
  let status;

  if (market.status === 'MARKET_DATA_READY') {
    desiredCents = Math.max(0, market.marketPositionCents - policy.undercutCents);
    marketCeilingCents = ceilDiv(
      market.medianCents * (10_000 + policy.premiumToleranceBps),
      10_000,
    );
    status = hardFloorCents <= desiredCents ? 'ACTIVE_COMPETITIVE' : 'ACTIVE_AT_FLOOR';
  } else {
    if (!policy.allowNoMarketData) {
      return { supplierId: offer.supplierId, status: 'SUPPRESSED_NO_MARKET_DATA', viable: false, floor };
    }
    desiredCents = ceilDiv(
      floor.allInCostCents * (10_000 + policy.standardMarkupBps),
      10_000,
    );
    status = 'ACTIVE_NO_MARKET_DATA';
  }

  let candidateCents = Math.max(hardFloorCents, desiredCents);
  if (offer.hardMaximumPriceCents != null) {
    assertIntegerCents(offer.hardMaximumPriceCents, 'hardMaximumPriceCents');
    if (candidateCents > offer.hardMaximumPriceCents) {
      return {
        supplierId: offer.supplierId,
        status: 'SUPPRESSED_HARD_PRICE_CEILING',
        viable: false,
        floor,
        candidateCents,
      };
    }
  }

  if (
    marketCeilingCents != null &&
    hardFloorCents > marketCeilingCents &&
    policy.suppressWhenAboveMarketCeiling
  ) {
    return {
      supplierId: offer.supplierId,
      status: mapCents > marketCeilingCents ? 'SUPPRESSED_MAP_MARKET_CONFLICT' : 'SUPPRESSED_LOW_MARGIN',
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
      supplierId: offer.supplierId,
      status: 'SUPPRESSED_RATE_LIMIT_ABOVE_MARKET',
      viable: false,
      floor,
      candidateCents,
      marketCeilingCents,
    };
  }

  const economics = estimateEconomics(candidateCents, offer, floor, policy);
  if (
    economics.expectedContributionCents < policy.minimumContributionCents ||
    economics.expectedMarginBps < policy.targetMarginBps
  ) {
    return {
      supplierId: offer.supplierId,
      status: 'SUPPRESSED_POST_ROUNDING_MARGIN_FAILURE',
      viable: false,
      floor,
      candidateCents,
      economics,
    };
  }

  return {
    supplierId: offer.supplierId,
    offerId: offer.offerId,
    status: decreaseGuard.constrained ? 'ACTIVE_DECREASE_GUARDED' : status,
    viable: true,
    publicPriceCents: candidateCents,
    hardFloorCents,
    marketCeilingCents,
    floor,
    economics,
    score: supplierScore({ economics, offer, priceCents: candidateCents }),
    source: {
      supplierId: offer.supplierId,
      offerId: offer.offerId,
      warehouseCount: offer.warehouseCount ?? null,
      availableQuantity: offer.availableQuantity,
      checkedAt: offer.checkedAt,
    },
  };
}

export function evaluateProductListing(input) {
  const policy = normalizePolicy(input.policy);
  const now = assertDate(input.now ?? new Date(), 'now');
  const market = buildMarketSnapshot(input.competitorObservations ?? [], policy, now);
  const evaluations = (input.supplierOffers ?? []).map((offer) => evaluateOffer({
    offer,
    market,
    policy,
    currentPriceCents: input.currentPriceCents,
    now,
  }));

  const viable = evaluations.filter((result) => result.viable);
  viable.sort((a, b) => b.score - a.score || a.publicPriceCents - b.publicPriceCents);
  const selected = viable[0] ?? null;

  if (!selected) {
    return {
      productId: input.productId,
      variantId: input.variantId,
      isListed: false,
      status: 'SUPPRESSED_NO_VIABLE_SOURCE',
      market,
      selected: null,
      evaluations,
    };
  }

  return {
    productId: input.productId,
    variantId: input.variantId,
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
