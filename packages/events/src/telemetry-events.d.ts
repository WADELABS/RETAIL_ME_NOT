import { z } from 'zod';
declare const SearchPerformedPayloadSchema: z.ZodObject<{
    sessionId: z.ZodString;
    query: z.ZodString;
    matchedSkus: z.ZodArray<z.ZodString, "many">;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    sessionId: string;
    query: string;
    matchedSkus: string[];
}, {
    timestamp: string;
    sessionId: string;
    query: string;
    matchedSkus: string[];
}>;
export declare const SearchPerformedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    timestamp: z.ZodString;
    version: z.ZodLiteral<"1.0">;
    correlationId: z.ZodString;
} & {
    domain: z.ZodLiteral<"telemetry">;
    eventName: z.ZodLiteral<"search.performed">;
    payload: z.ZodObject<{
        sessionId: z.ZodString;
        query: z.ZodString;
        matchedSkus: z.ZodArray<z.ZodString, "many">;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        sessionId: string;
        query: string;
        matchedSkus: string[];
    }, {
        timestamp: string;
        sessionId: string;
        query: string;
        matchedSkus: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    payload: {
        timestamp: string;
        sessionId: string;
        query: string;
        matchedSkus: string[];
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "telemetry";
    eventName: "search.performed";
    correlationId: string;
}, {
    payload: {
        timestamp: string;
        sessionId: string;
        query: string;
        matchedSkus: string[];
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "telemetry";
    eventName: "search.performed";
    correlationId: string;
}>;
export type SearchPerformedEvent = z.infer<typeof SearchPerformedEventSchema>;
export type SearchPerformedPayload = z.infer<typeof SearchPerformedPayloadSchema>;
declare const CartItemAddedPayloadSchema: z.ZodObject<{
    sessionId: z.ZodString;
    sku: z.ZodString;
    quantity: z.ZodNumber;
    unitPriceCents: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    sku: string;
    quantity: number;
    unitPriceCents: number;
    sessionId: string;
}, {
    timestamp: string;
    sku: string;
    quantity: number;
    unitPriceCents: number;
    sessionId: string;
}>;
export declare const CartItemAddedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    timestamp: z.ZodString;
    version: z.ZodLiteral<"1.0">;
    correlationId: z.ZodString;
} & {
    domain: z.ZodLiteral<"telemetry">;
    eventName: z.ZodLiteral<"cart.item_added">;
    payload: z.ZodObject<{
        sessionId: z.ZodString;
        sku: z.ZodString;
        quantity: z.ZodNumber;
        unitPriceCents: z.ZodNumber;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        sku: string;
        quantity: number;
        unitPriceCents: number;
        sessionId: string;
    }, {
        timestamp: string;
        sku: string;
        quantity: number;
        unitPriceCents: number;
        sessionId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    payload: {
        timestamp: string;
        sku: string;
        quantity: number;
        unitPriceCents: number;
        sessionId: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "telemetry";
    eventName: "cart.item_added";
    correlationId: string;
}, {
    payload: {
        timestamp: string;
        sku: string;
        quantity: number;
        unitPriceCents: number;
        sessionId: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "telemetry";
    eventName: "cart.item_added";
    correlationId: string;
}>;
export type CartItemAddedEvent = z.infer<typeof CartItemAddedEventSchema>;
export type CartItemAddedPayload = z.infer<typeof CartItemAddedPayloadSchema>;
declare const DemandSpikeDetectedPayloadSchema: z.ZodObject<{
    sku: z.ZodString;
    demandVelocityScore: z.ZodNumber;
    trendingStatus: z.ZodEnum<["TRENDING", "HOT"]>;
    marginSurchargeBps: z.ZodNumber;
    detectedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sku: string;
    demandVelocityScore: number;
    trendingStatus: "TRENDING" | "HOT";
    marginSurchargeBps: number;
    detectedAt: string;
}, {
    sku: string;
    demandVelocityScore: number;
    trendingStatus: "TRENDING" | "HOT";
    marginSurchargeBps: number;
    detectedAt: string;
}>;
export declare const DemandSpikeDetectedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    timestamp: z.ZodString;
    version: z.ZodLiteral<"1.0">;
    correlationId: z.ZodString;
} & {
    domain: z.ZodLiteral<"telemetry">;
    eventName: z.ZodLiteral<"demand.trending-spike">;
    payload: z.ZodObject<{
        sku: z.ZodString;
        demandVelocityScore: z.ZodNumber;
        trendingStatus: z.ZodEnum<["TRENDING", "HOT"]>;
        marginSurchargeBps: z.ZodNumber;
        detectedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        sku: string;
        demandVelocityScore: number;
        trendingStatus: "TRENDING" | "HOT";
        marginSurchargeBps: number;
        detectedAt: string;
    }, {
        sku: string;
        demandVelocityScore: number;
        trendingStatus: "TRENDING" | "HOT";
        marginSurchargeBps: number;
        detectedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    payload: {
        sku: string;
        demandVelocityScore: number;
        trendingStatus: "TRENDING" | "HOT";
        marginSurchargeBps: number;
        detectedAt: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "telemetry";
    eventName: "demand.trending-spike";
    correlationId: string;
}, {
    payload: {
        sku: string;
        demandVelocityScore: number;
        trendingStatus: "TRENDING" | "HOT";
        marginSurchargeBps: number;
        detectedAt: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "telemetry";
    eventName: "demand.trending-spike";
    correlationId: string;
}>;
export type DemandSpikeDetectedEvent = z.infer<typeof DemandSpikeDetectedEventSchema>;
export type DemandSpikeDetectedPayload = z.infer<typeof DemandSpikeDetectedPayloadSchema>;
export {};
