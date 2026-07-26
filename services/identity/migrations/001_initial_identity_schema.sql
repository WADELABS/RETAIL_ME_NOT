-- Migration: 001_initial_identity_schema.sql
-- Description: Creates the secure user authentication schema. Stores strong hashes and PCI-compliant Stripe references.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, -- PBKDF2/scrypt hashed password
  salt TEXT NOT NULL,          -- Unique cryptographic salt
  -- PCI Compliance Requirement: We NEVER store credit card numbers.
  -- Instead, we only store the reference token pointing to the customer's Stripe Vault.
  stripe_customer_id TEXT NOT NULL CHECK (stripe_customer_id LIKE 'cus_%'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

COMMIT;
