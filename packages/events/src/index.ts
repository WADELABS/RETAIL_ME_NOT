// This file serves as the main entry point for the @ecos/events package.
// It exports all event schemas and types, making them available to other
// services in the monorepo.

export * from './common/address';
export * from './order-events';
export * from './procurement-events';
export * from './tax-events';
export * from './outcome-events';
export * from './telemetry-events';
export * from './billing-events';
export * from './identity-events';
// export * from './pricing-events';
// export * from './risk-events';
// ... and so on for all other domain events
