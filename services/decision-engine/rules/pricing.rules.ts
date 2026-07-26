// Authoritative ECOS Pricing and Margin Protection Policies.
// Enforces that ECOS never fulfills orders that do not satisfy minimum net margin.

import { DecisionContext, DecisionResult } from './fraud.rules';

export const pricingRules = [
  {
    name: 'Hard Margin Protection Rule',
    // IF the expected net margin is below our 12% (1200 bps) threshold
    condition: (context: DecisionContext) => context.pricing !== undefined && context.pricing.expectedMarginBps < 1200,
    // THEN reject the order to protect cash flow
    consequence: (): DecisionResult => ({
      action: 'REJECT_ORDER',
      reason: 'EXPECTED_MARGIN_BELOW_MINIMUM_THRESHOLD',
      confidence: 0.99,
    }),
  }
];
