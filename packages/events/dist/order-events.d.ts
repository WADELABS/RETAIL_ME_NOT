import { z } from 'zod';
declare const OrderPlacedPayloadSchema: z.ZodObject<{
    orderId: z.ZodString;
    customerId: z.ZodString;
    status: z.ZodLiteral<"PENDING_FULFILLMENT">;
    totalPriceCents: z.ZodNumber;
    taxCents: z.ZodNumber;
    shippingCents: z.ZodNumber;
    discountCents: z.ZodNumber;
    currency: z.ZodString;
    shippingAddress: z.ZodObject<{
        recipientName: z.ZodString;
        line1: z.ZodString;
        line2: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        recipientName: string;
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | null | undefined;
    }, {
        recipientName: string;
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | null | undefined;
    }>;
    billingAddress: z.ZodObject<{
        recipientName: z.ZodString;
        line1: z.ZodString;
        line2: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        city: z.ZodString;
        state: z.ZodString;
        postalCode: z.ZodString;
        country: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        recipientName: string;
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | null | undefined;
    }, {
        recipientName: string;
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | null | undefined;
    }>;
    placedAt: z.ZodString;
    lineItems: z.ZodArray<z.ZodObject<{
        lineItemId: z.ZodString;
        sku: z.ZodString;
        productTitle: z.ZodString;
        quantity: z.ZodNumber;
        unitPriceCents: z.ZodNumber;
        totalPriceCents: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        lineItemId: string;
        sku: string;
        productTitle: string;
        quantity: number;
        unitPriceCents: number;
        totalPriceCents: number;
    }, {
        lineItemId: string;
        sku: string;
        productTitle: string;
        quantity: number;
        unitPriceCents: number;
        totalPriceCents: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "PENDING_FULFILLMENT";
    totalPriceCents: number;
    orderId: string;
    customerId: string;
    taxCents: number;
    shippingCents: number;
    discountCents: number;
    currency: string;
    shippingAddress: {
        recipientName: string;
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | null | undefined;
    };
    billingAddress: {
        recipientName: string;
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | null | undefined;
    };
    placedAt: string;
    lineItems: {
        lineItemId: string;
        sku: string;
        productTitle: string;
        quantity: number;
        unitPriceCents: number;
        totalPriceCents: number;
    }[];
}, {
    status: "PENDING_FULFILLMENT";
    totalPriceCents: number;
    orderId: string;
    customerId: string;
    taxCents: number;
    shippingCents: number;
    discountCents: number;
    currency: string;
    shippingAddress: {
        recipientName: string;
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | null | undefined;
    };
    billingAddress: {
        recipientName: string;
        line1: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        line2?: string | null | undefined;
    };
    placedAt: string;
    lineItems: {
        lineItemId: string;
        sku: string;
        productTitle: string;
        quantity: number;
        unitPriceCents: number;
        totalPriceCents: number;
    }[];
}>;
export declare const OrderPlacedEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    timestamp: z.ZodString;
    version: z.ZodLiteral<"1.0">;
    correlationId: z.ZodString;
} & {
    domain: z.ZodLiteral<"orders">;
    eventName: z.ZodLiteral<"order.placed">;
    payload: z.ZodObject<{
        orderId: z.ZodString;
        customerId: z.ZodString;
        status: z.ZodLiteral<"PENDING_FULFILLMENT">;
        totalPriceCents: z.ZodNumber;
        taxCents: z.ZodNumber;
        shippingCents: z.ZodNumber;
        discountCents: z.ZodNumber;
        currency: z.ZodString;
        shippingAddress: z.ZodObject<{
            recipientName: z.ZodString;
            line1: z.ZodString;
            line2: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            city: z.ZodString;
            state: z.ZodString;
            postalCode: z.ZodString;
            country: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        }, {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        }>;
        billingAddress: z.ZodObject<{
            recipientName: z.ZodString;
            line1: z.ZodString;
            line2: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            city: z.ZodString;
            state: z.ZodString;
            postalCode: z.ZodString;
            country: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        }, {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        }>;
        placedAt: z.ZodString;
        lineItems: z.ZodArray<z.ZodObject<{
            lineItemId: z.ZodString;
            sku: z.ZodString;
            productTitle: z.ZodString;
            quantity: z.ZodNumber;
            unitPriceCents: z.ZodNumber;
            totalPriceCents: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            lineItemId: string;
            sku: string;
            productTitle: string;
            quantity: number;
            unitPriceCents: number;
            totalPriceCents: number;
        }, {
            lineItemId: string;
            sku: string;
            productTitle: string;
            quantity: number;
            unitPriceCents: number;
            totalPriceCents: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "PENDING_FULFILLMENT";
        totalPriceCents: number;
        orderId: string;
        customerId: string;
        taxCents: number;
        shippingCents: number;
        discountCents: number;
        currency: string;
        shippingAddress: {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        };
        billingAddress: {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        };
        placedAt: string;
        lineItems: {
            lineItemId: string;
            sku: string;
            productTitle: string;
            quantity: number;
            unitPriceCents: number;
            totalPriceCents: number;
        }[];
    }, {
        status: "PENDING_FULFILLMENT";
        totalPriceCents: number;
        orderId: string;
        customerId: string;
        taxCents: number;
        shippingCents: number;
        discountCents: number;
        currency: string;
        shippingAddress: {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        };
        billingAddress: {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        };
        placedAt: string;
        lineItems: {
            lineItemId: string;
            sku: string;
            productTitle: string;
            quantity: number;
            unitPriceCents: number;
            totalPriceCents: number;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "orders";
    eventName: "order.placed";
    correlationId: string;
    payload: {
        status: "PENDING_FULFILLMENT";
        totalPriceCents: number;
        orderId: string;
        customerId: string;
        taxCents: number;
        shippingCents: number;
        discountCents: number;
        currency: string;
        shippingAddress: {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        };
        billingAddress: {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        };
        placedAt: string;
        lineItems: {
            lineItemId: string;
            sku: string;
            productTitle: string;
            quantity: number;
            unitPriceCents: number;
            totalPriceCents: number;
        }[];
    };
}, {
    eventId: string;
    timestamp: string;
    version: "1.0";
    domain: "orders";
    eventName: "order.placed";
    correlationId: string;
    payload: {
        status: "PENDING_FULFILLMENT";
        totalPriceCents: number;
        orderId: string;
        customerId: string;
        taxCents: number;
        shippingCents: number;
        discountCents: number;
        currency: string;
        shippingAddress: {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        };
        billingAddress: {
            recipientName: string;
            line1: string;
            city: string;
            state: string;
            postalCode: string;
            country: string;
            line2?: string | null | undefined;
        };
        placedAt: string;
        lineItems: {
            lineItemId: string;
            sku: string;
            productTitle: string;
            quantity: number;
            unitPriceCents: number;
            totalPriceCents: number;
        }[];
    };
}>;
export type OrderPlacedEvent = z.infer<typeof OrderPlacedEventSchema>;
export type OrderPlacedEventPayload = z.infer<typeof OrderPlacedPayloadSchema>;
export {};
