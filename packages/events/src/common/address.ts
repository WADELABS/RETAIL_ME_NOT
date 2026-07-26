import { z } from 'zod';

export const AddressSchema = z.object({
  recipientName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().length(2), // ISO 3166-1 alpha-2 country code
});

export type Address = z.infer<typeof AddressSchema>;
