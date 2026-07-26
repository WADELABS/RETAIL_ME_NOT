import { z } from 'zod';
declare const TaxCalculatedPayloadSchema: z.ZodObject<{
    orderId: z.ZodString;
    shippingState: z.ZodString;
    subtotalCents: z.ZodNumber;
    totalTaxCents: z.ZodNumber;
    taxLines: z.ZodArray<z.ZodObject<{
        state: z.ZodString;
        jurisdictionName: z.ZodString;
        taxType: z.ZodEnum<["STATE", "LOCAL", "SPECIAL"]>;
        rateBps: z.ZodNumber;
        amountCents: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        state: string;
        jurisdictionName: string;
        taxType: "STATE" | "LOCAL" | "SPECIAL";
        rateBps: number;
        amountCents: number;
    }, {
        state: string;
        jurisdictionName: string;
        taxType: "STATE" | "LOCAL" | "SPECIAL";
        rateBps: number;
        amountCents: number;
    }>, "many">;
    calculatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    shippingState: string;
    subtotalCents: number;
    totalTaxCents: number;
    taxLines: {
        state: string;
        jurisdictionName: string;
        taxType: "STATE" | "LOCAL" | "SPECIAL";
        rateBps: number;
        amountCents: number;
    }[];
    calculatedAt: string;
}, {
    orderId: string;
    shippingState: string;
    subtotalCents: number;
    totalTaxCents: number;
    taxLines: {
        state: string;
        jurisdictionName: string;
        taxType: "STATE" | "LOCAL" | "SPECIAL";
        rateBps: number;
        amountCents: number;
    }[];
    calculatedAt: string;
}>;
export declare const TaxCalculatedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    timestamp: z.ZodString;
    version: z.ZodLiteral<"1.0">;
    correlationId: z.ZodString;
} & {
    domain: z.ZodLiteral<"finance">;
    eventName: z.ZodLiteral<"tax.calculated">;
    payload: z.ZodObject<{
        orderId: z.ZodString;
        shippingState: z.ZodString;
        subtotalCents: z.ZodNumber;
        totalTaxCents: z.ZodNumber;
        taxLines: z.ZodArray<z.ZodObject<{
            state: z.ZodString;
            jurisdictionName: z.ZodString;
            taxType: z.ZodEnum<["STATE", "LOCAL", "SPECIAL"]>;
            rateBps: z.ZodNumber;
            amountCents: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            state: string;
            jurisdictionName: string;
            taxType: "STATE" | "LOCAL" | "SPECIAL";
            rateBps: number;
            amountCents: number;
        }, {
            state: string;
            jurisdictionName: string;
            taxType: "STATE" | "LOCAL" | "SPECIAL";
            rateBps: number;
            amountCents: number;
        }>, "many">;
        calculatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        orderId: string;
        shippingState: string;
        subtotalCents: number;
        totalTaxCents: number;
        taxLines: {
            state: string;
            jurisdictionName: string;
            taxType: "STATE" | "LOCAL" | "SPECIAL";
            rateBps: number;
            amountCents: number;
        }[];
        calculatedAt: string;
    }, {
        orderId: string;
        shippingState: string;
        subtotalCents: number;
        totalTaxCents: number;
        taxLines: {
            state: string;
            jurisdictionName: string;
            taxType: "STATE" | "LOCAL" | "SPECIAL";
            rateBps: number;
            amountCents: number;
        }[];
        calculatedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    payload: {
        orderId: string;
        shippingState: string;
        subtotalCents: number;
        totalTaxCents: number;
        taxLines: {
            state: string;
            jurisdictionName: string;
            taxType: "STATE" | "LOCAL" | "SPECIAL";
            rateBps: number;
            amountCents: number;
        }[];
        calculatedAt: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "finance";
    eventName: "tax.calculated";
    correlationId: string;
}, {
    payload: {
        orderId: string;
        shippingState: string;
        subtotalCents: number;
        totalTaxCents: number;
        taxLines: {
            state: string;
            jurisdictionName: string;
            taxType: "STATE" | "LOCAL" | "SPECIAL";
            rateBps: number;
            amountCents: number;
        }[];
        calculatedAt: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "finance";
    eventName: "tax.calculated";
    correlationId: string;
}>;
export type TaxCalculatedEvent = z.infer<typeof TaxCalculatedEventSchema>;
export type TaxCalculatedPayload = z.infer<typeof TaxCalculatedPayloadSchema>;
declare const TaxLiabilityRecordedPayloadSchema: z.ZodObject<{
    orderId: z.ZodString;
    transactionId: z.ZodString;
    totalTaxCents: z.ZodNumber;
    reserveAccountAction: z.ZodEnum<["TRANSFER_PENDING", "TRANSFERRED"]>;
    recordedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    totalTaxCents: number;
    transactionId: string;
    reserveAccountAction: "TRANSFER_PENDING" | "TRANSFERRED";
    recordedAt: string;
}, {
    orderId: string;
    totalTaxCents: number;
    transactionId: string;
    reserveAccountAction: "TRANSFER_PENDING" | "TRANSFERRED";
    recordedAt: string;
}>;
export declare const TaxLiabilityRecordedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    timestamp: z.ZodString;
    version: z.ZodLiteral<"1.0">;
    correlationId: z.ZodString;
} & {
    domain: z.ZodLiteral<"finance">;
    eventName: z.ZodLiteral<"tax.liability.recorded">;
    payload: z.ZodObject<{
        orderId: z.ZodString;
        transactionId: z.ZodString;
        totalTaxCents: z.ZodNumber;
        reserveAccountAction: z.ZodEnum<["TRANSFER_PENDING", "TRANSFERRED"]>;
        recordedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        orderId: string;
        totalTaxCents: number;
        transactionId: string;
        reserveAccountAction: "TRANSFER_PENDING" | "TRANSFERRED";
        recordedAt: string;
    }, {
        orderId: string;
        totalTaxCents: number;
        transactionId: string;
        reserveAccountAction: "TRANSFER_PENDING" | "TRANSFERRED";
        recordedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    payload: {
        orderId: string;
        totalTaxCents: number;
        transactionId: string;
        reserveAccountAction: "TRANSFER_PENDING" | "TRANSFERRED";
        recordedAt: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "finance";
    eventName: "tax.liability.recorded";
    correlationId: string;
}, {
    payload: {
        orderId: string;
        totalTaxCents: number;
        transactionId: string;
        reserveAccountAction: "TRANSFER_PENDING" | "TRANSFERRED";
        recordedAt: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "finance";
    eventName: "tax.liability.recorded";
    correlationId: string;
}>;
export type TaxLiabilityRecordedEvent = z.infer<typeof TaxLiabilityRecordedEventSchema>;
export type TaxLiabilityRecordedPayload = z.infer<typeof TaxLiabilityRecordedPayloadSchema>;
export {};
