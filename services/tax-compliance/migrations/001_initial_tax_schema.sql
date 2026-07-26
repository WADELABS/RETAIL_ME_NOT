-- Migration: 001_initial_tax_schema.sql
-- Description: Establishes schemas for multi-state tax jurisdictions, the tax liability ledger, and economic nexus tracking.

BEGIN;

-- 1. State Registration Registry
CREATE TABLE IF NOT EXISTS tax_jurisdictions (
  state_code TEXT PRIMARY KEY CHECK (length(state_code) = 2), -- e.g., 'LA', 'TX'
  registered BOOLEAN NOT NULL DEFAULT false,
  permit_number TEXT,
  filing_frequency TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (filing_frequency IN ('MONTHLY', 'QUARTERLY', 'ANNUALLY')),
  due_day_of_month INT NOT NULL DEFAULT 20 CHECK (due_day_of_month BETWEEN 1 AND 31),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tax Liability Ledger
CREATE TABLE IF NOT EXISTS tax_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL, -- Links back to the ECOS retail sales order
  jurisdiction_state TEXT NOT NULL CHECK (length(jurisdiction_state) = 2),
  total_tax_cents BIGINT NOT NULL CHECK (total_tax_cents >= 0),
  status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'RESERVED', 'FILED', 'PAID', 'RECONCILED')),
  provider_transaction_id TEXT, -- Doc reference ID from Avalara/TaxJar
  raw_tax_lines JSONB NOT NULL, -- Detailed breakdown of state, local, and special tax lines
  remitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tax_transactions_order_idx ON tax_transactions (order_id);
CREATE INDEX IF NOT EXISTS tax_transactions_status_idx ON tax_transactions (status);

-- 3. Economic Nexus Tracking Engine
CREATE TABLE IF NOT EXISTS economic_nexus_profiles (
  nexus_profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code TEXT NOT NULL UNIQUE CHECK (length(state_code) = 2),
  cumulative_sales_cents BIGINT NOT NULL DEFAULT 0 CHECK (cumulative_sales_cents >= 0),
  cumulative_transaction_count INT NOT NULL DEFAULT 0 CHECK (cumulative_transaction_count >= 0),
  nexus_status TEXT NOT NULL DEFAULT 'INACTIVE' CHECK (nexus_status IN ('INACTIVE', 'MONITORING', 'ACTIVE')),
  registration_required BOOLEAN NOT NULL DEFAULT false,
  threshold_revenue_cents BIGINT NOT NULL DEFAULT 10000000 CHECK (threshold_revenue_cents >= 0), -- e.g., default $100,000 (10,000,000 cents)
  threshold_transaction_count INT NOT NULL DEFAULT 200 CHECK (threshold_transaction_count >= 0),   -- e.g., default 200 transactions
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS economic_nexus_profiles_status_idx ON economic_nexus_profiles (nexus_status);

COMMIT;
