-- Migration: 002_add_infrastructure_expense_account.sql
-- Description: Adds a dedicated Expense account for tracking cloud infrastructure billing costs.

BEGIN;

INSERT INTO accounts (account_number, name, type) VALUES
  ('5020', 'Cloud Infrastructure Expense', 'EXPENSE')
ON CONFLICT DO NOTHING;

COMMIT;
