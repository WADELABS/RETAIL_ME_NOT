BEGIN;

DO $$ BEGIN
  CREATE TYPE marketing_channel AS ENUM (
    'ORGANIC_SEARCH','PAID_SEARCH','SHOPPING','SOCIAL_ORGANIC','SOCIAL_PAID',
    'EMAIL','SMS','AFFILIATE','REFERRAL','DIRECT','CONTENT','DISPLAY','VIDEO','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_decision AS ENUM (
    'EXPLORATION','HOLD_AND_COLLECT_DATA','SCALE_MODESTLY','PAUSE_OR_REDUCE','ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_campaign_id text,
  name text NOT NULL,
  channel marketing_channel NOT NULL,
  objective text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','PAUSED','ENDED','ARCHIVED')),
  daily_budget_cents bigint NOT NULL DEFAULT 0 CHECK (daily_budget_cents >= 0),
  maximum_cac_cents bigint CHECK (maximum_cac_cents >= 0),
  target_category_ids uuid[] NOT NULL DEFAULT '{}',
  target_product_ids uuid[] NOT NULL DEFAULT '{}',
  attribution_model text NOT NULL DEFAULT 'BLENDED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  spend_cents bigint NOT NULL DEFAULT 0 CHECK (spend_cents >= 0),
  impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  sessions bigint NOT NULL DEFAULT 0 CHECK (sessions >= 0),
  orders bigint NOT NULL DEFAULT 0 CHECK (orders >= 0),
  new_customers bigint NOT NULL DEFAULT 0 CHECK (new_customers >= 0),
  attributed_net_sales_cents bigint NOT NULL DEFAULT 0,
  contribution_before_marketing_cents bigint NOT NULL DEFAULT 0,
  refunds_cents bigint NOT NULL DEFAULT 0,
  cancellations bigint NOT NULL DEFAULT 0,
  chargebacks bigint NOT NULL DEFAULT 0,
  attribution_confidence_bps integer NOT NULL DEFAULT 0 CHECK (attribution_confidence_bps BETWEEN 0 AND 9999),
  UNIQUE (campaign_id, metric_date)
);

CREATE TABLE IF NOT EXISTS marketing_profit_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  policy_version text NOT NULL,
  decision campaign_decision NOT NULL,
  after_marketing_contribution_cents bigint NOT NULL,
  after_marketing_margin_bps integer NOT NULL,
  cac_cents bigint NOT NULL,
  allowable_cac_cents bigint NOT NULL,
  recommended_daily_budget_cents bigint NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  hard_stop_codes text[] NOT NULL DEFAULT '{}',
  input_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_acquisition_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_month date NOT NULL,
  channel marketing_channel NOT NULL,
  campaign_id uuid REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  customers bigint NOT NULL DEFAULT 0 CHECK (customers >= 0),
  acquisition_spend_cents bigint NOT NULL DEFAULT 0 CHECK (acquisition_spend_cents >= 0),
  first_order_contribution_cents bigint NOT NULL DEFAULT 0,
  day_30_contribution_cents bigint NOT NULL DEFAULT 0,
  day_60_contribution_cents bigint NOT NULL DEFAULT 0,
  day_90_contribution_cents bigint NOT NULL DEFAULT 0,
  refund_cents bigint NOT NULL DEFAULT 0,
  chargeback_cents bigint NOT NULL DEFAULT 0,
  UNIQUE (cohort_month, channel, campaign_id)
);

CREATE TABLE IF NOT EXISTS lifecycle_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  eligibility_rule jsonb NOT NULL,
  suppression_rule jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lifecycle_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id uuid NOT NULL REFERENCES lifecycle_segments(id) ON DELETE CASCADE,
  channel marketing_channel NOT NULL,
  template_key text NOT NULL,
  purpose text NOT NULL,
  frequency_cap jsonb NOT NULL,
  consent_required boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ux_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  hypothesis text NOT NULL,
  primary_metric text NOT NULL DEFAULT 'CONTRIBUTION_PER_SESSION',
  status text NOT NULL CHECK (status IN ('DRAFT','RUNNING','STOPPED','WON','LOST','ARCHIVED')),
  minimum_sessions_per_arm bigint NOT NULL DEFAULT 1000,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ux_experiment_arm_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES ux_experiments(id) ON DELETE CASCADE,
  arm_key text NOT NULL,
  sessions bigint NOT NULL DEFAULT 0,
  orders bigint NOT NULL DEFAULT 0,
  contribution_cents bigint NOT NULL DEFAULT 0,
  returns bigint NOT NULL DEFAULT 0,
  support_contacts bigint NOT NULL DEFAULT 0,
  p95_page_load_ms integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, arm_key)
);

CREATE TABLE IF NOT EXISTS growth_gate_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  decision text NOT NULL CHECK (decision IN ('HOLD','EXPAND_MODESTLY','FREEZE_AND_REPAIR')),
  trailing_contribution_cents bigint NOT NULL,
  after_marketing_margin_bps integer NOT NULL,
  fulfillment_on_time_bps integer NOT NULL,
  cancellation_rate_bps integer NOT NULL,
  return_rate_bps integer NOT NULL,
  chargeback_rate_bps integer NOT NULL,
  support_backlog integer NOT NULL,
  p95_page_load_ms integer NOT NULL,
  inventory_freshness_bps integer NOT NULL,
  cash_coverage_days integer NOT NULL,
  current_weekly_revenue_cents bigint NOT NULL,
  maximum_next_weekly_revenue_cents bigint NOT NULL,
  blocker_codes text[] NOT NULL DEFAULT '{}',
  warning_codes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_daily_metrics_campaign_date_idx ON marketing_daily_metrics (campaign_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS marketing_profit_decisions_campaign_time_idx ON marketing_profit_decisions (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS growth_gate_snapshots_period_idx ON growth_gate_snapshots (period_end DESC);

COMMIT;
