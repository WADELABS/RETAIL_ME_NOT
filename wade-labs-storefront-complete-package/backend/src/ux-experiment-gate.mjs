import { assertIntegerCents } from './money.mjs';

function safeRateBps(numerator, denominator) {
  if (denominator <= 0) return 0;
  return Math.floor((numerator * 10_000) / denominator);
}

export function evaluateUxExperiment({
  experimentId, control, variant, minimumSessionsPerArm = 1000,
  minimumContributionLiftBps = 200, maximumReturnRateIncreaseBps = 100,
  maximumSupportContactIncreaseBps = 100, maximumPerformanceRegressionMs = 150,
}) {
  for (const arm of [control, variant]) {
    for (const key of ['sessions','orders','returns','supportContacts','p95PageLoadMs']) {
      if (!Number.isSafeInteger(arm[key]) || arm[key] < 0) throw new TypeError(`${key} must be a non-negative safe integer`);
    }
    assertIntegerCents(arm.contributionCents, 'contributionCents');
  }
  const controlContributionPerSession = control.sessions > 0 ? Math.floor((control.contributionCents * 10_000) / control.sessions) : 0;
  const variantContributionPerSession = variant.sessions > 0 ? Math.floor((variant.contributionCents * 10_000) / variant.sessions) : 0;
  const contributionLiftBps = controlContributionPerSession > 0
    ? Math.floor(((variantContributionPerSession - controlContributionPerSession) * 10_000) / controlContributionPerSession)
    : 0;
  const returnRateIncreaseBps = safeRateBps(variant.returns, variant.orders) - safeRateBps(control.returns, control.orders);
  const supportContactIncreaseBps = safeRateBps(variant.supportContacts, variant.orders) - safeRateBps(control.supportContacts, control.orders);
  const performanceRegressionMs = variant.p95PageLoadMs - control.p95PageLoadMs;
  const mature = control.sessions >= minimumSessionsPerArm && variant.sessions >= minimumSessionsPerArm;
  const guardrailFailures = [];
  if (returnRateIncreaseBps > maximumReturnRateIncreaseBps) guardrailFailures.push('RETURN_RATE_REGRESSION');
  if (supportContactIncreaseBps > maximumSupportContactIncreaseBps) guardrailFailures.push('SUPPORT_CONTACT_REGRESSION');
  if (performanceRegressionMs > maximumPerformanceRegressionMs) guardrailFailures.push('PERFORMANCE_REGRESSION');
  let decision = 'CONTINUE';
  if (guardrailFailures.length > 0) decision = 'STOP_VARIANT';
  else if (mature && contributionLiftBps >= minimumContributionLiftBps) decision = 'PROMOTE_VARIANT';
  else if (mature && contributionLiftBps <= -minimumContributionLiftBps) decision = 'REJECT_VARIANT';
  return {
    experimentId, decision, mature, controlContributionPerSession,
    variantContributionPerSession, contributionLiftBps, returnRateIncreaseBps,
    supportContactIncreaseBps, performanceRegressionMs, guardrailFailures,
  };
}
