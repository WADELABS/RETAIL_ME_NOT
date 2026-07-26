-- Migration: 003_add_loyalty_and_affiliate_accounts.sql
-- Description: Adds General Ledger accounts for tracking ECOS Loyalty Point liabilities and Affiliate commission payables.

BEGIN;

INSERT INTO accounts (account_number, name, type) VALUES
  ('2040', 'Loyalty Points Liability', 'LIABILITY'),
  ('2050', 'Accounts Payable (Affiliates)', 'LIABILITY'),
  ('5050', 'Marketing & Affiliate Expense', 'EXPENSE')
ON CONFLICT DO NOTHING;

COMMIT;
