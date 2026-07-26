-- Migration: 001_initial_telemetry_schema.sql
-- Description: Establishes schemas for tracking high-volume real-time shopper telemetry and aggregate demand trends.

BEGIN;

-- 1. Real-Time Telemetry Aggregates (Hourly rolling buckets)
CREATE TABLE IF NOT EXISTS realtime_telemetry_aggregates (
  aggregate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  hour_bucket TIMESTAMPTZ NOT NULL, -- Truncated hourly timestamp
  search_count INT NOT NULL DEFAULT 0 CHECK (search_count >= 0),
  cart_add_count INT NOT NULL DEFAULT 0 CHECK (cart_add_count >= 0),
  view_count INT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sku, hour_bucket)
);
CREATE INDEX IF NOT EXISTS telemetry_sku_bucket_idx ON realtime_telemetry_aggregates (sku, hour_bucket DESC);

-- 2. Demand Trends (SKU Trending State Machine)
CREATE TABLE IF NOT EXISTS demand_trends (
  trend_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  demand_velocity_score NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (demand_velocity_score >= 0),
  trending_status TEXT NOT NULL DEFAULT 'STABLE' CHECK (trending_status IN ('COLD', 'STABLE', 'TRENDING', 'HOT')),
  margin_surcharge_bps INT NOT NULL DEFAULT 0 CHECK (margin_surcharge_bps >= 0),
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS demand_trends_status_idx ON demand_trends (trending_status);

COMMIT;
