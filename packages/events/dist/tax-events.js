"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxLiabilityRecordedEventSchema = exports.TaxCalculatedEventSchema = void 0;
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
// Detailed line item tax breakdown
const TaxLineSchema = zod_1.z.object({
    state: zod_1.z.string().length(2), // e.g., 'LA'
    jurisdictionName: zod_1.z.string(), // e.g., 'East Baton Rouge Parish'
    taxType: zod_1.z.enum(['STATE', 'LOCAL', 'SPECIAL']),
    rateBps: zod_1.z.number().int().positive(), // Rate in basis points (e.g., 945 for 9.45%)
    amountCents: zod_1.z.number().int().positive(),
});
// Payload for when sales tax is calculated for a pending order
const TaxCalculatedPayloadSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    shippingState: zod_1.z.string().length(2),
    subtotalCents: zod_1.z.number().int().positive(),
    totalTaxCents: zod_1.z.number().int().nonnegative(),
    taxLines: zod_1.z.array(TaxLineSchema),
    calculatedAt: zod_1.z.string().datetime(),
});
// Full event schema for 'tax.calculated'
exports.TaxCalculatedEventSchema = EventBaseSchema.extend({
    domain: zod_1.z.literal('finance'),
    eventName: zod_1.z.literal('tax.calculated'),
    payload: TaxCalculatedPayloadSchema,
});
// Payload for when tax liability is officially reserved and ledgered after payment success
const TaxLiabilityRecordedPayloadSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    transactionId: zod_1.z.string().uuid(), // ID linking to our internal tax_transactions ledger table
    totalTaxCents: zod_1.z.number().int().positive(),
    reserveAccountAction: zod_1.z.enum(['TRANSFER_PENDING', 'TRANSFERRED']),
    recordedAt: zod_1.z.string().datetime(),
});
exports.TaxLiabilityRecordedEventSchema = EventBaseSchema.extend({
    domain: zod_1.z.literal('finance'),
    eventName: zod_1.z.literal('tax.liability.recorded'),
    payload: TaxLiabilityRecordedPayloadSchema,
});
//# sourceMappingURL=tax-events.js.map