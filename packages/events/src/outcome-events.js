"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FulfillmentOutcomeRecordedSchema = void 0;
const zod_1 = require("zod");
// Base schema for all events to ensure consistency
const EventBaseSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    timestamp: zod_1.z.string().datetime(),
    version: zod_1.z.literal('1.0'),
    domain: zod_1.z.string(),
    eventName: zod_1.z.string(),
    correlationId: zod_1.z.string().uuid(),
});
// Payload representing the actual, recorded outcome of a completed fulfillment
const FulfillmentOutcomePayloadSchema = zod_1.z.object({
    outcomeId: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    providerId: zod_1.z.string(), // e.g., 'DISTRIBUTOR_A'
    decisionId: zod_1.z.string().uuid(), // Links back to the Decision Engine audit log
    // The Variance Evaluation metrics (Predicted vs. Actual)
    predictedDeliveryDays: zod_1.z.number().int().positive(),
    actualDeliveryDays: zod_1.z.number().int().positive(),
    deliveryDaysVariance: zod_1.z.number().int(), // e.g., +3 if late by 3 days, -1 if early
    predictedWholesaleCostCents: zod_1.z.number().int().positive(),
    actualWholesaleCostCents: zod_1.z.number().int().positive(),
    costVarianceCents: zod_1.z.number().int(), // e.g., positive if distributor overcharged
    status: zod_1.z.enum(['SUCCESS', 'LATE', 'OVERCHARGED', 'CANCELLED']),
    recordedAt: zod_1.z.string().datetime(),
});
exports.FulfillmentOutcomeRecordedSchema = EventBaseSchema.extend({
    domain: zod_1.z.literal('analytics'),
    eventName: zod_1.z.literal('fulfillment.outcome.recorded'),
    payload: FulfillmentOutcomePayloadSchema,
});
//# sourceMappingURL=outcome-events.js.map