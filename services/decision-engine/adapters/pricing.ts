// Adapters are responsible for normalizing the data from domain-specific
// events into a standardized format that the Decision Engine's rules can use.

export function adaptPricingEvent(event) {
  return {
    expectedMarginBps: event.payload.expected_margin_bps,
    recommendedPriceCents: event.payload.recommended_price_cents,
    // ... other normalized fields
  };
}
