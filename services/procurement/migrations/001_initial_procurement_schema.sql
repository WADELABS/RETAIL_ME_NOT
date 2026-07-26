-- Migration: 001_initial_procurement_schema.sql
-- Description: Creates tables to track internal B2B purchase orders issued to fulfillment providers.

BEGIN;

CREATE TABLE IF NOT EXISTS purchase_orders (
  purchase_order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL, -- Links back to the ECOS retail order
  provider_id TEXT NOT NULL, -- The fulfillment provider (e.g., 'DISTRIBUTOR_A')
  status TEXT NOT NULL DEFAULT 'CREATED', -- CREATED, SENT, ACCEPTED, COMPLETED, REJECTED
  total_wholesale_cost_cents BIGINT NOT NULL CHECK (total_wholesale_cost_cents >= 0),
  provider_reference_id TEXT, -- Reference ID provided by the distributor (if accepted)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchase_orders_order_idx ON purchase_orders (order_id);
CREATE INDEX IF NOT EXISTS purchase_orders_provider_idx ON purchase_orders (provider_id);


CREATE TABLE IF NOT EXISTS purchase_order_items (
  po_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(purchase_order_id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  wholesale_cost_cents BIGINT NOT NULL CHECK (wholesale_cost_cents >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


COMMIT;
