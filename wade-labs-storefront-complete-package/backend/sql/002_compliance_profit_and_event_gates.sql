BEGIN;

DO $$ BEGIN
  CREATE TYPE ldr_registration_status AS ENUM ('NOT_STARTED', 'SUBMITTED', 'PROCESSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE resale_certificate_status AS ENUM (
    'NOT_APPLIED', 'PENDING', 'APPROVED_ACTIVE', 'EXPIRING', 'EXPIRED', 'DENIED', 'REVOKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE webhook_provider AS ENUM ('STRIPE', 'MERCURY', 'DISTRIBUTOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE webhook_processing_state AS ENUM (
    'RECEIVED', 'QUEUED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED', 'DEAD_LETTER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS business_compliance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_business_name text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'LA',
  ldr_registration_status ldr_registration_status NOT NULL DEFAULT 'NOT_STARTED',
  ldr_tax_number_encrypted text,
  ldr_account_number_encrypted text,
  ldr_location_id_encrypted text,
  latap_username_encrypted text,
  resale_certificate_status resale_certificate_status NOT NULL DEFAULT 'NOT_APPLIED',
  resale_certificate_approval_date date,
  resale_certificate_expiration_date date,
  resale_certificate_document_ref text,
  tax_calculation_configured boolean NOT NULL DEFAULT false,
  customer_policies_published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    resale_certificate_status <> 'APPROVED_ACTIVE'
    OR (
      resale_certificate_approval_date IS NOT NULL
      AND resale_certificate_expiration_date IS NOT NULL
      AND resale_certificate_document_ref IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS distributor_compliance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_key text NOT NULL UNIQUE,
  account_status text NOT NULL CHECK (
    account_status IN ('NOT_STARTED', 'SUBMITTED', 'APPROVED', 'SUSPENDED', 'REJECTED')
  ),
  catalog_rights_confirmed boolean NOT NULL DEFAULT false,
  dropship_approved boolean NOT NULL DEFAULT false,
  resale_certificate_submitted_at timestamptz,
  resale_certificate_accepted_at timestamptz,
  tax_exemption_reference text,
  allow_tax_paid_procurement boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_event_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider webhook_provider NOT NULL,
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  external_object_id text,
  payload_hash text NOT NULL,
  raw_payload jsonb NOT NULL,
  processing_state webhook_processing_state NOT NULL DEFAULT 'RECEIVED',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  UNIQUE (provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS webhook_event_inbox_state_time_idx
  ON webhook_event_inbox (processing_state, received_at);

CREATE TABLE IF NOT EXISTS order_profit_gate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  policy_version text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('ALLOW', 'BLOCK')),
  net_sales_cents bigint NOT NULL,
  supplier_cost_cents bigint NOT NULL,
  fulfillment_cost_cents bigint NOT NULL,
  payment_fee_cents bigint NOT NULL,
  reserve_cents bigint NOT NULL,
  tax_leakage_cents bigint NOT NULL,
  expected_contribution_cents bigint NOT NULL,
  expected_margin_bps integer NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  input_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fulfillment_gate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  fulfillment_group_id uuid NOT NULL,
  payment_state text NOT NULL,
  risk_decision text NOT NULL,
  profit_decision text NOT NULL,
  compliance_state text NOT NULL,
  capital_state text NOT NULL,
  inventory_state text NOT NULL,
  execution_mode fulfillment_execution_mode NOT NULL,
  action text NOT NULL,
  resulting_state text NOT NULL,
  decision_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fulfillment_gate_decisions_order_idx
  ON fulfillment_gate_decisions (order_id, created_at DESC);

COMMIT;
