BEGIN;

CREATE TYPE listing_state AS ENUM (
  'ACTIVE_COMPETITIVE',
  'ACTIVE_AT_FLOOR',
  'ACTIVE_NO_MARKET_DATA',
  'ACTIVE_DECREASE_GUARDED',
  'SUPPRESSED_NO_VIABLE_SOURCE',
  'SUPPRESSED_LOW_MARGIN',
  'SUPPRESSED_OUT_OF_STOCK',
  'SUPPRESSED_STALE_OFFER',
  'SUPPRESSED_MAP_MARKET_CONFLICT',
  'SUPPRESSED_NO_MARKET_DATA'
);

CREATE TYPE fulfillment_execution_mode AS ENUM ('MANUAL', 'CAPITAL_GATED_AUTO');
CREATE TYPE capital_reservation_status AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');
CREATE TYPE capital_gate_state AS ENUM (
  'PAYMENT_NOT_CLEARED',
  'AWAITING_PAYMENT_CLEARANCE',
  'ACH_RETURN_RISK_HOLD',
  'PAYMENT_RECONCILIATION_HOLD',
  'FULFILLMENT_HOLD',
  'AWAITING_AVAILABLE_CAPITAL',
  'READY_FOR_INTERNAL_FULFILLMENT',
  'READY_FOR_SUPPLIER_ORDER',
  'CAPITAL_RESERVATION_SHORTFALL'
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS manufacturer_part_number text,
  ADD COLUMN IF NOT EXISTS current_retail_price_cents bigint CHECK (current_retail_price_cents >= 0),
  ADD COLUMN IF NOT EXISTS listing_state listing_state NOT NULL DEFAULT 'SUPPRESSED_NO_VIABLE_SOURCE',
  ADD COLUMN IF NOT EXISTS selected_supplier_offer_id uuid,
  ADD COLUMN IF NOT EXISTS pricing_decision_at timestamptz;

CREATE TABLE IF NOT EXISTS supplier_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_key text NOT NULL,
  external_offer_id text NOT NULL,
  wholesale_cost_cents bigint NOT NULL CHECK (wholesale_cost_cents >= 0),
  fulfillment_cost_cents bigint NOT NULL DEFAULT 0 CHECK (fulfillment_cost_cents >= 0),
  drop_ship_fee_cents bigint NOT NULL DEFAULT 0 CHECK (drop_ship_fee_cents >= 0),
  packaging_cost_cents bigint NOT NULL DEFAULT 0 CHECK (packaging_cost_cents >= 0),
  shipping_subsidy_cents bigint NOT NULL DEFAULT 0 CHECK (shipping_subsidy_cents >= 0),
  supplier_tax_cents bigint NOT NULL DEFAULT 0 CHECK (supplier_tax_cents >= 0),
  map_cents bigint CHECK (map_cents >= 0),
  available_quantity integer NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  reliability_bps integer NOT NULL DEFAULT 8000 CHECK (reliability_bps BETWEEN 0 AND 9999),
  estimated_delivery_days integer CHECK (estimated_delivery_days >= 0),
  checked_at timestamptz NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (supplier_key, external_offer_id)
);

