-- Migration: 001_initial_catalog_schema.sql
-- Description: Establishes the core tables for the Catalog domain, defining the ECOS product identity.

BEGIN;

CREATE TABLE IF NOT EXISTS brands (
  brand_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_category_id UUID REFERENCES categories(category_id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  path ltree, -- Using ltree for efficient hierarchical queries
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS categories_path_idx ON categories USING gist (path);


CREATE TABLE IF NOT EXISTS products (
  product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  owner TEXT NOT NULL DEFAULT 'RETAIL_ME_NOT', -- Explicitly state ownership
  brand_id UUID NOT NULL REFERENCES brands(brand_id),
  title TEXT NOT NULL,
  description TEXT,
  lifecycle_status TEXT NOT NULL DEFAULT 'NEW', -- e.g., NEW, ACTIVE, EOL
  publication_status TEXT NOT NULL DEFAULT 'DRAFT',
  -- Pricing, margin, and warranty are owned by ECOS, not the supplier
  list_price_cents BIGINT,
  cost_cents BIGINT,
  expected_margin_bps INT,
  warranty_length_months INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_owner_idx ON products (owner);


CREATE TABLE IF NOT EXISTS product_category_assignments (
  product_id UUID NOT NULL REFERENCES products(product_id),
  category_id UUID NOT NULL REFERENCES categories(category_id),
  PRIMARY KEY (product_id, category_id)
);


COMMIT;
