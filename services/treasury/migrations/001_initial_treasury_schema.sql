-- Migration: 001_initial_treasury_schema.sql
-- Description: Creates a ledger to track physical and logical bank transfers between operating and reserve accounts.

BEGIN;

CREATE TABLE IF NOT EXISTS treasury_transfers (
  transfer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account TEXT NOT NULL, -- e.g., 'OPERATING'
  destination_account TEXT NOT NULL, -- e.g., 'TAX_RESERVE'
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  reference_type TEXT NOT NULL, -- e.g., 'TAX_LIABILITY', 'VENDOR_PAYOUT'
  reference_id UUID NOT NULL,   -- The ID of the triggering entity (e.g., order_id, purchase_order_id)
  gateway_transaction_id TEXT, -- Reference ID from Mercury or other bank APIs
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS treasury_transfers_reference_idx ON treasury_transfers (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS treasury_transfers_status_idx ON treasury_transfers (status);

COMMIT;
