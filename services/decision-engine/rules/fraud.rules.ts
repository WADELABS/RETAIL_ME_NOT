// Placeholder for fraud-related business rules.
// Example: "Send to manual review if risk score is above 75"

export const fraudRules = [
  {
    name: 'High Risk Score Rule',
    condition: (context) => context.risk.score > 75,
    consequence: {
      decision: 'MANUAL_REVIEW',
      reason: 'HIGH_RISK_SCORE',
      confidence: 0.90
    }
  }
];
