import { z } from 'zod';

// Base schema for all events to ensure consistency
const EventBaseSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.literal('1.0'),
  domain: z.string(),
  eventName: z.string(),
  correlationId: z.string().uuid(),
});

// Payload for when a daily cloud cost update is accrued from Google Cloud/AWS billing APIs
const DailyCloudCostAccruedPayloadSchema = z.object({
  billingPeriod: z.string(), // e.g., '2026-07'
  costCents: z.number().int().positive(), // The exact accrued cost for the day (e.g., 1550 for $15.50)
  currency: z.string().length(3),
  breakdown: z.object({
    computeCents: z.number().int().nonnegative(),
    databaseCents: z.number().int().nonnegative(),
    storageCents: z.number().int().nonnegative(),
    networkCents: z.number().int().nonnegative(),
  }),
  accruedAt: z.string().datetime(),
});

export const DailyCloudCostAccruedEventSchema = EventBaseSchema.extend({
  domain: z.literal('telemetry'),
  eventName: z.literal('billing.cost.accrued'),
  payload: DailyCloudCostAccruedPayloadSchema,
});

export type DailyCloudCostAccruedEvent = z.infer<typeof DailyCloudCostAccruedEventSchema>;
export type DailyCloudCostAccruedPayload = z.infer<typeof DailyCloudCostAccruedPayloadSchema>;


// Payload for when the monthly forecasted cloud bill exceeds a pre-defined warning threshold
const BillingBudgetThresholdExceededPayloadSchema = z.object({
  billingPeriod: z.string(),
  thresholdCents: z.number().int().positive(),
  forecastedCostCents: z.number().int().positive(),
  severity: z.enum(['WARNING', 'CRITICAL']),
  detectedAt: z.string().datetime(),
});

export const BillingBudgetThresholdExceededEventSchema = EventBaseSchema.extend({
  domain: z.literal('telemetry'),
  eventName: z.literal('billing.budget.exceeded'),
  payload: BillingBudgetThresholdExceededPayloadSchema,
});

export type BillingBudgetThresholdExceededEvent = z.infer<typeof BillingBudgetThresholdExceededEventSchema>;
export type BillingBudgetThresholdExceededPayload = z.infer<typeof BillingBudgetThresholdExceededPayloadSchema>;
