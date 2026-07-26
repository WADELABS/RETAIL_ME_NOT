// This service would be responsible for creating the immutable decision log
// entry after the rules engine has made a final decision.

export function logDecision(decision) {
  const logEntry = {
    decision: decision.decision,
    reason: decision.reason,
    inputs: decision.inputs, // A snapshot of all data that led to the decision
    confidence: decision.confidence,
    timestamp: new Date().toISOString(),
  };

  // In a real implementation, this would write to a durable, immutable store.
  console.log('DECISION_LOG:', JSON.stringify(logEntry));
  return logEntry;
}
