import knex from 'knex';
import knexConfig from '../knexfile.mjs';
import { createGrowthGateService } from '../src/growth-gate-service.mjs';

const environment = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[environment]);

async function setupDatabase() {
  const hasTable = await db.schema.hasTable('growth_gate_snapshots');
  if (!hasTable) {
    console.log('Creating growth_gate_snapshots table...');
    await db.schema.createTable('growth_gate_snapshots', (table) => {
      table.uuid('id').primary().defaultTo(db.fn.uuid());
      table.date('period_start').notNullable();
      table.date('period_end').notNullable();
      table.text('decision').notNullable().checkIn(['HOLD', 'EXPAND_MODESTLY', 'FREEZE_AND_REPAIR']);
      table.bigint('trailing_contribution_cents').notNullable();
      table.integer('after_marketing_margin_bps').notNullable();
      table.integer('fulfillment_on_time_bps').notNullable();
      table.integer('cancellation_rate_bps').notNullable();
      table.integer('return_rate_bps').notNullable();
      table.integer('chargeback_rate_bps').notNullable();
      table.integer('support_backlog').notNullable();
      table.integer('p95_page_load_ms').notNullable();
      table.integer('inventory_freshness_bps').notNullable();
      table.integer('cash_coverage_days').notNullable();
      table.bigint('current_weekly_revenue_cents').notNullable();
      table.bigint('maximum_next_weekly_revenue_cents').notNullable();
      table.specificType('blocker_codes', 'text[]').notNullable().defaultTo('{}');
      table.specificType('warning_codes', 'text[]').notNullable().defaultTo('{}');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(db.fn.now());
    });
    console.log('Table growth_gate_snapshots created.');
  }
}

async function main() {
  try {
    await setupDatabase();

    const growthGateService = createGrowthGateService(db);

    console.log('Checking growth readiness...');
    const result = await growthGateService.checkGrowthReadiness();
    console.log('Growth readiness check result:', result);

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    console.log('Closing database connection.');
    await db.destroy();
  }
}

main();
