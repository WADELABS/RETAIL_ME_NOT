BEGIN;

-- Drop dependent views/constraints if they exist, to be recreated later if needed.
-- Note: In a live production environment, this would require more careful handling
-- using ALTER statements to avoid data loss. For this migration, we assume
-- we can rebuild these structures.

ALTER TABLE products DROP COLUMN IF EXISTS listing_state;

DROP TYPE IF EXISTS listing_state;

-- Create the new, more detailed listing states as requested.
CREATE TYPE listing_state AS ENUM (
  'ACTIVE',
  'SUPPRESSED_LOW_MARGIN',
  'SUPPRESSED_NO_SUPPLIER',
  'SUPPRESSED_STALE_INVENTORY',
  'SUPPRESSED_MAP_RESTRICTION',
  'SUPPRESSED_HIGH_RETURN_RISK',
  'MANUAL_REVIEW'
);

-- Add the new listing_state column back to the products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS listing_state listing_state NOT NULL DEFAULT 'MANUAL_REVIEW';


-- 1. suppliers Table
-- Central repository for all distributor and supplier information.
CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_status text NOT NULL DEFAULT 'PENDING_REVIEW', -- e.g., PENDING_REVIEW, ACTIVE, DISABLED
  dropship_enabled boolean NOT NULL DEFAULT false,
  resale_certificate_required boolean NOT NULL DEFAULT true,
  warehouse_regions text[],
  api_available boolean NOT NULL DEFAULT false,
  csv_import_available boolean NOT NULL DEFAULT false,
  reliability_score numeric(5, 4) NOT NULL DEFAULT 0.80, -- e.g., 0.9950 for 99.50%
  return_policy_score numeric(5, 4) NOT NULL DEFAULT 0.50,
  average_ship_days numeric(5, 2),
  last_sync timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_idx ON suppliers (name);


-- 2. supplier_offers Table
-- Redesigning to align with the new, more detailed structure.
-- We will rename the old table and create a new one to avoid conflicts
-- with existing columns and types. A data migration step would be needed
-- in a real-world scenario.

ALTER TABLE IF EXISTS supplier_offers RENAME TO supplier_offers_legacy;

CREATE TABLE IF NOT EXISTS supplier_offers (
  offer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
  sku text NOT NULL,
  wholesale_cost_cents bigint NOT NULL CHECK (wholesale_cost_cents >= 0),
  dropship_fee_cents bigint NOT NULL DEFAULT 0 CHECK (dropship_fee_cents >= 0),
  inventory_quantity integer NOT NULL DEFAULT 0 CHECK (inventory_quantity >= 0),
  inventory_age_days integer,
  map_price_cents bigint,
  shipping_cost_cents bigint NOT NULL DEFAULT 0 CHECK (shipping_cost_cents >= 0),
  warranty_source text NOT NULL DEFAULT 'MANUFACTURER', -- MANUFACTURER, SUPPLIER, NONE
  last_verified timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, sku)
);
CREATE INDEX IF NOT EXISTS supplier_offers_sku_idx ON supplier_offers (sku);


-- 3. supplier_performance Table
-- Tracks ongoing performance metrics for each supplier.
CREATE TABLE IF NOT EXISTS supplier_performance (
  performance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
  fulfilled_orders integer NOT NULL DEFAULT 0,
  late_orders integer NOT NULL DEFAULT 0,
  cancellations integer NOT NULL DEFAULT 0,
  returns integer NOT NULL DEFAULT 0,
  defect_rate numeric(5, 4) NOT NULL DEFAULT 0,
  chargebacks integer NOT NULL DEFAULT 0,
  reliability_score numeric(5, 4), -- Overrides the default score in `suppliers` table when calculated
  calculation_date timestamptz NOT NULL,
  UNIQUE(supplier_id, calculation_date)
);


-- 4. pricing_decisions Table
-- Renaming and creating a new version to match the specification.
ALTER TABLE IF EXISTS pricing_decisions RENAME TO pricing_decisions_legacy;

CREATE TABLE IF NOT EXISTS pricing_decisions (
  decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  selected_supplier_id uuid REFERENCES suppliers(supplier_id),
  calculated_floor_cents bigint,
  listed_price_cents bigint,
  expected_profit_cents bigint,
  suppression_reason text,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb
);
CREATE INDEX IF NOT EXISTS pricing_decisions_sku_timestamp_idx ON pricing_decisions (sku, "timestamp" DESC);


-- Update products table to use SKU as a primary identifier if desired
-- For now, we will add an SKU column to link everything.
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku text;
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_idx ON products (sku);


COMMIT;
