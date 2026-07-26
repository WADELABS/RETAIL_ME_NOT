-- Migration: 001_initial_risk_schema.sql
-- Description: Creates schemas for tracking transaction-level risk assessments and rolling customer trust profiles.

BEGIN;

-- 1. Real-time Risk Assessments (Individual transaction checks)
CREATE TABLE IF NOT EXISTS risk_assessments (
  assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL, -- Links back to the ECOS retail sales order
  customer_id UUID NOT NULL,
  risk_score INT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  recommendation TEXT NOT NULL CHECK (recommendation IN ('ALLOW', 'MANUAL_REVIEW', 'DECLINE')),
  evaluated_metrics JSONB NOT NULL, -- Stores raw metrics (AVS, CVV, Velocity, Device, IP)
  triggered_rules TEXT[] NOT NULL,  -- List of matched rule names (e.g., ['CVV_FAILURE', 'VPN_SPOOF'])
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


COMMIT;
