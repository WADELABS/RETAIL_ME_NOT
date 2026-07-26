-- Migration: 001_initial_risk_schema.sql
-- Description: Creates schemas for tracking transaction-level risk assessments, customer trust profiles, and dispute evidence.

BEGIN;

-- 1. Real-time Risk Assessments (Individual transaction checks)
CREATE TABLE IF NOT EXISTS risk_assessments (
  assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  risk_score INT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  recommendation TEXT NOT NULL CHECK (recommendation IN ('ALLOW', 'MANUAL_REVIEW', 'DECLINE')),
  evaluated_metrics JSONB NOT NULL,
  triggered_rules TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS risk_assessments_order_idx ON risk_assessments (order_id);
CREATE INDEX IF NOT EXISTS risk_assessments_recommendation_idx ON risk_assessments (recommendation);


-- 2. Rolling Customer Trust Profiles (Long-term customer trust scoring)
CREATE TABLE IF NOT EXISTS customer_trust_profiles (
  trust_profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE,
  trust_score INT NOT NULL DEFAULT 500 CHECK (trust_score BETWEEN 0 AND 1000), -- Base score starts at 500
  successful_orders_count INT NOT NULL DEFAULT 0 CHECK (successful_orders_count >= 0),
  chargebacks_count INT NOT NULL DEFAULT 0 CHECK (chargebacks_count >= 0),
  returns_count INT NOT NULL DEFAULT 0 CHECK (returns_count >= 0),
  status TEXT NOT NULL DEFAULT 'NEUTRAL' CHECK (status IN ('BLACKLISTED', 'SUSPICIOUS', 'NEUTRAL', 'TRUSTED')),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_trust_status_idx ON customer_trust_profiles (status);


-- 3. Dispute Evidence Vault (Chargeback Defense Logs)
-- Stores structured evidence compiled automatically to respond and win Stripe disputes.
CREATE TABLE IF NOT EXISTS dispute_evidence_vault (
  evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id TEXT NOT NULL UNIQUE CHECK (dispute_id LIKE 'dp_%'),
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEEDS_RESPONSE',
  compiled_evidence JSONB NOT NULL, -- Full compiled data (IP, Fingerprint, tracking, AVS/CVV)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispute_vault_order_idx ON dispute_evidence_vault (order_id);

COMMIT;