CREATE TABLE IF NOT EXISTS competitor_price_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  competitor_key text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('AUTHORIZED_API', 'AUTHORIZED_FEED', 'MANUAL_IMPORT', 'LICENSED_DATA')),
  observed_price_cents bigint NOT NULL CHECK (observed_price_cents >= 0),
  shipping_cents bigint NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  public_discount_cents bigint NOT NULL DEFAULT 0 CHECK (public_discount_cents >= 0),
  landed_price_cents bigint NOT NULL CHECK (landed_price_cents >= 0),
  trust_bps integer NOT NULL CHECK (trust_bps BETWEEN 0 AND 9999),
  in_stock boolean NOT NULL,
  comparable boolean NOT NULL,
  condition text NOT NULL,
  observed_at timestamptz NOT NULL,
  evidence_ref text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS competitor_price_observations_product_time_idx
  ON competitor_price_observations (product_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS pricing_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('GLOBAL', 'CATEGORY', 'BRAND', 'PRODUCT')),
  scope_id uuid,
  target_margin_bps integer NOT NULL CHECK (target_margin_bps BETWEEN 0 AND 9999),
  minimum_contribution_cents bigint NOT NULL CHECK (minimum_contribution_cents >= 0),
  processing_fee_bps integer NOT NULL CHECK (processing_fee_bps BETWEEN 0 AND 9999),
  processing_flat_fee_cents bigint NOT NULL CHECK (processing_flat_fee_cents >= 0),
  return_reserve_bps integer NOT NULL DEFAULT 0 CHECK (return_reserve_bps BETWEEN 0 AND 9999),
  fraud_reserve_bps integer NOT NULL DEFAULT 0 CHECK (fraud_reserve_bps BETWEEN 0 AND 9999),
  warranty_reserve_bps integer NOT NULL DEFAULT 0 CHECK (warranty_reserve_bps BETWEEN 0 AND 9999),
  undercut_cents bigint NOT NULL DEFAULT 0 CHECK (undercut_cents >= 0),
  premium_tolerance_bps integer NOT NULL DEFAULT 0 CHECK (premium_tolerance_bps BETWEEN 0 AND 9999),
  competitor_freshness_seconds integer NOT NULL CHECK (competitor_freshness_seconds > 0),
  offer_freshness_seconds integer NOT NULL CHECK (offer_freshness_seconds > 0),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pricing_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  selected_supplier_offer_id uuid REFERENCES supplier_offers(id),
  policy_id uuid REFERENCES pricing_policies(id),
  state listing_state NOT NULL,
  prior_price_cents bigint CHECK (prior_price_cents >= 0),
  optimized_price_cents bigint CHECK (optimized_price_cents >= 0),
  minimum_viable_price_cents bigint CHECK (minimum_viable_price_cents >= 0),
  market_position_cents bigint CHECK (market_position_cents >= 0),
  expected_contribution_cents bigint,
  expected_margin_bps integer,
  reason_codes text[] NOT NULL DEFAULT '{}',
  inputs_hash text NOT NULL,
  decision_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warehouse_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_offer_id uuid NOT NULL REFERENCES supplier_offers(id) ON DELETE CASCADE,
  external_warehouse_id text NOT NULL,
  region text NOT NULL,
  available_quantity integer NOT NULL CHECK (available_quantity >= 0),
  shipping_cost_cents bigint NOT NULL DEFAULT 0 CHECK (shipping_cost_cents >= 0),
  estimated_delivery_days integer CHECK (estimated_delivery_days >= 0),
  reliability_bps integer NOT NULL DEFAULT 8000 CHECK (reliability_bps BETWEEN 0 AND 9999),
  battery_eligible boolean,
  air_eligible boolean,
  checked_at timestamptz NOT NULL,
  UNIQUE (supplier_offer_id, external_warehouse_id)
);

CREATE TABLE IF NOT EXISTS capital_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('MERCURY', 'STRIPE', 'DISTRIBUTOR_CREDIT', 'MANUAL')),
  external_account_id text,
  available_cents bigint NOT NULL CHECK (available_cents >= 0),
  current_cents bigint CHECK (current_cents >= 0),
  in_flight_cents bigint CHECK (in_flight_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  observed_at timestamptz NOT NULL,
  evidence_ref text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS capital_reservations (
  id text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_intent_id text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  status capital_reservation_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  released_at timestamptz,
  UNIQUE (order_id),
  UNIQUE (payment_intent_id)
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_execution_mode fulfillment_execution_mode NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS capital_gate_state capital_gate_state NOT NULL DEFAULT 'PAYMENT_NOT_CLEARED',
  ADD COLUMN IF NOT EXISTS required_procurement_capital_cents bigint NOT NULL DEFAULT 0 CHECK (required_procurement_capital_cents >= 0),
  ADD COLUMN IF NOT EXISTS capital_reservation_id text REFERENCES capital_reservations(id),
  ADD COLUMN IF NOT EXISTS payment_method_type text,
  ADD COLUMN IF NOT EXISTS stripe_available_on timestamptz,
  ADD COLUMN IF NOT EXISTS ach_policy_hold_until timestamptz;

CREATE TABLE IF NOT EXISTS supplier_order_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_group_id uuid NOT NULL,
  supplier_key text NOT NULL,
  warehouse_id uuid REFERENCES warehouse_inventory(id),
  idempotency_key text NOT NULL UNIQUE,
  request_payload jsonb NOT NULL,
  response_payload jsonb,
  state text NOT NULL CHECK (state IN ('QUEUED', 'SUBMITTING', 'ACKNOWLEDGED', 'REJECTED', 'FAILED', 'UNKNOWN')),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
