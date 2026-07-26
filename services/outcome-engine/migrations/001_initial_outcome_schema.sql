-- Migration: 001_initial_outcome_schema.sql
-- Description: Establishes schemas for tracking actual operational outcomes and calculating performance variance.

BEGIN;

-- 1. Decision Outcomes (Master Record)
CREATE TABLE IF NOT EXISTS decision_outcomes (
  outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  provider_id TEXT NOT NULL,
  decision_id UUID NOT NULL, -- Links to Decision Engine audit log

  -- Performance Variance Metrics
  predicted_delivery_days INT NOT NULL CHECK (predicted_delivery_days > 0),
  actual_delivery_days INT NOT NULL CHECK (actual_delivery_days > 0),
  delivery_days_variance INT NOT NULL, -- (actual - predicted). Positive is late, negative is early

  predicted_wholesale_cost_cents BIGINT NOT NULL CHECK (predicted_wholesale_cost_cents > 0),
  actual_wholesale_cost_cents BIGINT NOT NULL CHECK (actual_wholesale_cost_cents > 0),
  cost_variance_cents BIGINT NOT NULL, -- (actual - predicted). Positive is distributor overcharge

  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'LATE', 'OVERCHARGED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decision_outcomes_order_idx ON decision_outcomes (order_id);
CREATE INDEX IF NOT EXISTS decision_outcomes_provider_idx ON decision_outcomes (provider_id);


-- 2. Supplier Reputation Ledger
-- A time-series table tracking individual operational violations/achievements for score adjustments.
CREATE TABLE IF NOT EXISTS supplier_reputation_ledger (
  ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL,
  outcome_id UUID NOT NULL REFERENCES decision_outcomes(outcome_id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL CHECK (violation_type IN ('LATE_DELIVERY', 'PRICE_OVERCHARGE', 'UNAUTHORIZED_CANCELLATION', 'EXEMPLARY_DELIVERY')),
  reliability_adjustment_bps INT NOT NULL, -- e.g., -500 (reduction of 5% in reliability) or +100
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_reputation_ledger_provider_idx ON supplier_reputation_ledger (provider_id);


COMMIT;
