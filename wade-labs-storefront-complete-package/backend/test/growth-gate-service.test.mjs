import test from 'node:test';
import assert from 'node:assert';
import { createGrowthGateService } from '../src/growth-gate-service.mjs';

test('growth gate service', async (t) => {
  await t.test('it should return default metrics when no snapshot is found', async () => {
    // Arrange
    const mockDb = {
        'growth_gate_snapshots': []
    };
    const knex = (table) => ({
      orderBy: () => ({
        first: () => Promise.resolve(mockDb[table][0] || null),
      }),
      insert: (data) => {
        mockDb[table].push(data);
        return Promise.resolve();
      }
    });


    const growthGateService = createGrowthGateService(knex);

    // Act
    const metrics = await growthGateService.getLatestMetrics();

    // Assert
    assert.deepStrictEqual(metrics, {
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
    });
  });

  await t.test('it should return metrics from the latest snapshot', async () => {
    // Arrange
    const snapshot = {
      trailing_contribution_cents: '100000',
      after_marketing_margin_bps: 300,
      fulfillment_on_time_bps: 9500,
      cancellation_rate_bps: 500,
      return_rate_bps: 800,
      chargeback_rate_bps: 100,
      support_backlog: 25,
      p95_page_load_ms: 2500,
      inventory_freshness_bps: 9800,
      cash_coverage_days: 14,
      current_weekly_revenue_cents: '10000',
    };
     const mockDb = {
        'growth_gate_snapshots': [snapshot]
    };
    const knex = (table) => ({
      orderBy: () => ({
        first: () => Promise.resolve(mockDb[table][0] || null),
      }),
      insert: (data) => {
        mockDb[table].push(data);
        return Promise.resolve();
      }
    });
    const growthGateService = createGrowthGateService(knex);

    // Act
    const metrics = await growthGateService.getLatestMetrics();

    // Assert
    assert.deepStrictEqual(metrics, {
      trailingContributionCents: 100000n,
      afterMarketingMarginBps: 300,
      fulfillmentOnTimeBps: 9500,
      cancellationRateBps: 500,
      returnRateBps: 800,
      chargebackRateBps: 100,
      supportBacklog: 25,
      p95PageLoadMs: 2500,
      inventoryFreshnessBps: 9800,
      cashCoverageDays: 14,
      stableWeeks: 2,
      currentWeeklyRevenueCents: 10000n,
    });
  });

  await t.test('it should check growth readiness and save a snapshot', async () => {
    // Arrange
    const mockDb = {
        'growth_gate_snapshots': []
    };
    const knex = (table) => ({
      orderBy: () => ({
        first: () => Promise.resolve(mockDb[table][0] || null),
      }),
      insert: (data) => {
        mockDb[table].push(data);
        return Promise.resolve();
      }
    });

    const growthGateService = createGrowthGateService(knex);

    // Act
    const result = await growthGateService.checkGrowthReadiness();

    // Assert
    assert.strictEqual(result.decision, 'FREEZE_AND_REPAIR');
    assert.strictEqual(mockDb['growth_gate_snapshots'].length, 1);
  });
});
