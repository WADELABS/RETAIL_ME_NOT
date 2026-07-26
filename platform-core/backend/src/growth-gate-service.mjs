import { evaluateGrowthReadiness } from './growth-gate.mjs';

export function createGrowthGateService(knex) {
  if (!knex) {
    throw new Error('knex instance is required');
  }

  async function getLatestMetrics() {
    // This is a simplified example. A real implementation would
    // aggregate data from multiple tables to build the snapshot.
    const latestSnapshot = await knex('growth_gate_snapshots')
      .orderBy('period_end', 'desc')
      .first();

    if (latestSnapshot) {
      return {
        trailingContributionCents: BigInt(latestSnapshot.trailing_contribution_cents),
        afterMarketingMarginBps: latestSnapshot.after_marketing_margin_bps,
        fulfillmentOnTimeBps: latestSnapshot.fulfillment_on_time_bps,
        cancellationRateBps: latestSnapshot.cancellation_rate_bps,
        returnRateBps: latestSnapshot.return_rate_bps,
        chargebackRateBps: latestSnapshot.chargeback_rate_bps,
        supportBacklog: latestSnapshot.support_backlog,
        p95PageLoadMs: latestSnapshot.p95_page_load_ms,
        inventoryFreshnessBps: latestSnapshot.inventory_freshness_bps,
        cashCoverageDays: latestSnapshot.cash_coverage_days,
        stableWeeks: 2, // This should be calculated
        currentWeeklyRevenueCents: BigInt(latestSnapshot.current_weekly_revenue_cents),
      };
    }

    // Return default values if no snapshot is found
    return {
      trailingContributionCents: 0n,
      afterMarketingMarginBps: 0,
      fulfillmentOnTimeBps: 0,
      cancellationRateBps: 0,
      returnRateBps: 0,
      chargebackRateBps: 0,
      supportBacklog: 0,
      p95PageLoadMs: 0,
      inventoryFreshnessBps: 0,
      cashCoverageDays: 0,
      stableWeeks: 0,
      currentWeeklyRevenueCents: 0n,
    };
  }

  async function checkGrowthReadiness(policy = {}) {
    const metrics = await getLatestMetrics();
    const result = evaluateGrowthReadiness({ ...metrics, policy });

    await knex('growth_gate_snapshots').insert({
      period_start: new Date(), // This should be the start of the period
      period_end: new Date(),
      decision: result.decision,
      trailing_contribution_cents: String(metrics.trailingContributionCents),
      after_marketing_margin_bps: metrics.afterMarketingMarginBps,
      fulfillment_on_time_bps: metrics.fulfillmentOnTimeBps,
      cancellation_rate_bps: metrics.cancellationRateBps,
      return_rate_bps: metrics.returnRateBps,
      chargeback_rate_bps: metrics.chargebackRateBps,
      support_backlog: metrics.supportBacklog,
      p95_page_load_ms: metrics.p95PageLoadMs,
      inventory_freshness_bps: metrics.inventoryFreshnessBps,
      cash_coverage_days: metrics.cashCoverageDays,
      current_weekly_revenue_cents: String(metrics.currentWeeklyRevenueCents),
      maximum_next_weekly_revenue_cents: String(result.maximumNextWeeklyRevenueCents),
      blocker_codes: result.blockers,
      warning_codes: result.warnings,
    });

    return result;
  }

  return {
    getLatestMetrics,
    checkGrowthReadiness,
  };
}
