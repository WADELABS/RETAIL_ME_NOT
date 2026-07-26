// Authoritative ECOS Fulfillment Sourcing Safeguard Policies.
// Enforces that ECOS only routes orders to highly reliable fulfillment nodes.

export interface FulfillmentSourcingContext {
  providerId: string;
  reliabilityScore: number;
}

export interface SourcingDecision {
  action: 'PROCEED' | 'HOLD_FOR_AUDIT' | 'RE_ROUTE_PROVIDER';
  reason: string;
}

export const fulfillmentRules = [
  {
    name: 'Critical Provider Unreliability Rule',
    // IF the assigned provider's reliability falls below 85% (0.85)
    condition: (context: FulfillmentSourcingContext) => context.reliabilityScore < 0.85,
    // THEN block the routing and trigger a re-route command
    consequence: (): SourcingDecision => ({
      action: 'RE_ROUTE_PROVIDER',
      reason: 'PROVIDER_RELIABILITY_BELOW_SAFE_THRESHOLD',
    }),
  }
];
