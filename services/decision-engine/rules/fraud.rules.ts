// Authoritative ECOS Fraud Rejection Policies.
// Enforces how the Decision Engine reacts to risk scores and fraud recommendations.

export interface DecisionContext {
  risk: {
    riskScore: number;
    recommendation: 'ALLOW' | 'MANUAL_REVIEW' | 'DECLINE';
    triggeredRules: string[];
  };
  pricing?: {
    expectedMarginBps: number;
  };
  inventory?: {
    stockLevel: number;
  };
}

export interface DecisionResult {
  action: 'ALLOW' | 'HOLD_FOR_REVIEW' | 'REJECT_ORDER';
  reason: string;
  confidence: number;
}

export const fraudRules = [
  {
    name: 'Hard Fraud Decline Rule',
    // IF the Risk service recommends DECLINE (Score >= 75)
    condition: (context: DecisionContext) => context.risk.recommendation === 'DECLINE',
    // THEN reject the order instantly with a confidence of 1.0
    consequence: (): DecisionResult => ({
      action: 'REJECT_ORDER',
      reason: 'CRITICAL_FRAUD_RISK_DETECTED',
      confidence: 1.0,
    }),
  },
  {
    name: 'Suspicious Activity Hold Rule',
    // IF the Risk service recommends MANUAL_REVIEW (Score 50-74)
    condition: (context: DecisionContext) => context.risk.recommendation === 'MANUAL_REVIEW',
    // THEN place a temporary hold for administrator audit
    consequence: (): DecisionResult => ({
      action: 'HOLD_FOR_REVIEW',
      reason: 'SUSPICIOUS_TRANSACTION_ACTIVITY_HOLD',
      confidence: 0.90,
    }),
  }
];
