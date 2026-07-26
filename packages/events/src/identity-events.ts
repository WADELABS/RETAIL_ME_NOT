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

// Payload for when a new customer registers and is assigned a secure Stripe Customer ID
const CustomerRegisteredPayloadSchema = z.object({
  customerId: z.string().uuid(),
  email: z.string().email(),
  stripeCustomerId: z.string().startsWith('cus_'), // Enforces PCI-compliant Stripe Customer Tokenization
  registeredAt: z.string().datetime(),
});

export const CustomerRegisteredEventSchema = EventBaseSchema.extend({
  domain: z.literal('identity'),
  eventName: z.literal('customer.registered'),
  payload: CustomerRegisteredPayloadSchema,
});

export type CustomerRegisteredEvent = z.infer<typeof CustomerRegisteredEventSchema>;
export type CustomerRegisteredPayload = z.infer<typeof CustomerRegisteredPayloadSchema>;


// Payload for when a customer successfully authenticates
const CustomerAuthenticatedPayloadSchema = z.object({
  customerId: z.string().uuid(),
  email: z.string().email(),
  sessionId: z.string().uuid(),
  authenticatedAt: z.string().datetime(),
});

export const CustomerAuthenticatedEventSchema = EventBaseSchema.extend({
  domain: z.literal('identity'),
  eventName: z.literal('customer.authenticated'),
  payload: CustomerAuthenticatedPayloadSchema,
});

export type CustomerAuthenticatedEvent = z.infer<typeof CustomerAuthenticatedEventSchema>;
export type CustomerAuthenticatedPayload = z.infer<typeof CustomerAuthenticatedPayloadSchema>;
