import { z } from 'zod';
export declare const AddressSchema: z.ZodObject<{
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
export type Address = z.infer<typeof AddressSchema>;
