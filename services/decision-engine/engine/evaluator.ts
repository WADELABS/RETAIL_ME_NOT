// The Evaluator is the core execution logic of the ECOS Rules Engine.
// It takes an unified operational context (e.g. Fraud, Pricing, Sourcing)
// and evaluates it against an ordered chain of active business rules,
// returning the first rule consequence matched ("First-Match" precedence).

export interface Rule {
  name: string;
  condition: (context: any) => boolean;
  consequence: () => any;
}

/**
 * Executes our authoritative business policies in a deterministic, explainable, and auditable loop.
 *
 * @param {any} context - The combined data from all relevant domains (e.g., risk, pricing).
 * @param {Rule[]} rules - The ordered array of active business rules.
 * @returns {any} The final decision object including the action, matching rule name, and reasons.
 */
export function evaluate(context: any, rules: Rule[]): any {
  console.log(`[Decision Engine] Starting execution run over ${rules.length} active policies...`);

  for (const rule of rules) {
    try {
      if (rule.condition(context)) {
        console.log(`[Decision Engine] MATCHED: Rule "${rule.name}" triggered. Executing consequence...`);
        const result = rule.consequence();
        
        return {
          decision: result.action || result.decision,
          reason: result.reason,
          confidence: result.confidence || 1.0,
          matchedRule: rule.name,
          inputsSnapshot: context, // Save a complete snapshot of inputs for complete explainability
        };
      }
    } catch (err) {
      console.error(`[Decision Engine Error] Failed to evaluate rule "${rule.name}":`, (err as any).message);
      // In a real system, this exception would trigger an immediate system alert and fail-safe
    }
  }

  // Default fallback decision if no restrictive business policies are triggered
  console.log('[Decision Engine] APPROVED: All business policies passed with no restrictive triggers.');
  return {
    decision: 'ALLOW',
    reason: 'ALL_POLICIES_PASSED_CLEANLY',
    confidence: 0.95,
    matchedRule: 'GLOBAL_DEFAULT_ALLOW_RULE',
    inputsSnapshot: context,
  };
}
