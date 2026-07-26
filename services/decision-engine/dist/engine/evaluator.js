"use strict";
// The Evaluator is the core of the rules engine.
// It takes a context (the combined data from all domains)
// and a set of rules, and returns the first consequential decision.
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluate = evaluate;
function evaluate(context, rules) {
    for (const rule of rules) {
        if (rule.condition(context)) {
            console.log(`[Decision Engine] Rule matched: ${rule.name}`);
            return rule.consequence;
        }
    }
    // Default decision if no rules match
    return {
        decision: 'ALLOW',
        reason: 'NO_NEGATIVE_SIGNALS',
        confidence: 0.95
    };
}
//# sourceMappingURL=evaluator.js.map