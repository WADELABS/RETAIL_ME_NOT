"use strict";
// Placeholder for fraud-related business rules.
// Example: "Send to manual review if risk score is above 75"
Object.defineProperty(exports, "__esModule", { value: true });
exports.fraudRules = void 0;
exports.fraudRules = [
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
//# sourceMappingURL=fraud.rules.js.map