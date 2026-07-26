import { z } from 'zod';
declare const PurchaseOrderCreatedPayloadSchema: z.ZodObject<{
    purchaseOrderId: z.ZodString;
    orderId: z.ZodString;
    providerId: z.ZodString;
    totalWholesaleCostCents: z.ZodNumber;
    items: z.ZodArray<z.ZodObject<{
        poItemId: z.ZodString;
        sku: z.ZodString;
        wholesaleCostCents: z.ZodNumber;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sku: string;
        quantity: number;
        poItemId: string;
        wholesaleCostCents: number;
    }, {
        sku: string;
        quantity: number;
        poItemId: string;
        wholesaleCostCents: number;
    }>, "many">;
    status: z.ZodLiteral<"CREATED">;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "CREATED";
    orderId: string;
    purchaseOrderId: string;
    providerId: string;
    totalWholesaleCostCents: number;
    items: {
        sku: string;
        quantity: number;
        poItemId: string;
        wholesaleCostCents: number;
    }[];
    createdAt: string;
}, {
    status: "CREATED";
    orderId: string;
    purchaseOrderId: string;
    providerId: string;
    totalWholesaleCostCents: number;
    items: {
        sku: string;
        quantity: number;
        poItemId: string;
        wholesaleCostCents: number;
    }[];
    createdAt: string;
}>;
export declare const PurchaseOrderCreatedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    timestamp: z.ZodString;
    version: z.ZodLiteral<"1.0">;
    correlationId: z.ZodString;
} & {
    domain: z.ZodLiteral<"procurement">;
    eventName: z.ZodLiteral<"purchase_order.created">;
    payload: z.ZodObject<{
        purchaseOrderId: z.ZodString;
        orderId: z.ZodString;
        providerId: z.ZodString;
        totalWholesaleCostCents: z.ZodNumber;
        items: z.ZodArray<z.ZodObject<{
            poItemId: z.ZodString;
            sku: z.ZodString;
            wholesaleCostCents: z.ZodNumber;
            quantity: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            sku: string;
            quantity: number;
            poItemId: string;
            wholesaleCostCents: number;
        }, {
            sku: string;
            quantity: number;
            poItemId: string;
            wholesaleCostCents: number;
        }>, "many">;
        status: z.ZodLiteral<"CREATED">;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "CREATED";
        orderId: string;
        purchaseOrderId: string;
        providerId: string;
        totalWholesaleCostCents: number;
        items: {
            sku: string;
            quantity: number;
            poItemId: string;
            wholesaleCostCents: number;
        }[];
        createdAt: string;
    }, {
        status: "CREATED";
        orderId: string;
        purchaseOrderId: string;
        providerId: string;
        totalWholesaleCostCents: number;
        items: {
            sku: string;
            quantity: number;
            poItemId: string;
            wholesaleCostCents: number;
        }[];
        createdAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    payload: {
        status: "CREATED";
        orderId: string;
        purchaseOrderId: string;
        providerId: string;
        totalWholesaleCostCents: number;
        items: {
            sku: string;
            quantity: number;
            poItemId: string;
            wholesaleCostCents: number;
        }[];
        createdAt: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "procurement";
    eventName: "purchase_order.created";
    correlationId: string;
}, {
    payload: {
        status: "CREATED";
        orderId: string;
        purchaseOrderId: string;
        providerId: string;
        totalWholesaleCostCents: number;
        items: {
            sku: string;
            quantity: number;
            poItemId: string;
            wholesaleCostCents: number;
        }[];
        createdAt: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "procurement";
    eventName: "purchase_order.created";
    correlationId: string;
}>;
export type PurchaseOrderCreatedEvent = z.infer<typeof PurchaseOrderCreatedEventSchema>;
export type PurchaseOrderCreatedPayload = z.infer<typeof PurchaseOrderCreatedPayloadSchema>;
declare const PurchaseOrderAcceptedPayloadSchema: z.ZodObject<{
    purchaseOrderId: z.ZodString;
    providerReferenceId: z.ZodString;
    status: z.ZodLiteral<"ACCEPTED">;
    acceptedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "ACCEPTED";
    purchaseOrderId: string;
    providerReferenceId: string;
    acceptedAt: string;
}, {
    status: "ACCEPTED";
    purchaseOrderId: string;
    providerReferenceId: string;
    acceptedAt: string;
}>;
export declare const PurchaseOrderAcceptedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    timestamp: z.ZodString;
    version: z.ZodLiteral<"1.0">;
    correlationId: z.ZodString;
} & {
    domain: z.ZodLiteral<"procurement">;
    eventName: z.ZodLiteral<"purchase_order.accepted">;
    payload: z.ZodObject<{
        purchaseOrderId: z.ZodString;
        providerReferenceId: z.ZodString;
        status: z.ZodLiteral<"ACCEPTED">;
        acceptedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "ACCEPTED";
        purchaseOrderId: string;
        providerReferenceId: string;
        acceptedAt: string;
    }, {
        status: "ACCEPTED";
        purchaseOrderId: string;
        providerReferenceId: string;
        acceptedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    payload: {
        status: "ACCEPTED";
        purchaseOrderId: string;
        providerReferenceId: string;
        acceptedAt: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "procurement";
    eventName: "purchase_order.accepted";
    correlationId: string;
}, {
    payload: {
        status: "ACCEPTED";
        purchaseOrderId: string;
        providerReferenceId: string;
        acceptedAt: string;
    };
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "procurement";
    eventName: "purchase_order.accepted";
    correlationId: string;
}>;
export type PurchaseOrderAcceptedEvent = z.infer<typeof PurchaseOrderAcceptedEventSchema>;
export type PurchaseOrderAcceptedPayload = z.infer<typeof PurchaseOrderAcceptedPayloadSchema>;
export {};
