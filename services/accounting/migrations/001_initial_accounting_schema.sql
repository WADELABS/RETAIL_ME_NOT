-- Migration: 001_initial_accounting_schema.sql
-- Description: Establishes the core double-entry accounting ledger tables (General Ledger, Journal, Accounts).

BEGIN;

-- 1. Chart of Accounts (COA)
CREATE TABLE IF NOT EXISTS accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT NOT NULL UNIQUE, -- e.g., '1010' for Operating Cash, '2010' for AP
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  balance_cents BIGINT NOT NULL DEFAULT 0, -- Current aggregated balance
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Journal Entries (Master Record)
CREATE TABLE IF NOT EXISTS journal_entries (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type TEXT NOT NULL, -- e.g., 'SALES_ORDER', 'PURCHASE_ORDER', 'TAX_RESERVE_TRANSFER'
  reference_id UUID NOT NULL,   -- Triggering entity ID
  description TEXT,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_entries_reference_idx ON journal_entries (reference_type, reference_id);

-- 3. Journal Lines (Individual Double-Entry Lines)
CREATE TABLE IF NOT EXISTS journal_lines (
  line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES journal_entries(entry_id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(account_id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_lines_entry_idx ON journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_account_idx ON journal_lines (account_id);

-- 4. Initial Seed of Standard Chart of Accounts
INSERT INTO accounts (account_number, name, type) VALUES
  ('1010', 'Operating Cash (Mercury)', 'ASSET'),
  ('1020', 'Tax Reserve Account', 'ASSET'),
  ('2010', 'Sales Tax Liability', 'LIABILITY'),
  ('2020', 'Accounts Payable (Distributors)', 'LIABILITY'),
  ('4010', 'Sales Revenue', 'REVENUE'),
  ('5010', 'Cost of Goods Sold (COGS)', 'EXPENSE')
ON CONFLICT DO NOTHING;

COMMIT;
